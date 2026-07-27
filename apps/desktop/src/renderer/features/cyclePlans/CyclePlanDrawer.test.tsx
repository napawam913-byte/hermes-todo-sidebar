// @vitest-environment jsdom
/** 验证周期条目的永久删除需要二次确认，其他状态操作保持单击。 */
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { CyclePlanDrawer } from "./CyclePlanDrawer";
import { mockCyclePlans } from "./mockCyclePlans";

function findButton(container: HTMLElement, label: string): HTMLButtonElement {
  const button = [...container.querySelectorAll("button")]
    .find((candidate) => candidate.textContent?.includes(label));
  if (!button) throw new Error(`找不到按钮：${label}`);
  return button as HTMLButtonElement;
}

function click(button: HTMLButtonElement) {
  button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
}

describe("CyclePlanDrawer 条目操作", () => {
  it("requires a second click before permanently deleting an entry and resets confirmation", async () => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const onMutate = vi.fn().mockResolvedValue(true);
    const container = document.createElement("div");
    const root = createRoot(container);
    const render = (interactionResetVersion = 0) => root.render(
      <CyclePlanDrawer
        busy={false}
        interactionResetVersion={interactionResetVersion}
        plan={mockCyclePlans[0]}
        todayKey="2026-07-10"
        onAiAdjust={() => undefined}
        onClose={() => undefined}
        onMutate={onMutate}
      />
    );
    await act(async () => { render(); });
    await act(async () => { click(findButton(container, "删除条目")); });
    expect(onMutate).not.toHaveBeenCalled();
    expect(container.textContent).toContain("永久删除此条目");
    await act(async () => { click(findButton(container, "确认永久删除条目")); });
    expect(onMutate).toHaveBeenCalledWith(expect.any(String), [expect.objectContaining({ type: "cyclePlan.entry.delete" })]);
    await act(async () => { render(1); });
    expect(findButton(container, "删除条目").textContent).toContain("删除条目");
  });

  it("keeps non-delete entry actions single-click", async () => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const onMutate = vi.fn().mockResolvedValue(true);
    const container = document.createElement("div");
    const root = createRoot(container);
    await act(async () => { root.render(
      <CyclePlanDrawer busy={false} plan={mockCyclePlans[0]} todayKey="2026-07-10" onAiAdjust={() => undefined} onClose={() => undefined} onMutate={onMutate} />
    ); });
    await act(async () => { click(findButton(container, "完成条目")); });
    expect(onMutate).toHaveBeenCalledWith(expect.any(String), [expect.objectContaining({ type: "cyclePlan.entry.complete" })]);
  });
});
