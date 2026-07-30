# Hermes 待办桌宠

这是一个供单名用户在单台 Windows 电脑上使用的本地待办应用。闲置时只显示桌面边缘入口，点击后展开待办面板；关闭或收起后继续驻留系统托盘。

## 第一版正式功能

- `今日待办 / 周期任务` 双入口。
- 普通待办支持新增、修改、完成、恢复和永久删除，并在保存失败时保留原界面数据。
- 自动合并今天命中的周期任务与所有未完成逾期任务。
- 周期计划内容只通过大模型 API 的标准 JSON 提案新增或调整；生成后仍可手动启用、暂停、归档和永久删除。
- 周期条目由 API 按日期生成，仍可手动完成、恢复、跳过和删除。
- 计划详情使用统一 `CyclePlan v2` JSON；普通内容保存为 Markdown，健身等专业内容块可继续扩展。
- Electron 主进程把数据保存到本机 JSON 文件，写入前自动备份并保留最近 7 份。
- 手动状态操作与 AI 提案共用 `AppMutationOperation`、运行时白名单校验和一次原子保存；renderer 不直接替换正式数组。
- Windows 登录后自动启动正式安装版；开发模式不修改系统启动项。
- 中文托盘菜单支持打开、隐藏、打开数据目录、导出、导入和退出。
- 展开面板采用固定 Neutral Glass 冷白材质，支持 `72%–94%` 可调不透明度，默认 `86%`；卡片、文字和危险提示保持独立可读。
- 角色包只提供桌宠图像和动作，更换角色不会改变待办界面的配色、字体或布局。
- 收起桌宠或切换页面时保留详情、表单草稿和 AI 会话，只清理菜单与危险确认。
- 单实例运行；只有托盘“退出”会完全结束应用。

第一版只按日期管理待办，不提供具体时间、系统定时通知、Hermes、飞书或真实 Agent。`0.1.3` 测试版新增可选的大模型直连：自然语言先生成变更提案，用户整批确认后再写入本地数据。

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
npm run dist:win:compatible
```

`dist:win:compatible` 会在 `release/` 生成无需安装的目录版，使用官方签名 Electron 运行时，适合启用了 Windows Smart App Control 的测试电脑。目录必须整体保留，不能只移动其中的 exe。详细使用方式见 [本地正式版使用说明](docs/local-v1-usage.md)。

## 数据与代码边界

- 正式数据：`%APPDATA%\hermes-todo-sidebar\data\state.v1.json`。
- 浏览器 Demo：当前站点的 `localStorage`。
- renderer 只通过 preload IPC 读写数据，不直接访问文件系统。
- Hermes、飞书、提醒和 Agent 均保留独立扩展模块，不写进 UI 组件。
- 大模型直连只在 Electron 主进程联网，API Key 使用 `safeStorage` 加密，完整合同见 `docs/ai-direct-model-contract.md`。
- 未保存的 Base URL 与模型名保存到非敏感草稿；API Key 只留在当前内存。状态生命周期见 `docs/state-management.md`。
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
