# Neutral Glass UI and Character Decoupling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将桌宠应用统一为不受角色和壁纸色相影响的中性磨砂玻璃界面，并将角色包升级为只包含角色动作资源的 `CharacterPack v2`。

**Architecture:** 全局视觉由固定的 `Neutral Glass` Token 层管理，透明度只改变中性面板 Alpha；角色注册表把 V1/V2 Manifest 规范化为无主题字段的 V2。布局通过面板容器宽度切换单页与 `40/60` 主从视图，业务数据和 Electron 窗口坐标协议保持不变。

**Tech Stack:** Electron 43、React 19、TypeScript 5.7、Vite 7、Vitest 3、CSS Container Queries、Figma。

## Global Constraints

- Figma 最新画板截图验收通过前，不修改运行时代码。
- 复用 Figma 文件 `YjDqATxuYpFqkb3TzL4cfj`，不创建新文件。
- 面板固定使用中性冷白材质，主操作色固定为 `#007AFF`。
- 新安装默认透明度为 `86%`，可调范围固定为 `72%` 至 `94%`。
- 角色包不得控制按钮、卡片、文字、面板或语义状态颜色。
- `720px` 以上在选中详情时采用 `40%` 列表和 `60%` 详情；更窄时使用同面板切页。
- 不改变待办、周期计划、AI 提案、拖动 IPC 或本地数据合同。
- 不引入新的状态库和视觉 UI 框架。
- 所有 TS、TSX、CSS 文件不超过 220 行，中文文档保持 UTF-8。
- 不覆盖或删除当前 `0.1.3-test.12`，最终生成 `0.1.3-test.13` 免安装测试副本。
- 当前工作区已有大量未提交修改；每次只暂存本任务明确列出的文件，不回退其他修改。
- 每次提交前运行 `git diff --cached --name-only`；出现任务文件清单以外的路径时立即停止提交并先解除误暂存。

---

### Task 1: 在 Figma 固化中性玻璃设计系统

**Files:**
- Modify: `figma/nodes.json`
- Modify: `figma/README.md`
- Modify: `figma/validation.md`

**Interfaces:**
- Consumes: 设计规范 `docs/superpowers/specs/2026-07-20-neutral-glass-character-decoupling-design.md`
- Produces: 已截图验收的颜色 Token、组件、宽窄状态和最新节点记录，作为后续代码唯一视觉依据。

- [ ] **Step 1: 加载 Figma 操作规范和现有文件上下文**

执行前依次加载 `figma-use` 与 `figma-generate-design` skill，打开 fileKey `YjDqATxuYpFqkb3TzL4cfj`，确认现有页面和待替代画板 ID。

- [ ] **Step 2: 创建固定视觉 Token 区**

在 `02 Components` 中建立可编辑的颜色、字体、圆角、阴影和透明材质样本，名称使用：

```text
Color/Text/Primary          #1D1D1F
Color/Text/Secondary        #6E6E73
Color/Accent/Default        #007AFF
Color/Accent/Soft           rgba(0,122,255,0.12)
Material/Panel/86           rgba(246,247,249,0.86)
Material/Card/92            rgba(255,255,255,0.92)
Material/Control            rgba(118,118,128,0.12)
Border/Hairline             rgba(60,60,67,0.16)
```

- [ ] **Step 3: 更新公共组件**

创建或更新 `SegmentedControl`、`IconButton`、`PrimaryButton`、`TodoCard`、`CyclePlanCard`、`DetailPane`、`CharacterPicker`。所有组件使用固定蓝色与中性色，不引用企鹅橙色。

- [ ] **Step 4: 创建四个最新主画板**

```text
中性玻璃 - 宽屏今日待办       854 × 581
中性玻璃 - 窄屏今日待办       360 × 581
中性玻璃 - 宽屏主从详情       854 × 581，40/60
中性玻璃 - 外观设置与角色选择 854 × 581
```

宽屏默认页的主要内容最大宽度按 `760px` 表现；窄屏详情使用返回按钮，不显示横向滚动。

- [ ] **Step 5: 在三种背景上截图验收**

分别使用白色文档、蓝灰照片和深色壁纸作为画板后方参考，确认面板仍保持中性冷白，文字不溢出、按钮不重叠、选中状态清晰。

- [ ] **Step 6: 清理旧画板并更新记录**

仅在新画板截图通过后删除被替代的橙色主题画板，横向排列剩余画板；把最新节点 ID、截图结论和中文说明写入 `figma/nodes.json`、`figma/validation.md` 与 `figma/README.md`。

- [ ] **Step 7: 提交 Figma 交接记录**

```bash
git add figma/nodes.json figma/README.md figma/validation.md
git commit -m "design: define neutral glass desktop UI"
```

**Gate:** 用户截图审核通过后才能执行 Task 2。

---

### Task 2: 将角色协议升级为 CharacterPack v2

**Files:**
- Modify: `apps/desktop/src/renderer/features/sidebar/characterPack.ts`
- Modify: `apps/desktop/src/renderer/features/sidebar/characterPackValidation.test.ts`
- Modify: `apps/desktop/src/renderer/features/sidebar/characterRegistry.ts`
- Modify: `apps/desktop/src/renderer/features/sidebar/builtInCharacterRegistry.ts`
- Modify: `apps/desktop/src/renderer/features/sidebar/PetSprite.test.tsx`
- Modify: `apps/desktop/src/renderer/assets/characters/penguin-todo/character.json`
- Modify: `scripts/pets/build_character_pack.py`
- Modify: `docs/character-pack-spec.md`

**Interfaces:**
- Consumes: V1 Manifest 或 V2 Manifest 原始 JSON。
- Produces: `normalizeCharacterPackManifest(value): CharacterPackManifestV2`，运行时只暴露无 `theme` 的 V2。

- [ ] **Step 1: 写入失败测试**

在 `characterPackValidation.test.ts` 增加：V2 可加载、V1 会丢弃 `theme`、V2 出现 `theme` 会拒绝、缺少动作会拒绝、注册表缺失角色会回退默认角色。

```ts
it("把 v1 主题角色包规范化为无主题的 v2", () => {
  const normalized = normalizeCharacterPackManifest(validV1Manifest);
  expect(normalized.schemaVersion).toBe(2);
  expect("theme" in normalized).toBe(false);
  expect(normalized.id).toBe("penguin-todo");
});
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `npm test -- apps/desktop/src/renderer/features/sidebar/characterPackValidation.test.ts`

Expected: FAIL，提示 `normalizeCharacterPackManifest` 尚不存在或 V2 未支持。

- [ ] **Step 3: 定义 V2 与兼容适配器**

```ts
export interface CharacterPackManifestV2 {
  schemaVersion: 2;
  id: string;
  displayName: string;
  version: string;
  atlas: CharacterAtlas;
  clips: CharacterClips;
}

export function normalizeCharacterPackManifest(
  value: unknown
): CharacterPackManifestV2;
```

V1 先按旧合同严格校验，再复制 `id/displayName/version/atlas/clips` 并设置 `schemaVersion: 2`；V2 必须精确校验顶层字段且禁止 `theme`。

- [ ] **Step 4: 让注册表与内置资源只消费 V2**

`CharacterPack.manifest` 改为 `CharacterPackManifestV2`；`createCharacterRegistry` 在建立 Map 前调用规范化函数。把默认企鹅 `character.json` 升级到 V2 并删除 `theme`。

- [ ] **Step 5: 清理角色生成脚本主题参数**

从 `build_character_pack.py` 删除 `--accent`、`--accent-strong`、`--accent-soft` 和 `--surface-tint`，生成 JSON 时不再写入 `theme`。

- [ ] **Step 6: 运行角色与 Sprite 测试**

Run: `npm test -- apps/desktop/src/renderer/features/sidebar/characterPackValidation.test.ts apps/desktop/src/renderer/features/sidebar/PetSprite.test.tsx`

Expected: PASS，角色方向、镜像和动作片段行为不变。

- [ ] **Step 7: 提交角色协议迁移**

```bash
git add apps/desktop/src/renderer/features/sidebar/characterPack.ts apps/desktop/src/renderer/features/sidebar/characterPackValidation.test.ts apps/desktop/src/renderer/features/sidebar/characterRegistry.ts apps/desktop/src/renderer/features/sidebar/builtInCharacterRegistry.ts apps/desktop/src/renderer/features/sidebar/PetSprite.test.tsx apps/desktop/src/renderer/assets/characters/penguin-todo/character.json scripts/pets/build_character_pack.py docs/character-pack-spec.md
git commit -m "refactor: decouple character packs from UI theme"
```

---

### Task 3: 迁移外观设置与透明度规则

**Files:**
- Modify: `apps/desktop/src/renderer/features/appearance/appearanceSettings.ts`
- Modify: `apps/desktop/src/renderer/features/appearance/appearanceSettings.test.ts`
- Modify: `apps/desktop/src/renderer/features/appearance/AppearanceSettingsPanel.tsx`
- Modify: `apps/desktop/src/renderer/features/appearance/AppearanceSettingsPanel.test.tsx`
- Modify: `apps/desktop/src/renderer/features/appearance/CharacterPicker.test.tsx`

**Interfaces:**
- Consumes: schema v1、v2 或 v3 外观设置。
- Produces: `AppearanceSettingsV3`，只包含 `panelOpacity` 与 `characterId`。

- [ ] **Step 1: 写入迁移失败测试**

```ts
it("把旧默认 78 迁移为新默认 86，并保留自定义值", () => {
  expect(loadFrom({ schemaVersion: 2, panelOpacity: 78, characterId: "penguin-todo" })
    .panelOpacity).toBe(86);
  expect(loadFrom({ schemaVersion: 2, panelOpacity: 82, characterId: "penguin-todo" })
    .panelOpacity).toBe(82);
});
```

同时测试新范围把 `60` 规范化为 `72`、把 `100` 规范化为 `94`，V3 保存和重载保持一致。

- [ ] **Step 2: 运行测试并确认失败**

Run: `npm test -- apps/desktop/src/renderer/features/appearance/appearanceSettings.test.ts`

Expected: FAIL，当前默认值仍为 `78`，范围仍为 `60..95`。

- [ ] **Step 3: 实现 schema v3**

```ts
export const DEFAULT_PANEL_OPACITY = 86;
export const MIN_PANEL_OPACITY = 72;
export const MAX_PANEL_OPACITY = 94;

export interface AppearanceSettings {
  schemaVersion: 3;
  panelOpacity: number;
  characterId: string;
}
```

V2 仅在值恰好为历史默认 `78` 时迁移到 `86`，其他值经过新范围约束后保留。

- [ ] **Step 4: 更新设置页文案**

把“角色会带来界面强调色”改为“角色只改变桌宠外观和动作，待办界面保持一致”。滑块显示 `72%` 至 `94%`，并保持受控状态。

- [ ] **Step 5: 运行外观测试**

Run: `npm test -- apps/desktop/src/renderer/features/appearance`

Expected: PASS，角色选择与透明度持久化互不影响。

- [ ] **Step 6: 提交外观迁移**

```bash
git add apps/desktop/src/renderer/features/appearance/appearanceSettings.ts apps/desktop/src/renderer/features/appearance/appearanceSettings.test.ts apps/desktop/src/renderer/features/appearance/AppearanceSettingsPanel.tsx apps/desktop/src/renderer/features/appearance/AppearanceSettingsPanel.test.tsx apps/desktop/src/renderer/features/appearance/CharacterPicker.test.tsx
git commit -m "feat: migrate neutral glass appearance settings"
```

---

### Task 4: 建立固定 Neutral Glass Token 层

**Files:**
- Create: `apps/desktop/src/renderer/styles/neutral-glass-tokens.css`
- Create: `apps/desktop/src/renderer/styles/neutralGlassTokens.test.ts`
- Modify: `apps/desktop/src/renderer/styles/tokens.css`
- Modify: `apps/desktop/src/renderer/styles/global.css`
- Modify: `apps/desktop/src/renderer/styles/anchored-popover.css`
- Modify: `apps/desktop/src/renderer/features/sidebar/SidebarShell.tsx`
- Modify: `apps/desktop/src/renderer/features/todos/TodoPanelSession.test.tsx`

**Interfaces:**
- Consumes: `panelOpacity` 数值。
- Produces: 固定 `--ui-*` 颜色 Token 与只包含几何/透明度变量的 `SidebarShell` style。

- [ ] **Step 1: 写入静态合同失败测试**

`neutralGlassTokens.test.ts` 读取 CSS 和 `SidebarShell.tsx`，断言存在 `#007AFF`、`--ui-panel-rgb: 246 247 249`，并且不再出现 `--character-surface-tint` 或 `manifest.theme`。

```ts
expect(tokens).toContain("--ui-accent: #007aff");
expect(shell).not.toContain("manifest.theme");
expect(popover).not.toContain("--character-surface-tint");
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `npm test -- apps/desktop/src/renderer/styles/neutralGlassTokens.test.ts`

Expected: FAIL，旧角色主题变量仍存在。

- [ ] **Step 3: 创建中性 Token 文件**

```css
:root {
  --ui-panel-rgb: 246 247 249;
  --ui-surface: rgb(255 255 255 / 0.92);
  --ui-control: rgb(118 118 128 / 0.12);
  --ui-border: rgb(60 60 67 / 0.16);
  --ui-text: #1d1d1f;
  --ui-text-secondary: #6e6e73;
  --ui-text-tertiary: #8e8e93;
  --ui-accent: #007aff;
  --ui-accent-hover: #0066d6;
  --ui-accent-soft: rgb(0 122 255 / 0.12);
}
```

`tokens.css` 只保留间距、固定尺寸、圆角和非颜色基础 Token；`global.css` 在组件 CSS 前导入中性 Token。

- [ ] **Step 4: 解除 SidebarShell 的角色主题注入**

删除 `theme` 读取与四个角色颜色 CSS 变量，仅保留面板尺寸、锚点、透明度和交互状态。`anchored-popover.css` 使用：

```css
background: rgb(var(--ui-panel-rgb) / var(--panel-opacity));
backdrop-filter: blur(28px) saturate(1.08);
```

在 `prefers-reduced-transparency` 中关闭 Blur 并提升到 `0.96`。

- [ ] **Step 5: 运行 Token 与会话测试**

Run: `npm test -- apps/desktop/src/renderer/styles/neutralGlassTokens.test.ts apps/desktop/src/renderer/features/todos/TodoPanelSession.test.tsx`

Expected: PASS，角色切换不会改变壳层颜色变量，面板会话行为不变。

- [ ] **Step 6: 提交 Token 层**

```bash
git add apps/desktop/src/renderer/styles/neutral-glass-tokens.css apps/desktop/src/renderer/styles/neutralGlassTokens.test.ts apps/desktop/src/renderer/styles/tokens.css apps/desktop/src/renderer/styles/global.css apps/desktop/src/renderer/styles/anchored-popover.css apps/desktop/src/renderer/features/sidebar/SidebarShell.tsx apps/desktop/src/renderer/features/todos/TodoPanelSession.test.tsx
git commit -m "style: add neutral glass material tokens"
```

---

### Task 5: 统一分段控制器、按钮和卡片表面

**Files:**
- Create: `apps/desktop/src/renderer/components/SegmentedControl.tsx`
- Create: `apps/desktop/src/renderer/components/SegmentedControl.test.tsx`
- Modify: `apps/desktop/src/renderer/features/todos/TopModeTabs.tsx`
- Modify: `apps/desktop/src/renderer/features/todos/TodayTodoView.tsx`
- Modify: `apps/desktop/src/renderer/styles/todo-panel.css`
- Modify: `apps/desktop/src/renderer/styles/buttons.css`
- Modify: `apps/desktop/src/renderer/styles/todo-item.css`
- Modify: `apps/desktop/src/renderer/styles/cycle-plan.css`
- Modify: `apps/desktop/src/renderer/styles/todo-state.css`

**Interfaces:**
- Consumes: `SegmentedOption<T>[]`、当前值和切换回调。
- Produces: 今日/周期主导航和待办筛选共用的 `SegmentedControl<T>`。

- [ ] **Step 1: 写入分段控件失败测试**

```tsx
render(<SegmentedControl
  ariaLabel="模式"
  value="today"
  options={[{ value: "today", label: "今日待办" }, { value: "cycle", label: "周期任务" }]}
  onChange={onChange}
/>);
fireEvent.click(screen.getByRole("button", { name: "周期任务" }));
expect(onChange).toHaveBeenCalledWith("cycle");
```

断言选中项具有 `aria-pressed="true"`，禁用时不触发回调。

- [ ] **Step 2: 运行测试并确认失败**

Run: `npm test -- apps/desktop/src/renderer/components/SegmentedControl.test.tsx`

Expected: FAIL，组件尚不存在。

- [ ] **Step 3: 实现公共分段控件并替换两套 Tabs**

```ts
export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

export function SegmentedControl<T extends string>(props: {
  ariaLabel: string;
  value: T;
  options: SegmentedOption<T>[];
  onChange(value: T): void;
  size?: "regular" | "compact";
}): ReactElement;
```

`TopModeTabs` 使用 regular，今日筛选使用 compact。选中块使用白色表面和轻阴影，不再绘制下划线。

- [ ] **Step 4: 重绘按钮和卡片状态**

主按钮使用 `--ui-accent`，Quiet 按钮使用 `--ui-control`；卡片使用 `--ui-surface` 和 Hairline。删除待办卡片的角色色竖条，选中卡片使用 `--ui-accent-soft`。

- [ ] **Step 5: 运行组件与待办测试**

Run: `npm test -- apps/desktop/src/renderer/components/SegmentedControl.test.tsx apps/desktop/src/renderer/features/todos/TodayTodoCard.test.tsx apps/desktop/src/renderer/features/todos/ManualInteractionViews.test.tsx`

Expected: PASS，新增、完成、更多菜单和筛选仍可用。

- [ ] **Step 6: 提交公共组件与表面样式**

```bash
git add apps/desktop/src/renderer/components/SegmentedControl.tsx apps/desktop/src/renderer/components/SegmentedControl.test.tsx apps/desktop/src/renderer/features/todos/TopModeTabs.tsx apps/desktop/src/renderer/features/todos/TodayTodoView.tsx apps/desktop/src/renderer/styles/todo-panel.css apps/desktop/src/renderer/styles/buttons.css apps/desktop/src/renderer/styles/todo-item.css apps/desktop/src/renderer/styles/cycle-plan.css apps/desktop/src/renderer/styles/todo-state.css
git commit -m "style: unify navigation and task surfaces"
```

---

### Task 6: 实现可复用的响应式主从布局

**Files:**
- Create: `apps/desktop/src/renderer/components/ResponsiveMasterDetail.tsx`
- Create: `apps/desktop/src/renderer/components/ResponsiveMasterDetail.test.tsx`
- Create: `apps/desktop/src/renderer/features/todos/TodayTodoListPane.tsx`
- Create: `apps/desktop/src/renderer/features/cyclePlans/CyclePlanListPane.tsx`
- Create: `apps/desktop/src/renderer/styles/responsive-panel.css`
- Modify: `apps/desktop/src/renderer/styles/global.css`
- Modify: `apps/desktop/src/renderer/features/todos/TodayTodoView.tsx`
- Modify: `apps/desktop/src/renderer/features/cyclePlans/CyclePlanView.tsx`
- Modify: `apps/desktop/src/renderer/styles/detail-page.css`
- Modify: `apps/desktop/src/renderer/styles/todo-panel.css`
- Modify: `apps/desktop/src/renderer/styles/cycle-plan.css`

**Interfaces:**
- Consumes: 主列表 ReactNode、可选详情 ReactNode。
- Produces: `ResponsiveMasterDetail`，同一 DOM 在窄屏切页、宽屏显示 `40/60` 双栏。

- [ ] **Step 1: 写入结构失败测试**

```tsx
render(<ResponsiveMasterDetail
  master={<div>列表</div>}
  detail={<div>详情</div>}
/>);
expect(screen.getByText("列表")).toBeInTheDocument();
expect(screen.getByText("详情")).toBeInTheDocument();
expect(screen.getByTestId("master-detail")).toHaveClass("has-detail");
```

无详情时断言只有主区域且带 `is-master-only`。

- [ ] **Step 2: 运行测试并确认失败**

Run: `npm test -- apps/desktop/src/renderer/components/ResponsiveMasterDetail.test.tsx`

Expected: FAIL，组件尚不存在。

- [ ] **Step 3: 实现布局壳与容器查询**

```css
.responsive-master-detail { container-type: inline-size; }
.master-detail-grid { display: grid; width: 100%; min-height: 0; }

@container (min-width: 720px) {
  .has-detail .master-detail-grid {
    grid-template-columns: minmax(280px, 2fr) minmax(0, 3fr);
  }
}
```

窄屏有详情时隐藏主区域；宽屏同时显示两栏并各自滚动。无详情时 `.master-pane-inner` 使用 `max-width: 760px; margin-inline: auto`。

- [ ] **Step 4: 拆出今日待办列表 Pane**

把摘要、筛选、快速新增和列表移到 `TodayTodoListPane.tsx`，`TodayTodoView` 只管理选择、菜单、编辑状态并组合主从布局，确保每个文件不超过 220 行。

- [ ] **Step 5: 拆出周期计划列表 Pane**

把周期页标题、AI 主按钮、空状态和计划卡移到 `CyclePlanListPane.tsx`。`CyclePlanView` 选中计划时把 `CyclePlanDrawer` 放入详情 Pane，而不是替换整个视图。

- [ ] **Step 6: 运行主从布局和业务测试**

Run: `npm test -- apps/desktop/src/renderer/components/ResponsiveMasterDetail.test.tsx apps/desktop/src/renderer/features/todos/ManualInteractionViews.test.tsx apps/desktop/src/renderer/features/cyclePlans/CyclePlanActions.test.tsx`

Expected: PASS，列表选择、详情返回、AI 调整和状态操作保持正常。

- [ ] **Step 7: 提交响应式布局**

```bash
git add apps/desktop/src/renderer/components/ResponsiveMasterDetail.tsx apps/desktop/src/renderer/components/ResponsiveMasterDetail.test.tsx apps/desktop/src/renderer/features/todos/TodayTodoListPane.tsx apps/desktop/src/renderer/features/cyclePlans/CyclePlanListPane.tsx apps/desktop/src/renderer/styles/responsive-panel.css apps/desktop/src/renderer/styles/global.css apps/desktop/src/renderer/features/todos/TodayTodoView.tsx apps/desktop/src/renderer/features/cyclePlans/CyclePlanView.tsx apps/desktop/src/renderer/styles/detail-page.css apps/desktop/src/renderer/styles/todo-panel.css apps/desktop/src/renderer/styles/cycle-plan.css
git commit -m "feat: add responsive task master detail layout"
```

---

### Task 7: 统一设置、详情和 AI 页面材质

**Files:**
- Modify: `apps/desktop/src/renderer/styles/appearance-settings.css`
- Modify: `apps/desktop/src/renderer/styles/todo-detail.css`
- Modify: `apps/desktop/src/renderer/styles/cycle-drawer.css`
- Modify: `apps/desktop/src/renderer/styles/ai-planner.css`
- Modify: `apps/desktop/src/renderer/styles/ai-flow-nav.css`
- Modify: `apps/desktop/src/renderer/styles/ai-conversation.css`
- Modify: `apps/desktop/src/renderer/styles/ai-composer.css`
- Modify: `apps/desktop/src/renderer/styles/ai-proposal.css`
- Modify: `apps/desktop/src/renderer/styles/ai-execution.css`
- Modify: `apps/desktop/src/renderer/styles/manual-mutation.css`
- Modify: `apps/desktop/src/renderer/styles/status-menu.css`
- Modify: `docs/frontend-component-map.md`
- Modify: `docs/frontend-motion-spec.md`

**Interfaces:**
- Consumes: Task 4 的 `--ui-*` Token。
- Produces: 所有工作页面一致的中性表面、焦点和语义状态。

- [ ] **Step 1: 增加旧主题残留扫描测试**

扩展 `neutralGlassTokens.test.ts`，扫描 renderer CSS，拒绝旧暖色 Oklch 色相、`--accent-strong`、`--character-surface-tint` 和角色专属颜色。

- [ ] **Step 2: 运行测试并列出残留文件**

Run: `npm test -- apps/desktop/src/renderer/styles/neutralGlassTokens.test.ts`

Expected: FAIL，并显示仍引用旧主题变量的 CSS 文件。

- [ ] **Step 3: 按功能逐个替换材质变量**

普通状态只使用 `--ui-surface`、`--ui-control`、`--ui-border` 与文字 Token；创建/选中使用蓝色；成功、警告、删除只使用对应语义 Token。不得新增角色 ID 选择器。

- [ ] **Step 4: 校正动效与焦点**

分段切换 `140ms`，详情进入 `180ms`，按钮按下 `0.98`；减少动效模式取消位移和缩放。所有交互控件使用统一 `2px` 淡蓝焦点环。

- [ ] **Step 5: 更新中文组件与动效文档**

记录 Neutral Glass Token、主从断点、角色与 UI 解耦边界、透明度范围、设置迁移和所有状态动效。

- [ ] **Step 6: 运行 AI、详情和样式测试**

Run: `npm test -- apps/desktop/src/renderer/features/ai apps/desktop/src/renderer/components/DetailPageShell.test.tsx apps/desktop/src/renderer/styles`

Expected: PASS，AI 对话、提案确认和详情操作未因样式重构退化。

- [ ] **Step 7: 提交完整视觉统一**

```bash
git add apps/desktop/src/renderer/styles/appearance-settings.css apps/desktop/src/renderer/styles/todo-detail.css apps/desktop/src/renderer/styles/cycle-drawer.css apps/desktop/src/renderer/styles/ai-planner.css apps/desktop/src/renderer/styles/ai-flow-nav.css apps/desktop/src/renderer/styles/ai-conversation.css apps/desktop/src/renderer/styles/ai-composer.css apps/desktop/src/renderer/styles/ai-proposal.css apps/desktop/src/renderer/styles/ai-execution.css apps/desktop/src/renderer/styles/manual-mutation.css apps/desktop/src/renderer/styles/status-menu.css docs/frontend-component-map.md docs/frontend-motion-spec.md
git commit -m "style: apply neutral glass across desktop flows"
```

---

### Task 8: 完整验证、视觉验收和 test.13 打包

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `figma/validation.md`
- Modify: `README.md`
- Modify: `docs/local-v1-usage.md`

**Interfaces:**
- Consumes: Task 1 至 Task 7 的最终 UI 和角色协议。
- Produces: 经验证的 `0.1.3-test.13` 免安装测试目录副本。

- [ ] **Step 1: 运行完整单元测试**

Run: `npm test`

Expected: 所有测试文件和用例 PASS，无未处理 Promise 或 React 警告。

- [ ] **Step 2: 运行类型和文件体积检查**

Run: `npm run typecheck`

Expected: Exit 0。

Run: `npm test -- apps/desktop/src/renderer/styles/sourceFileSize.test.ts`

Expected: 所有 TS、TSX、CSS 文件不超过 220 行。

- [ ] **Step 3: 构建生产代码**

Run: `npm run build`

Expected: Electron 主进程和 Vite renderer 均构建成功。

- [ ] **Step 4: 在浏览器和真实 Electron 中视觉验收**

在 `http://127.0.0.1:5178/` 与 Electron 中分别检查 `360px`、`854px`、`960px` 面板；使用白色、蓝灰和深色桌面背景。记录：综合色相、主从比例、滚动、焦点、长标题、AI 长对话、角色切换和减少透明度模式。

- [ ] **Step 5: 更新版本并生成兼容免安装目录**

把 `package.json` 和 `package-lock.json` 版本改为 `0.1.3-test.13`。

Run: `npm run dist:win:compatible`

Expected: 创建 `release/hermes-todo-sidebar-0.1.3-test.13-x64-portable-dir/`，且 `0.1.3-test.12` 仍存在。

- [ ] **Step 6: 启动测试副本并执行桌面验收**

验证拖动四向行走、点击展开、失焦收起、今日/周期切换、主从详情、角色选择、透明度持久化、AI 页面和重启恢复。

- [ ] **Step 7: 更新验收记录并提交**

```bash
git add package.json package-lock.json figma/validation.md README.md docs/local-v1-usage.md
git commit -m "release: prepare neutral glass test.13"
```

## Final Acceptance Checklist

- [ ] Figma 只保留最新有效中性玻璃画板，节点无重叠。
- [ ] 横版和竖版使用完全相同的颜色 Token。
- [ ] 角色切换不会改变任何业务界面颜色。
- [ ] 白色、蓝灰和深色背景下文字与控件保持清晰。
- [ ] 今日待办和周期计划均支持宽屏主从详情与窄屏切页。
- [ ] 所有业务交互、AI 提案、拖动和持久化回归测试通过。
- [ ] `0.1.3-test.12` 未覆盖，`0.1.3-test.13` 可独立启动。
