#!/usr/bin/env bash
# 模块用途：安装周期任务 Skill/Plugin，并验证 Hermes 与 Plan API 边界。
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HERMES_HOME="${HERMES_HOME:-$HOME/.hermes}"
HERMES_ENV_FILE="${HERMES_ENV_FILE:-$HERMES_HOME/.env}"
PLUGIN_DIR="$HERMES_HOME/plugins/cycle-plan-tools"
SKILL_DIR="$HERMES_HOME/skills/cycle-plan"

read_env_value() {
  local key="$1"
  [[ -f "$HERMES_ENV_FILE" ]] || return 0
  awk -F= -v wanted="$key" '
    $1 == wanted {sub(/^[^=]*=/, ""); print; exit}
  ' "$HERMES_ENV_FILE"
}

PLAN_API_BASE_URL="${PLAN_API_BASE_URL:-$(read_env_value PLAN_API_BASE_URL)}"
PLAN_HERMES_TOKEN="${PLAN_HERMES_TOKEN:-$(read_env_value PLAN_HERMES_TOKEN)}"

if [[ -z "$PLAN_API_BASE_URL" || -z "$PLAN_HERMES_TOKEN" ]]; then
  echo "安装中止：请先在 $HERMES_ENV_FILE 配置以下两项："
  echo "PLAN_API_BASE_URL=http://127.0.0.1:8743"
  echo "PLAN_HERMES_TOKEN=<Hermes 专用 Token>"
  exit 1
fi

PLAN_API_ROOT="${PLAN_API_BASE_URL%/}"
PLAN_API_ROOT="${PLAN_API_ROOT%/v1}"
plan_api_ready=""
for _attempt in $(seq 1 20); do
  if plan_api_ready="$(
    curl -fsS \
      -H "Authorization: Bearer $PLAN_HERMES_TOKEN" \
      "$PLAN_API_ROOT/v1/tasks" 2>/dev/null
  )"; then
    break
  fi
  sleep 1
done
if [[ -z "$plan_api_ready" ]]; then
  echo "安装中止：Plan API 在 20 秒内未通过受限读取验证。"
  exit 1
fi

mkdir -p "$PLUGIN_DIR" "$SKILL_DIR"
install -m 0644 "$ROOT_DIR/plugin/plugin.yaml" "$PLUGIN_DIR/plugin.yaml"
install -m 0644 "$ROOT_DIR/plugin/"*.py "$PLUGIN_DIR/"
install -m 0644 \
  "$ROOT_DIR/skill/cycle-plan/SKILL.md" \
  "$SKILL_DIR/SKILL.md"

python3 -m unittest discover -s "$ROOT_DIR/tests" -v
hermes plugins enable cycle-plan-tools
hermes gateway restart

if ! hermes plugins list | grep -q "cycle-plan-tools"; then
  echo "验收失败：Hermes 未发现 cycle-plan-tools。"
  exit 1
fi

cat <<'EOF'

周期任务扩展安装完成。

已验证：
- Plan API 可通过 Hermes Token 读取；
- Plugin 已启用；
- Python 合同测试通过；
- Gateway 已重启。

请运行 `hermes tools`，为当前聊天平台启用 cycle_plan 工具集。
建议只保留 Skills、Memory、必要的 Web/Search 和 cycle_plan，
关闭 Terminal、File、Code、Delegation 与 Cron。
EOF
