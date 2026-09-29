#!/bin/bash
# 生成全部图标（需要 macOS：qlmanage、sips、iconutil）。
# 输出：static/icons/ 下的网页和安装用图标；tools/AppIcon.icns 给 Mac 启动器用。
set -e
cd "$(dirname "$0")/.."
TMP=$(mktemp -d)
for v in round mask mac; do
    python3 tools/icon_svg.py "$v" > "$TMP/$v.svg"
    qlmanage -t -s 1024 -o "$TMP" "$TMP/$v.svg" >/dev/null 2>&1
done
OUT=static/icons
mkdir -p "$OUT"
cp "$TMP/round.svg" "$OUT/icon.svg"
sips -Z 192 "$TMP/round.svg.png" --out "$OUT/icon-192.png" >/dev/null
sips -Z 512 "$TMP/round.svg.png" --out "$OUT/icon-512.png" >/dev/null
sips -Z 512 "$TMP/mask.svg.png" --out "$OUT/icon-maskable-512.png" >/dev/null
sips -Z 180 "$TMP/mask.svg.png" --out "$OUT/apple-touch-icon.png" >/dev/null

SET="$TMP/AppIcon.iconset"
mkdir -p "$SET"
for s in 16 32 128 256 512; do
    sips -Z "$s" "$TMP/mac.svg.png" --out "$SET/icon_${s}x${s}.png" >/dev/null
    sips -Z $((s * 2)) "$TMP/mac.svg.png" --out "$SET/icon_${s}x${s}@2x.png" >/dev/null
done
iconutil -c icns "$SET" -o tools/AppIcon.icns
rm -rf "$TMP"
ls -la "$OUT" tools/AppIcon.icns
