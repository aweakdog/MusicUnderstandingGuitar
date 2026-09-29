#!/bin/bash
# 本地启动（前台运行，Ctrl+C 结束）。第一次运行会自动建 .venv 并装依赖。
set -e
cd "$(dirname "$0")"
PORT="${1:-8712}"
if [ ! -x .venv/bin/python ]; then
    python3 -m venv .venv
    .venv/bin/python -m pip install -q -r requirements.txt
fi
if lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "端口 $PORT 已被占用，可能已经在运行：http://localhost:$PORT" >&2
    open "http://localhost:$PORT"
    exit 0
fi
(sleep 1.5 && open "http://localhost:$PORT") &
exec .venv/bin/python -u web_app.py --port "$PORT"
