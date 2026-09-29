#!/bin/bash
# 本地启动：麦克风要求 localhost 或 https，所以用本地服务器打开（Ctrl+C 结束）
cd "$(dirname "$0")"
PORT="${1:-8712}"
(sleep 1 && open "http://localhost:$PORT") &
python3 -m http.server "$PORT" --bind 127.0.0.1
