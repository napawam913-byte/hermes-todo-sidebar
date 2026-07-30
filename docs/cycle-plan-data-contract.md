# 周期计划统一数据合同

## 唯一正式模型

项目只使用 `CyclePlan + CyclePlanEntry + PlanContentBlock`。所有对象都使用 `schemaVersion: 2`，计划条目只包含日期，不包含具体时间。

```json
{
  "schemaVersion": 2,
  "id": "cycle_fitness",
  "title": "健身计划",
  "topic": "健身",
  "description": "按日期安排训练内容",
  "status": "active",
  "source": { "type": "manual" },
  "entries": [
    {
      "schemaVersion": 2,
      "id": "cycle_fitness_2026_07_10",
      "planId": "cycle_fitness",
      "date": "2026-07-10",
      "title": "上肢力量训练",
      "contentSummary": "6 个动作 · 卧推 / 坐姿划船 / 倒蹬...",
      "status": "pending",
      "source": { "type": "manual" },
      "contentBlocks": [
        {
          "schemaVersion": 2,
          "id": "fitness_block_upper",
          "kind": "fitness.exercise_list",
          "title": "训练动作",
          "format": "json",
          "data": {
            "exercises": [
              {
                "name": "卧推",
                "sets": [
                  { "reps": 15, "rir": 3 },
                  { "reps": 12, "rir": 3 },
                  { "reps": 12, "rir": 3 }
                ],
                "note": "做到感觉还可以再做 3 个的状态"
              }
            ]
          }
        }
      ],
      "createdAt": "2026-07-10T08:00:00.000Z",
      "updatedAt": "2026-07-10T08:00:00.000Z"
    }
  ],
  "createdAt": "2026-07-10T08:00:00.000Z",
  "updatedAt": "2026-07-10T08:00:00.000Z"
}
```

## 稳定字段

- `topic`：领域名称，例如健身、学习、饮食。
- `date`：条目命中的日期，格式为 `YYYY-MM-DD`。
- `title`：列表中的短标题。
- `contentSummary`：列表回显摘要，不承担结构化处理。
- `contentBlocks`：领域详情列表，未知类型也必须可以通用展示。
- `source`：来源对象，可包含 `proposalId` 和 `externalId`。

## 状态转换

```text
计划：draft -> active -> paused -> archived
条目：candidate -> pending -> completed
                       \-> skipped
```

`draft` 计划和 `candidate` 条目不会进入今日待办。周期条目完成后直接更新原条目，不复制为普通 `Todo`。

## Hermes/Agent 返回要求

当前直连 API 和未来 Hermes 都必须返回 `AiMutationProposal v1`。创建周期任务时使用 `cyclePlan.create`，完整日期条目统一放在 `draft.entries`；调整周期任务时使用 `cyclePlan.adjust` 请求上下文，并且只允许返回目标计划及其条目的操作。

旧动作 `cyclePlan.createDraft` 仅可作为 Agent 适配层的内部输入，不能直接写入本地仓储。适配层必须先把它转换成标准变更提案，再经过严格校验、用户整批确认和原子写入。

## 内容块扩展规则

- 健身：`fitness.exercise_list`。
- 学习：`learning.tutorial_section`、`learning.practice`。
- 饮食：可使用 `nutrition.*`。
- 新领域只新增 `kind` 和 `data` 约定，不新增另一套计划顶层模型。
- 高频 `kind` 可以增加专用组件，未知 `kind` 继续使用通用 JSON/Markdown 预览。
