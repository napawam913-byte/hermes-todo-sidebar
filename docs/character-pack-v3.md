# CharacterPack V3 角色模板

## 目标

应用只产生统一语义状态，角色包只提供动作图像。新增角色时，开发期输入角色 ID、中文名称和正面/侧面/背面三视图，生成候选素材并人工验收；运行时代码、Neutral Glass 界面和业务数据不随角色变化。

## 固定图集

- 图集：`1152×2912` WebP，必须包含透明通道。
- 布局：`6 列 × 14 行`，每行固定六帧。
- 单元格：`192×208`；运行时显示：`88×96`。
- 每行第一帧必须可独立显示；六帧必须非空、角色完整、足底基线一致。
- 禁止文字、边框、地面阴影、漂浮符号、分离特效和残留背景。

| 行 | 槽位 | 统一播放规则 |
|---|---|---|
| 0 | `idle.base` | 轻呼吸，4800ms 循环 |
| 1 | `idle.blink` | 360ms 单次，每 8–14 秒触发 |
| 2 | `awaken` | 840ms 单次 |
| 3 | `dragging.down` | 600ms 正面行走循环 |
| 4 | `dragging.up` | 600ms 背面行走循环 |
| 5 | `dragging.right` | 600ms 右向侧面行走循环 |
| 6 | `dragging.left` | 600ms 左向侧面行走循环 |
| 7 | `thinking` | 2800ms 循环 |
| 8 | `working` | 1400ms 循环 |
| 9 | `waiting` | 3200ms 低频循环 |
| 10 | `reminding` | 800ms 单次并短暂停留 |
| 11 | `complete` | 900ms 单次 |
| 12 | `error` | 900ms 单次 |
| 13 | `sleeping` | 6000ms 循环 |

播放时长、优先级和触发条件由 `petBehaviorTemplate.ts` 统一管理，不写入 `character.json`，也不允许角色单独覆盖速度。

## 状态协调

优先级固定为：

`dragging > error > complete > reminding > awaken > working > thinking > waiting > sleeping > idle`

- 一次性事件最多缓存一个；高优先级覆盖低优先级，同优先级保留最新事件。
- 拖动停止 120ms 后显示当前方向第一帧站姿，继续移动后恢复步态。
- 工作操作短于 180ms 不显示；显示后至少保持 450ms。
- 收起并连续无操作 20 分钟后睡眠；点击、拖动、请求或数据操作会唤醒。
- 每日首次展开且有今日/逾期待办时提醒一次；运行中新增匹配条目再提醒一次。
- `prefers-reduced-motion` 下不逐帧播放，只显示对应状态的指定静态帧。

## Manifest

```json
{
  "schemaVersion": 3,
  "id": "penguin-todo-v3",
  "displayName": "企鹅待办助手 V3",
  "version": "3.0.0",
  "atlas": {
    "columns": 6,
    "rows": 14,
    "cellWidth": 192,
    "cellHeight": 208,
    "renderWidth": 88,
    "renderHeight": 96
  },
  "clips": {
    "idle": { "base": { "row": 0 }, "blink": { "row": 1 } },
    "awaken": { "row": 2 },
    "dragging": {
      "down": { "row": 3 }, "up": { "row": 4 },
      "right": { "row": 5 }, "left": { "row": 6 }
    },
    "thinking": { "row": 7 },
    "working": { "row": 8 },
    "waiting": { "row": 9 },
    "reminding": { "row": 10 },
    "complete": { "row": 11 },
    "error": { "row": 12 },
    "sleeping": { "row": 13 }
  }
}
```

未知字段、错误尺寸、错误行号和非法角色 ID 会被拒绝。V1/V2 包先严格校验，再映射到 V3 运行时槽位；缺少状态使用固定回退动作。

## 开发期流程

```powershell
python scripts/pets/prepare_character_pack.py `
  --id penguin-todo-v3 `
  --name "企鹅待办助手 V3" `
  --reference "D:\path\角色三视图.png"

python scripts/pets/build_character_pack.py `
  --id penguin-todo-v3 `
  --name "企鹅待办助手 V3" `
  --strips-dir artifacts/character-runs/penguin-todo-v3/transparent `
  --output-dir artifacts/character-runs/penguin-todo-v3 `
  --mirror-left

python scripts/pets/install_character_pack.py `
  --candidate artifacts/character-runs/penguin-todo-v3/candidate `
  --app-root . `
  --approved
```

`--approved` 只能在人工检查联系表和 14 个动画预览后使用。安装器拒绝覆盖已安装目录，失败候选不会影响当前角色。

## 默认角色迁移

企鹅 V3 人工验收通过后，应用默认角色改为 `penguin-todo-v3`，外观设置升级为
`schemaVersion: 4`。读取旧版配置时，仅将历史默认值 `penguin-todo` 迁移到 V3；
用户在新版角色选择器中主动选择旧 V2 后仍会保留该选择。旧资源继续随应用发布，作为
V1/V2 兼容与视觉回退，不修改待办、周期计划或透明度数据。
