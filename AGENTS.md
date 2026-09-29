# 项目规则

十二音指板：用 12 音系统（do de re ri mi fa fo so sa la li xi = 0～11）练吉他指板的 Flask 应用。说明见 README.md。

## 这是公开仓库

GitHub 仓库 `aweakdog/MusicUnderstandingGuitar` 保持公开，以后可能给别人用。提交任何内容前都要确认不包含：

- 密码、token、API key、证书私钥、`.env` 之类的凭据文件；
- 服务器地址、主机名、用户名、端口等部署细节（部署配置放在服务器上或本地，不进仓库）；
- 个人信息：真实姓名、联系方式、住址、证件、收入、家人信息，以及任何私人档案内容；
- 本机的绝对路径（用相对路径或 `$HOME`）；
- 用户的练习数据、录音。

提交前可以用 `git diff --cached` 过一遍，再用
`git ls-files | xargs grep -nIiE "password|passwd|token|secret|api[_-]?key"` 扫一下。

## 约定

- 全程不出现字母音名；编号和唱名以 README 里的表为准。
- 现在数据只存浏览器本地；以后接后端时，在 `web_app.py` 加接口，前端换掉 `static/js/store.js` 里的存储类。
- 改完跑测试：`npm test`（单元），`python3 tests/e2e_test.py`（浏览器端到端，需要 playwright 和本机 Chrome）。
- 改图标：改 `tools/icon_svg.py`，再运行 `./tools/make_icons.sh` 和 `./tools/make_mac_app.sh`。
