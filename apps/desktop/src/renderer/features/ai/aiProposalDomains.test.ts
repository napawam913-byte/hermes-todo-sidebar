/** 模块用途：验证执行成功页根据操作领域显示正确入口。 */
import { describe, expect, it } from "vitest";
import { getProposalDomains } from "./aiProposalDomains";

describe("getProposalDomains", () => {
  it("识别普通待办、周期任务和混合提案", () => {
    expect(getProposalDomains([
      { type: "todo.create", draft: { title: "训练", date: "2026-07-15" } }
    ])).toEqual({ today: true, cycle: false });
    expect(getProposalDomains([
      { type: "cyclePlan.delete", targetId: "plan_1" }
    ])).toEqual({ today: false, cycle: true });
    expect(getProposalDomains([
      { type: "todo.complete", targetId: "todo_1" },
      { type: "cyclePlan.entry.skip", targetId: "entry_1" }
    ])).toEqual({ today: true, cycle: true });
  });
});
