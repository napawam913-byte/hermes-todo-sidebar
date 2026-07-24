# Hermes 待办桌宠

这是一个供单名用户在单台 Windows 电脑上使用的本地待办应用。闲置时只显示桌面边缘入口，点击后展开待办面板；关闭或收起后继续驻留系统托盘。

## 第一版正式功能

- `今日待办 / 周期任务` 双入口。
- 新增、完成和筛选手动待办。
- 自动合并今天命中的周期任务与所有未完成逾期任务。
- 手动创建、编辑包含多个日期条目的周期计划。
- 计划详情使用统一 `CyclePlan v2` JSON；普通内容保存为 Markdown，健身等专业内容块可继续扩展。
- Electron 主进程把数据保存到本机 JSON 文件，写入前自动备份并保留最近 7 份。
- Windows 登录后自动启动正式安装版；开发模式不修改系统启动项。
- 中文托盘菜单支持打开、隐藏、打开数据目录、导出、导入和退出。
- 单实例运行；只有托盘“退出”会完全结束应用。

第一版只按日期管理待办，不提供具体时间、系统定时通知、Hermes、飞书或真实 Agent。

## 开发命令

```powershell
npm install
npm test
npm run typecheck
npm run build
npm run dev
```

`npm run dev` 在 [http://127.0.0.1:5178](http://127.0.0.1:5178) 启动浏览器预览。浏览器预览使用 `localStorage` 和示例数据，不等同于正式桌面数据。

启动 Electron 开发壳：

```powershell
npm run build:main
npm start
```

生成 Windows 安装包和便携版：

```powershell
npm run dist:win
```

产物写入 `release/`。详细使用方式见 [本地正式版使用说明](docs/local-v1-usage.md)。

## 数据与代码边界

- 正式数据：`%APPDATA%\hermes-todo-sidebar\data\state.v1.json`。
- 浏览器 Demo：当前站点的 `localStorage`。
- renderer 只通过 preload IPC 读写数据，不直接访问文件系统。
- Hermes、飞书、提醒和 Agent 均保留独立扩展模块，不写进 UI 组件。
- 源码文件继续保持小模块，单个 TS、TSX、CSS 文件不超过 220 行。

后续接口位置见 [后续功能扩展点](docs/extension-points.md)。

## Cloud Plan API foundation

`services/plan-api` now contains the Plan API foundation: a FastAPI app,
SQLite migrations, repository and query services, mutation execution,
rolling window generation, authenticated routes, a CLI, atomic backups,
user systemd units, and a deterministic `openapi.v1.json` contract.

Run Plan API checks from the repository root with:

```powershell
$env:PYTHONDONTWRITEBYTECODE='1'
C:\tmp\hermes-plan-api-python311\python.exe -m pytest services/plan-api/tests -q -p no:cacheprovider --basetemp C:\tmp\plan-api-tests
```

The Hermes plugin integration and desktop data migration are still separate
phases. The current Electron desktop app continues to use its existing local
data path until those phases are implemented.

Deployment notes are in
[`docs/cloud-plan-api-deployment.md`](docs/cloud-plan-api-deployment.md).
