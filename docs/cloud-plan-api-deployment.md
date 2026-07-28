# 云端 Plan API 部署与 Hermes 联调

## 架构

第一版面向单用户、单台 Windows 电脑：

```text
Windows 桌宠 --SSH 隧道--> Plan API --读写--> SQLite
Hermes Skill/Plugin ------> Plan API --读写--> 同一 SQLite
```

SQLite 是正式数据库文件，不是旧版 `state.v1.json`。任务领域内容仍以 JSON 存在 `content_json` 列中；Hermes 和桌宠都不能直接操作数据库文件。

Plan API 固定监听云服务器 `127.0.0.1:8743`，不开放公网端口。

## 目录规划

```text
~/apps/hermes-todo-sidebar/               Git 源码
~/.local/share/hermes-plan-api/           Python 环境、数据库、备份
~/.config/hermes-plan-api/plan-api.env    服务端密钥与路径
~/.hermes/plugins/cycle-plan-tools/       Hermes Plugin
~/.hermes/skills/cycle-plan/              Hermes Skill
```

源码、运行数据、密钥和备份各自独立，后续更新代码不会覆盖数据库。

## 1. 上传或拉取代码

```bash
mkdir -p ~/apps
cd ~/apps
git clone https://github.com/napawam913-byte/hermes-todo-sidebar.git
cd hermes-todo-sidebar
git switch --track origin/feat/draggable-pet
```

后续更新：

```bash
cd ~/apps/hermes-todo-sidebar
git pull --ff-only
```

## 2. 安装 Plan API

```bash
mkdir -p ~/.local/share/hermes-plan-api
python3.11 -m venv ~/.local/share/hermes-plan-api/.venv
~/.local/share/hermes-plan-api/.venv/bin/python -m pip install --upgrade pip
~/.local/share/hermes-plan-api/.venv/bin/python -m pip install \
  ~/apps/hermes-todo-sidebar/services/plan-api
```

生成两个不同的 64 字符 Token：

```bash
openssl rand -hex 32
openssl rand -hex 32
```

创建 `~/.config/hermes-plan-api/plan-api.env`：

```bash
mkdir -p ~/.config/hermes-plan-api
chmod 0700 ~/.config/hermes-plan-api
nano ~/.config/hermes-plan-api/plan-api.env
```

内容：

```dotenv
PLAN_DATABASE_PATH=/home/ubuntu/.local/share/hermes-plan-api/plan.db
PLAN_DESKTOP_TOKEN=<桌宠专用 Token>
PLAN_HERMES_TOKEN=<Hermes 专用 Token>
```

保护密钥文件并迁移数据库：

```bash
chmod 0600 ~/.config/hermes-plan-api/plan-api.env
set -a
. ~/.config/hermes-plan-api/plan-api.env
set +a
~/.local/share/hermes-plan-api/.venv/bin/python -m plan_api migrate
```

## 3. 启动用户级 systemd 服务

```bash
mkdir -p ~/.config/systemd/user
cp ~/apps/hermes-todo-sidebar/services/plan-api/deploy/systemd/*.service \
  ~/.config/systemd/user/
cp ~/apps/hermes-todo-sidebar/services/plan-api/deploy/systemd/*.timer \
  ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now hermes-plan-api.service
systemctl --user enable --now hermes-plan-maintenance.timer
loginctl enable-linger "$USER"
```

检查：

```bash
systemctl --user status hermes-plan-api.service
curl http://127.0.0.1:8743/v1/health
```

健康响应应包含 `status: ok`、`service: plan-api` 和 `apiVersion: 1`。

## 4. 配置并安装 Hermes 扩展

把 Plan API 地址与 Hermes Token 同步到 `~/.hermes/.env`：

```dotenv
PLAN_API_BASE_URL=http://127.0.0.1:8743
PLAN_HERMES_TOKEN=<与 plan-api.env 相同的 Hermes Token>
```

不要把桌宠 Token 配给 Hermes。随后执行：

```bash
cd ~/apps/hermes-todo-sidebar/integrations/hermes/cycle-plan
chmod +x install.sh
./install.sh
```

安装完成后运行：

```bash
hermes plugins list
hermes tools
```

确认 `cycle-plan-tools` 已启用，并为实际聊天平台启用 `cycle_plan` 工具集。建议关闭 Terminal、File、Code、Delegation 与 Cron。

## 5. 云端自然语言验收

在新的 Hermes 会话中依次测试：

```text
初学者一周练几次比较合适？
```

预期：正常讨论，不调用周期任务工具。

```text
帮我制定未来四周、每周三练的初学者健身计划。
```

预期：信息不足时追问；信息完整后创建 `pending` 提案，并询问是否确认，此时数据库正式任务不变化。

```text
可以，确认创建。
```

预期：调用 `cycle_plan_confirm`，Plan API 原子写入任务与条目。随后：

```bash
set -a
. ~/.config/hermes-plan-api/plan-api.env
set +a
curl -sS \
  -H "Authorization: Bearer $PLAN_HERMES_TOKEN" \
  http://127.0.0.1:8743/v1/tasks
```

应能看到新建的 `cycle` 任务。

## 6. Windows 桌宠连接

在 Windows 建立 SSH 隧道：

```powershell
ssh -N -L 8743:127.0.0.1:8743 ubuntu@你的服务器地址
```

桌宠使用：

```text
Base URL: http://127.0.0.1:8743
Token: PLAN_DESKTOP_TOKEN
```

桌宠不需要拉取源码，正式使用方式仍是下载免安装目录版或安装版 EXE。软件通过 SSH 隧道读取云端数据。

## 备份与恢复

维护定时器每天补齐滚动窗口并保留最近 14 份 SQLite 备份。手动备份：

```bash
~/.local/share/hermes-plan-api/.venv/bin/python -m plan_api backup \
  --backup-dir ~/.local/share/hermes-plan-api/backups
```

恢复前先停止服务，并验证备份：

```bash
systemctl --user stop hermes-plan-api.service
sqlite3 ~/.local/share/hermes-plan-api/backups/备份文件.db \
  'PRAGMA integrity_check;'
```

只有返回 `ok` 才能替换正式 `plan.db`，替换后重新启动服务。

## 安全边界

- 不提交 `.env`、Token、`plan.db`、WAL/SHM 或备份到 Git。
- Plan API 只监听 `127.0.0.1`。
- Desktop Token 与 Hermes Token 必须不同。
- Hermes Token 不能调用桌面专用 `/v1/mutations`。
- 所有 Hermes 写入必须先形成提案，并在同一会话明确确认。
