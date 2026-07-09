#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if docker compose ps --services 2>/dev/null | grep -q '^server$'; then
  echo "==> 停止 server 容器..."
  docker compose stop server

  echo "==> 删除 SQLite volume（bridge-data）..."
  docker compose down --volumes --remove-orphans || true
  docker volume rm linco-bridge-platform_bridge-data 2>/dev/null || \
    docker volume rm "$(basename "$ROOT_DIR")_bridge-data" 2>/dev/null || true

  echo "==> 重新启动 server..."
  docker compose up -d --build server
  echo "==> Demo 数据库已清空并重启完成"
  exit 0
fi

DB_PATH="${SQLITE_PATH:-$ROOT_DIR/server/data/linco-bridge.db}"
if [[ -f "$DB_PATH" ]]; then
  rm -f "$DB_PATH"
  echo "==> 已删除 $DB_PATH"
else
  echo "==> 未找到 $DB_PATH，可能已是空库"
fi

echo "==> 请手动重启 linco-bridge server 进程"
