/**
 * 模块用途：验证通用分段控制器的选择、禁用和无障碍语义。
 * 模块边界：不覆盖页面级样式或业务筛选逻辑。
 */
import { Children, isValidElement, type ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { SegmentedControl } from "./SegmentedControl";

const options = [
  { value: "today", label: "今日待办" },
  { value: "cycle", label: "周期任务" }
] as const;

type ButtonElement = ReactElement<{
  disabled?: boolean;
  "aria-pressed": boolean;
  onClick: () => void;
}>;

function buttonsFrom(element: ReturnType<typeof SegmentedControl>): ButtonElement[] {
  return Children.toArray(element.props.children).filter(
    (child): child is ButtonElement => isValidElement(child)
  );
}

describe("SegmentedControl", () => {
  it("点击未选项时回传对应 value", () => {
    const onChange = vi.fn();
    const control = SegmentedControl({
      ariaLabel: "主导航",
      onChange,
      options,
      value: "today"
    });

    const [, cycleButton] = buttonsFrom(control);
    cycleButton.props.onClick();

    expect(onChange).toHaveBeenCalledWith("cycle");
  });

  it("将当前项标记为按下状态", () => {
    const control = SegmentedControl({
      ariaLabel: "主导航",
      onChange: vi.fn(),
      options,
      value: "cycle"
    });

    const [todayButton, cycleButton] = buttonsFrom(control);
    expect(todayButton.props["aria-pressed"]).toBe(false);
    expect(cycleButton.props["aria-pressed"]).toBe(true);
  });

  it("禁用时不触发选择", () => {
    const onChange = vi.fn();
    const control = SegmentedControl({
      ariaLabel: "主导航",
      disabled: true,
      onChange,
      options,
      value: "today"
    });

    const [, cycleButton] = buttonsFrom(control);
    cycleButton.props.onClick();

    expect(onChange).not.toHaveBeenCalled();
    expect(cycleButton.props.disabled).toBe(true);
  });
});
