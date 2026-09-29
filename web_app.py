"""十二音指板 Web 应用（Flask）。

现在只负责提供页面，练习数据存在浏览器本地（localStorage）。
以后上线后端时，在这里加账号和数据同步接口（前端 static/js/store.js 已经留好 RemoteStore 的位置）。
"""
import argparse

from flask import Flask, jsonify, render_template, send_from_directory

BUILD = "v1.2 · 2026-09-29"

app = Flask(__name__)


@app.route("/")
def index():
    return render_template("index.html", build=BUILD)


@app.route("/manifest.webmanifest")
def manifest():
    # 放在根路径，安装成 App 后的作用范围才是整个站点
    return send_from_directory(app.static_folder, "manifest.webmanifest", mimetype="application/manifest+json")


@app.route("/api/health")
def health():
    return jsonify(ok=True, build=BUILD, storage="local")


@app.after_request
def no_stale_assets(resp):
    # 开发阶段改了前端就能立刻生效，不被浏览器缓存住
    resp.headers["Cache-Control"] = "no-cache"
    return resp


def main():
    ap = argparse.ArgumentParser(description="十二音指板")
    ap.add_argument("--host", default="127.0.0.1", help="监听地址（部署到服务器时用 0.0.0.0）")
    ap.add_argument("--port", type=int, default=8712)
    args = ap.parse_args()
    print(f"十二音指板 {BUILD}：http://{args.host}:{args.port}")
    app.run(host=args.host, port=args.port, debug=False, threaded=True)


if __name__ == "__main__":
    main()
