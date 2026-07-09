#!/usr/bin/env bash
# 通过线上公开 API 清空 Demo 会话与用户创建的桥接连接（无需 SSH）
set -euo pipefail

BASE_URL="${1:-https://bridge-demo.lincotalk.com}"
API="$BASE_URL/api"

echo "==> 目标: $BASE_URL"

session_ids=()
for type in codex claude hermes openclaw; do
  history_json="$(curl -fsS "$API/agent-chat/$type/history?limit=200")"
  ids="$(echo "$history_json" | node -e "
    const j=JSON.parse(require('fs').readFileSync(0,'utf8'));
    (j.data||[]).forEach(s=>console.log(s.id));
  " || true)"
  while IFS= read -r id; do
    [[ -n "$id" ]] && session_ids+=("$id")
  done <<< "$ids"
done

if ((${#session_ids[@]} > 0)); then
  payload="$(node -e "console.log(JSON.stringify({sessionIds: process.argv.slice(1)}))" "${session_ids[@]}")"
  echo "==> 删除 ${#session_ids[@]} 条会话..."
  curl -fsS -X POST "$API/sessions/delete" \
    -H 'Content-Type: application/json' \
    -d "$payload"
  echo
else
  echo "==> 无会话需删除"
fi

# 从 setup 拿到各类型默认连接；若 status 显示已连接且非 seed account，则删除
for type in codex claude hermes openclaw; do
  setup_json="$(curl -fsS "$API/agent-bridges/$type/setup")"
  conn_id="$(echo "$setup_json" | node -pe 'JSON.parse(require("fs").readFileSync(0,"utf8")).data.connectionId')"
  status_json="$(curl -fsS "$API/agent-bridges/$type/status?connectionId=$conn_id")"
  connected="$(echo "$status_json" | node -pe 'JSON.parse(require("fs").readFileSync(0,"utf8")).data.connected')"
  account_id="$(echo "$status_json" | node -pe 'JSON.parse(require("fs").readFileSync(0,"utf8")).data.accountId||""')"
  if [[ "$connected" == "true" && "$account_id" != "${type}_1" && "$account_id" != "openclaw_1" ]]; then
    echo "==> 删除 $type 连接 $conn_id ($account_id)..."
    curl -fsS -X POST "$API/agent-bridges/$type/connection/delete" \
      -H 'Content-Type: application/json' \
      -d "{\"connectionId\":\"$conn_id\"}"
    echo
  fi
done

echo "==> 完成。当前会话列表:"
curl -fsS "$API/sessions"
echo
