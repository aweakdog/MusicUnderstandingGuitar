#!/bin/bash
# 后台启动（和 go_value_analyzer 的 start_web.sh 同样的用法，以后部署到服务器时用）。
# 用法：./start_web.sh [端口] [监听地址]；日志写到 web.log，进程号写到 web.pid。
set -eo pipefail
cd "$(dirname "$0")"
PORT="${1:-8712}"
HOST="${2:-127.0.0.1}"
if lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "Port $PORT is in use. Stop the existing service before starting." >&2
    exit 1
fi
if [ ! -x .venv/bin/python ]; then
    python3 -m venv .venv
    .venv/bin/python -m pip install -q -r requirements.txt
fi
umask 077
nohup .venv/bin/python -u web_app.py --host "$HOST" --port "$PORT" >> web.log 2>&1 </dev/null &
pid=$!
printf '%s\n' "$pid" > web.pid
sleep 1
kill -0 "$pid"
printf 'STARTED:%s\nLOG:%s/web.log\nURL:http://%s:%s\n' "$pid" "$(pwd)" "$HOST" "$PORT"
