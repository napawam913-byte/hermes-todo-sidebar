# 桌宠角色包与动作规范

## 目标

角色包把“角色美术”和“待办功能”分离。以后新增角色时，只需提供角色名称和正面、侧面、背面三视图；开发期完成动作生成与人工验收后，应用会在构建时自动发现角色目录，不需要修改拖动或待办代码。

第一版只加载随应用发布的内置角色包，不支持用户导入外部压缩包，也不会在桌宠应用内调用图像模型。

## 目录合同

```text
apps/desktop/src/renderer/assets/characters/<character-id>/
  character.json   角色 Manifest 与动作行
  atlas.webp       6 列 × 7 行透明图集
  thumbnail.webp   88 × 96 角色选择器缩略图
```

原始三视图、模型生成图和中间透明图放在 `artifacts/character-runs/`。该目录已忽略版本控制，应用资源目录只保留审核后的三个最终文件。

## 图集规格

- 源图集：`1152 × 1456`。
- 单元格：`192 × 208`。
- 列数：固定 `6` 帧。
- 行数：固定 `7` 行。
- 运行时尺寸：`88 × 96`。
- 所有帧必须透明、角色完整、足底基线一致，不允许残留文字、边框或色键背景。

行顺序固定为：

| 行 | 状态 | 视角 |
|---|---|---|
| 0 | 闲置 `idle` | 正面 |
| 1 | 唤醒 `awaken` | 正面 |
| 2 | 向下拖动 `dragging.down` | 正面行走 |
| 3 | 向上拖动 `dragging.up` | 背面行走 |
| 4 | 向右拖动 `dragging.right` | 右侧面行走 |
| 5 | 工作中 `working` | 正面 |
| 6 | 完成 `complete` | 正面 |

`dragging.left` 复用第 4 行并在角色图层上镜像。待办数量徽标、桌宠按钮和面板不会被镜像。

## 运行规则

- 状态优先级：拖动 > 完成 > 工作中 > 唤醒 > 闲置。
- 指针任一轴达到 `4px` 后才进入拖动，点击不会误触行走。
- 拖动方向累计至少 `3px` 才重新判断。
- 横纵轴切换要求新轴达到旧轴的 `1.25` 倍，减少斜向抖动。
- 停止移动 `120ms` 后暂停当前步态帧，继续移动后恢复。
- 松开或取消拖动后回到闲置。
- 减少动态效果模式只显示对应方向的静态第一帧。

## 界面边界

角色包只提供角色身份、图集和动作片段，不控制按钮、卡片、文字、面板或语义状态颜色。桌面待办界面统一使用应用内置的 Neutral Glass 视觉 Token；新增或切换角色不会改变业务界面配色。

旧版 V1 角色包仍可被读取，但会先按旧合同严格校验，再丢弃 `theme` 并规范化为 V2。新角色包必须使用 V2，出现 `theme` 或其他未知顶层字段时会被拒绝。

## 开发期生成流程

1. 准备生成目录：

```powershell
python scripts/pets/prepare_character_pack.py `
  --id penguin-todo `
  --name "企鹅待办助手" `
  --reference "D:\path\角色三视图.png"
```

2. 按生成目录中的 `prompts.md` 生成七条六帧动作图，完成透明化后按状态命名为 `*-transparent.png`。
3. 构建候选包：

```powershell
python scripts/pets/build_character_pack.py `
  --id penguin-todo `
  --name "企鹅待办助手" `
  --strips-dir artifacts/character-runs/penguin-todo/transparent `
  --output-dir artifacts/character-runs/penguin-todo
```

4. 人工检查 `qa/contact-sheet.png` 和七个 WebP 动图，确认身份、裁切、方向、步态、基线和透明背景。
5. 审核通过后显式安装：

```powershell
python scripts/pets/install_character_pack.py `
  --candidate artifacts/character-runs/penguin-todo/candidate `
  --app-root . `
  --approved
```

没有 `--approved` 时安装脚本会拒绝复制，避免未验收素材进入应用。

## Manifest 示例

```json
{
  "schemaVersion": 2,
  "id": "penguin-todo",
  "displayName": "企鹅待办助手",
  "version": "1.0.0",
  "atlas": {
    "columns": 6,
    "rows": 7,
    "cellWidth": 192,
    "cellHeight": 208,
    "renderWidth": 88,
    "renderHeight": 96
  },
  "clips": {
    "idle": { "row": 0, "frames": 6, "durationMs": 1290, "loop": true },
    "awaken": { "row": 1, "frames": 6, "durationMs": 910, "loop": false },
    "dragging": {
      "down": { "row": 2, "frames": 6, "durationMs": 600, "loop": true },
      "up": { "row": 3, "frames": 6, "durationMs": 600, "loop": true },
      "left": { "row": 4, "frames": 6, "durationMs": 600, "loop": true, "mirrorX": true },
      "right": { "row": 4, "frames": 6, "durationMs": 600, "loop": true }
    },
    "working": { "row": 5, "frames": 6, "durationMs": 880, "loop": true },
    "complete": { "row": 6, "frames": 6, "durationMs": 940, "loop": false }
  }
}
```

运行时会严格拒绝未知字段、错误尺寸、缺失动作或越界行号；找不到用户已选角色时回退到 `penguin-todo`，不会阻止应用启动。
