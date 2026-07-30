"""Prepare an ignored character-generation run from a three-view reference."""

from __future__ import annotations

import argparse
import json
import re
import shutil
from pathlib import Path

from character_pack_v3 import STATE_NAMES

STATES = STATE_NAMES


def create_generation_request(
    character_id: str,
    display_name: str,
    reference_name: str,
) -> dict[str, object]:
    """创建供图像生成流程消费的十四行动作任务。"""
    return {
        "schemaVersion": 3,
        "id": character_id,
        "displayName": display_name,
        "reference": reference_name,
        "states": list(STATES),
        "frameCount": 6,
        "status": "awaiting-generation",
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="准备桌宠角色生成目录")
    parser.add_argument("--id", required=True, help="小写英文与连字符角色 ID")
    parser.add_argument("--name", required=True, help="角色中文显示名称")
    parser.add_argument("--reference", required=True, type=Path, help="角色三视图路径")
    parser.add_argument(
        "--runs-dir",
        type=Path,
        default=Path("artifacts/character-runs"),
        help="忽略版本控制的生成根目录",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if not re.fullmatch(r"[a-z0-9][a-z0-9-]*", args.id):
        raise SystemExit("角色 ID 只能使用小写英文、数字和连字符")
    if not args.reference.is_file():
        raise SystemExit(f"三视图不存在：{args.reference}")

    run_dir = args.runs_dir.resolve() / args.id
    reference_dir = run_dir / "reference"
    strips_dir = run_dir / "transparent"
    reference_dir.mkdir(parents=True, exist_ok=True)
    strips_dir.mkdir(parents=True, exist_ok=True)
    copied_reference = reference_dir / f"three-view{args.reference.suffix.lower()}"
    shutil.copy2(args.reference, copied_reference)

    request = create_generation_request(args.id, args.name, copied_reference.name)
    (run_dir / "request.json").write_text(
        json.dumps(request, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    (run_dir / "prompts.md").write_text(build_prompts(args.name), encoding="utf-8")
    jobs = [{"state": state, "output": f"{state}-transparent.png"} for state in STATES]
    (run_dir / "imagegen-jobs.json").write_text(
        json.dumps(jobs, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(run_dir)


def build_prompts(name: str) -> str:
    shared = (
        f"严格保持三视图中的{name}身份、材质和身体比例。输出横向六帧动作条，"
        "六个角色互不接触、足底基线一致、纯色青色背景、无文字、无边框、无阴影裁切。"
    )
    shared = (
        f"严格保持三视图中的{name}身份、材质、服装细节和身体比例。输出横向六帧动作条；"
        "六个角色互不接触、足底基线一致、透明背景、无文字、无边框、无地面阴影、"
        "无漂浮符号、无分离特效，角色完整且不裁切。"
    )
    lines = ["# 角色动作生成提示", "", f"共同约束：{shared}", ""]
    descriptions = {
        "idle-base": "正面稳定站立，仅有非常轻微的呼吸起伏。",
        "idle-blink": "正面单次自然眨眼，身体保持安静。",
        "drag-left": "左侧面向左走，保留不对称服装和道具细节。",
        "thinking": "轻微歪头并移动视线，动作克制。",
        "waiting": "看向用户并轻微摊手，保持耐心。",
        "reminding": "朝用户轻点示意一次，不使用外部符号。",
        "error": "低头并轻摇头一次，避免夸张表演。",
        "sleeping": "闭眼站立并慢呼吸，不坐下也不倒地。",
        "idle": "正面闲置，包含眨眼与轻微呼吸。",
        "awaken": "正面唤醒，从注意到用户到挥手。",
        "drag-down": "正面向前走，左右脚交替迈步。",
        "drag-up": "背面向远处走，左右脚交替迈步。",
        "drag-right": "右侧面向右走，完整侧面步态。",
        "working": "正面专注工作，手部做轻微整理动作。",
        "complete": "正面完成庆祝，克制而明确。",
    }
    for state in STATES:
        lines.extend((f"## {state}", f"{shared}{descriptions[state]}", ""))
    return "\n".join(lines)


if __name__ == "__main__":
    main()
