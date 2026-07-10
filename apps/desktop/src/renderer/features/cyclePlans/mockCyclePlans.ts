/**
 * 模块用途：提供周期计划第一版 demo 数据，验证统一 JSON 内容块的前端回显。
 * 模块边界：只放静态 mock，不包含 Hermes、飞书或 Agent 密钥。
 */
import type { CyclePlan } from "./cyclePlanTypes";

const createdAt = "2026-07-10T08:00:00.000Z";

export const mockCyclePlans: CyclePlan[] = [
  {
    schemaVersion: 2,
    id: "cycle_fitness",
    title: "健身计划",
    topic: "健身",
    description: "按日期拆成具体训练内容，第一版只做待办回显，不追踪重量和热量。",
    status: "active",
    source: { type: "manual" },
    createdAt,
    updatedAt: createdAt,
    entries: [
      {
        schemaVersion: 2,
        id: "cycle_fitness_2026_07_10",
        planId: "cycle_fitness",
        date: "2026-07-10",
        title: "上肢力量训练",
        contentSummary: "6 个动作 · 卧推 / 坐姿划船 / 倒蹬...",
        status: "pending",
        source: { type: "manual" },
        createdAt,
        updatedAt: createdAt,
        contentBlocks: [
          {
            schemaVersion: 2,
            id: "fitness_block_upper",
            kind: "fitness.exercise_list",
            title: "训练动作",
            format: "json",
            data: {
              exercises: [
                {
                  name: "卧推",
                  sets: [
                    { reps: 15, rir: 3 },
                    { reps: 12, rir: 3 },
                    { reps: 12, rir: 3 }
                  ],
                  note: "做到感觉还可以再做 3 个的状态"
                },
                { name: "坐姿划船" },
                { name: "倒蹬" },
                { name: "史密斯推肩" },
                { name: "弯举" },
                { name: "龙门曲臂下压" }
              ]
            }
          }
        ]
      },
      {
        schemaVersion: 2,
        id: "cycle_fitness_2026_07_11",
        planId: "cycle_fitness",
        date: "2026-07-11",
        title: "轻有氧恢复",
        contentSummary: "低强度椭圆机 25 分钟，训练后记录恢复感受",
        status: "pending",
        source: { type: "manual" },
        createdAt,
        updatedAt: createdAt,
        contentBlocks: [
          {
            schemaVersion: 2,
            id: "fitness_block_recovery",
            kind: "fitness.recovery_note",
            title: "恢复安排",
            format: "markdown",
            data: {
              markdown: "- 椭圆机低强度 25 分钟\n- 拉伸肩背和髋部\n- 记录睡眠、酸痛和精神状态"
            }
          }
        ]
      },
      {
        schemaVersion: 2,
        id: "cycle_fitness_2026_07_12",
        planId: "cycle_fitness",
        date: "2026-07-12",
        title: "周复盘",
        contentSummary: "复盘训练完成度，调整下周动作顺序",
        status: "pending",
        source: { type: "manual" },
        createdAt,
        updatedAt: createdAt,
        contentBlocks: [
          {
            schemaVersion: 2,
            id: "fitness_block_review",
            kind: "generic.review",
            title: "复盘问题",
            format: "json",
            data: {
              questions: ["本周完成了几次训练？", "哪个动作最需要调整？", "下周是否增加饮食记录？"]
            }
          }
        ]
      }
    ]
  },
  {
    schemaVersion: 2,
    id: "cycle_learning",
    title: "教程学习计划",
    topic: "学习",
    description: "按章节推进教程，记录当前小节和产出。",
    status: "active",
    source: { type: "ai_draft", proposalId: "proposal_learning_demo" },
    createdAt,
    updatedAt: createdAt,
    entries: [
      {
        schemaVersion: 2,
        id: "cycle_learning_2026_07_10",
        planId: "cycle_learning",
        date: "2026-07-10",
        title: "教程第 3 章学习",
        contentSummary: "第 3 章 · 3.2 小节 · 整理 3 个要点",
        status: "pending",
        source: { type: "ai_draft", proposalId: "proposal_learning_demo" },
        createdAt,
        updatedAt: createdAt,
        contentBlocks: [
          {
            schemaVersion: 2,
            id: "learning_block_section",
            kind: "learning.tutorial_section",
            title: "教程学习进度",
            format: "json",
            data: {
              course: "某教程",
              chapter: "第 3 章",
              section: "3.2 小节",
              task: "阅读并整理 3 个要点"
            }
          }
        ]
      },
      {
        schemaVersion: 2,
        id: "cycle_learning_2026_07_12",
        planId: "cycle_learning",
        date: "2026-07-12",
        title: "教程练习实作",
        contentSummary: "根据第 3 章内容做一次小练习并写笔记",
        status: "pending",
        source: { type: "ai_draft", proposalId: "proposal_learning_demo" },
        createdAt,
        updatedAt: createdAt,
        contentBlocks: [
          {
            schemaVersion: 2,
            id: "learning_block_practice",
            kind: "learning.practice",
            title: "练习任务",
            format: "json",
            data: {
              task: "完成一个最小 demo",
              output: "保存 5 条踩坑笔记",
              checkpoint: "能独立复述核心概念"
            }
          }
        ]
      }
    ]
  }
];
