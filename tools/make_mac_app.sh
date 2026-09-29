#!/bin/bash
# 生成 Mac 启动器 ~/Applications/十二音指板 Guitar12.app（Spotlight 搜「十二音」或「Guitar12」都能找到）。
# 点开后调用 launch_mac.sh：没在运行就后台启动 Flask，再用 Chrome 独立窗口打开。
set -e
cd "$(dirname "$0")/.."
[ -f tools/AppIcon.icns ] || ./tools/make_icons.sh
APP="$HOME/Applications/十二音指板 Guitar12.app"
LAUNCH="$(pwd)/launch_mac.sh"
mkdir -p "$HOME/Applications"
rm -rf "$APP"
osacompile -o "$APP" -e "do shell script \"/bin/bash \" & quoted form of \"$LAUNCH\" & \" >/dev/null 2>&1\""
cp tools/AppIcon.icns "$APP/Contents/Resources/applet.icns"
# 新版 macOS 的 osacompile 会带一个 Assets.car，里面的默认图标优先级比 applet.icns 高，要去掉
rm -f "$APP/Contents/Resources/Assets.car"
/usr/libexec/PlistBuddy -c "Delete :CFBundleIconName" "$APP/Contents/Info.plist" 2>/dev/null || true
/usr/libexec/PlistBuddy -c "Set :CFBundleName 十二音指板" "$APP/Contents/Info.plist"
/usr/libexec/PlistBuddy -c "Add :CFBundleIdentifier string com.lyh.guitar12" "$APP/Contents/Info.plist" 2>/dev/null \
    || /usr/libexec/PlistBuddy -c "Set :CFBundleIdentifier com.lyh.guitar12" "$APP/Contents/Info.plist"
codesign --force --deep -s - "$APP" >/dev/null 2>&1
touch "$APP"
# 让 Finder / 程序坞 / Spotlight 重新读图标
/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister -f "$APP" 2>/dev/null || true
mdimport "$APP" 2>/dev/null || true
echo "已生成：$APP"
