# 周期计划统一数据结构 v2 设计

## 目标

项目只保留一套正式计划模型：`CyclePlan + CyclePlanEntry + PlanContentBlock`。健身、学习、饮食等领域共用相同外层结构，领域差异只进入 `contentBlocks.kind` 与 `contentBlocks.data`。

## 正式结构

- `CyclePlan`：计划元数据、状态、来源和日期条目集合。
- `CyclePlanEntry`：某个日期命中的待办内容，不包含具体时间。
- `PlanContentBlock`：可扩展 JSON/Markdown 内容块。
- 三层对象都带 `schemaVersion: 2`，避免 Hermes、本地缓存和前端对结构版本产生歧义。
- `source` 改为对象，记录来源类型，并可选保存 `proposalId`、`externalId`。

## 状态规则

- 计划状态：`draft | active | paused | archived`。
- 条目状态：`candidate | pending | completed | skipped`。
- 只有 `active` 计划中日期等于今天且未跳过的条目进入今日待办。
- Agent/Hermes 草稿先使用 `draft` 与 `candidate`，用户确认后再转为 `active` 与 `pending`。

## 数据流

1. 手动编辑或 Hermes 返回统一 `CyclePlan` JSON。
2. 前端仓储在读取时校验并规范化数据。
3. `todayItems.ts` 只读取今天命中的条目，不复制成另一条 `Todo`。
4. 完成周期任务时直接修改对应 `CyclePlanEntry`。
5. 未知 `contentBlocks.kind` 始终由通用 JSON/Markdown 组件展示。

## 兼容与删除

- 删除未接入主界面的 `features/plans` 旧滚动模板、旧 `PlanEntry` Demo 和测试。
- 删除旧计划 Demo 专用样式和过期说明文档。
- `Todo` 不再保存旧 `TodoPlanEntrySnapshot`，周期条目只有一个事实来源。
- 本地仓储兼容读取缺少版本号、使用字符串 `source` 的现有 Demo 数据，并在下次保存时写为 v2。

## Agent 契约

- 新增白名单动作 `cyclePlan.createDraft`。
- 该动作只提交草稿建议，不直接修改本地计划。
- 计划写入与激活仍必须由用户确认，Electron 主进程对该动作保持确认要求。

## 验收

- 健身和学习计划使用同一种外层结构。
- 正式模型不含 `time`、`preferredTime` 或 `durationMinutes`。
- 旧本地数据可被规范化为 v2。
- 今日待办日期匹配和完成逻辑不回归。
- 删除旧文件后 TypeScript、测试和生产构建全部通过。
