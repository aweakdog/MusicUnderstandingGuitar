#!/bin/bash
# Mac 启动器：没在运行就先在后台启动，然后用 Chrome 的独立窗口打开（像一个 App）。
# ~/Applications/十二音指板 Guitar12.app 调用的就是这个脚本。
cd "$(dirname "$0")"
PORT=8712
URL="http://localhost:$PORT"
if ! lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
    ./start_web.sh "$PORT" >/dev/null 2>&1
    for _ in $(seq 1 30); do
        curl -s -o /dev/null "$URL/api/health" && break
        sleep 0.2
    done
fi
if [ -d "/Applications/Google Chrome.app" ]; then
    open -na "Google Chrome" --args --app="$URL"
else
    open "$URL"
fi
