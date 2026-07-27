# 桌面端 Plan API 集成运维

## 正式数据边界

桌面正式数据以 Plan API 所连接的 SQLite 为准。`state.v1.json` 只用于首次迁移来源、兼容导出和浏览器 Demo；它不是桌面正式写入的副本。不要提交 Desktop Token、`.env`、SSH 私钥、SQLite `*.db` 文件或备份目录。

浏览器预览继续在 `http://127.0.0.1:5178` 使用 `localStorage` Demo，与 Electron 的 Plan API 数据完全隔离。

## 本地直连

1. 在本机启动 Plan API，并确认 `http://127.0.0.1:8743/v1/health` 返回健康状态。
2. 桌宠打开“设置 > 数据服务”，选择“本地直连”。
3. 在 `Base URL` 填入服务地址，例如 `http://127.0.0.1:8743`；在 `Desktop Token` 填入服务端签发的令牌。
4. 点击“测试连接”，确认 API 版本和服务版本显示正常，再点击“保存连接”。保存后输入框会清空 Token，只保留安全存储的密文。

数据服务页字段含义如下：

- `连接模式`：选择本地直连或云端 SSH。
- `Base URL`：仅本地直连使用的 Plan API 地址。
- `SSH 目标`：仅云端 SSH 使用的 Windows OpenSSH 别名。
- `本地端口`：桌面端本机转发端口；不要与其他服务冲突。
- `远端端口`：云端 Plan API 监听端口。
- `Desktop Token`：请求认证令牌，不会以明文保存或显示。

## 云端 SSH

在 Windows `%USERPROFILE%\.ssh\config` 中先配置别名，桌面端只填写别名，不填写私钥路径：

```sshconfig
Host hermes-plan
  HostName plan.example.com
  User hermes
  IdentityFile ~/.ssh/id_ed25519
  IdentitiesOnly yes
```

在“数据服务”选择“云端 SSH”，填写 `SSH 目标` 为 `hermes-plan`，并按部署值填写本地端口、远端端口和 Desktop Token。测试连接会临时建立隧道；失败时先确认 `ssh hermes-plan` 可登录、服务监听地址和端口一致，再重试。

## 首次迁移与离线

首次配置后，数据服务页会提供迁移预览。先导出并保留 `state.v1.json`，迁移前的桌面副本会保存在用户数据目录中，文件名形如 `state.v1.pre-plan-api-<时间>-<随机值>.json`。核对待办、周期计划和服务版本后，使用二次确认执行迁移；验收时刷新应用，确认同一数据仍从 Plan API/SQLite 读取。

服务不可达时，桌面端只显示最近成功同步的缓存，所有写入和 AI 提案执行都会被阻止。恢复网络或 SSH 后等待自动重连，或在数据服务页点击“测试连接”并重新保存；重连成功后再刷新并重试原操作，避免在离线缓存上重复编辑。

## 云端维护

云端用户服务常用命令：

```bash
systemctl --user start hermes-plan-api.service
systemctl --user stop hermes-plan-api.service
systemctl --user status hermes-plan-api.service
journalctl --user -u hermes-plan-api.service -f
```

使用 Plan API 的一致性备份命令，不要复制运行中的主库或它的 `-wal`、`-shm` 文件：

```bash
~/.local/share/hermes-plan-api/.venv/bin/python -m plan_api backup --backup-dir ~/.local/share/hermes-plan-api/backups
```

恢复时先停止服务，删除目标库的 WAL/SHM，再复制一个 `plan-*.db` 备份并校验：

```bash
systemctl --user stop hermes-plan-api.service
rm -f ~/.local/share/hermes-plan-api/plan.db-wal ~/.local/share/hermes-plan-api/plan.db-shm
cp ~/.local/share/hermes-plan-api/backups/plan-YYYYMMDDTHHMMSSffffffZ.db ~/.local/share/hermes-plan-api/plan.db
sqlite3 ~/.local/share/hermes-plan-api/plan.db 'PRAGMA integrity_check;'
systemctl --user start hermes-plan-api.service
curl -H "Authorization: Bearer $PLAN_DESKTOP_TOKEN" http://127.0.0.1:8743/v1/health
```

仅恢复 `PRAGMA integrity_check` 返回 `ok` 的备份。不要把备份、数据库或密钥放进 Git。
