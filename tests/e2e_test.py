"""浏览器端到端测试：启动 Flask 应用，用本机 Chrome（Playwright）点一遍所有模式，并用假麦克风（196Hz 正弦 = so）测唱音判定。

依赖：pip install playwright；本机装有 Google Chrome；项目 .venv 里装好 requirements.txt。
用法：python3 tests/e2e_test.py [截图输出目录]
"""
import json
import math
import os
import struct
import subprocess
import sys
import tempfile
import time
import urllib.request
import wave

from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHOTS = sys.argv[1] if len(sys.argv) > 1 else None
PORT = 8719


def serve():
    py = os.path.join(ROOT, '.venv', 'bin', 'python')
    proc = subprocess.Popen([py, 'web_app.py', '--port', str(PORT)], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for _ in range(50):
        try:
            with urllib.request.urlopen(f'http://127.0.0.1:{PORT}/api/health', timeout=1) as r:
                info = json.load(r)
                print('Flask 已启动：', info)
                return proc
        except Exception:
            time.sleep(0.2)
    proc.kill()
    raise RuntimeError('Flask 没有启动起来')


def sine_wav(path, freq=196.0, seconds=6, sr=48000):
    with wave.open(path, 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sr)
        frames = b''.join(struct.pack('<h', int(12000 * math.sin(2 * math.pi * freq * i / sr))) for i in range(sr * seconds))
        w.writeframes(frames)


def main():
    server = serve()
    try:
        run()
    finally:
        server.terminate()


def run():
    wav = os.path.join(tempfile.mkdtemp(), 'so.wav')
    sine_wav(wav)
    errors = []
    results = []

    def check(name, cond, detail=''):
        results.append((name, bool(cond), detail))
        print(('PASS ' if cond else 'FAIL ') + name + (f'  [{detail}]' if detail and not cond else ''))

    with sync_playwright() as p:
        browser = p.chromium.launch(channel='chrome', headless=True, args=[
            '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream',
            f'--use-file-for-fake-audio-capture={wav}', '--autoplay-policy=no-user-gesture-required',
        ])
        ctx = browser.new_context(viewport={'width': 1280, 'height': 900})
        ctx.grant_permissions(['microphone'], origin=f'http://127.0.0.1:{PORT}')
        pg = ctx.new_page()
        pg.on('pageerror', lambda e: errors.append(str(e)))
        pg.on('console', lambda m: m.type == 'error' and errors.append(m.text))
        pg.goto(f'http://127.0.0.1:{PORT}/')
        pg.evaluate('localStorage.clear()')
        pg.reload()
        pg.wait_for_function('window.guitar12 !== undefined')

        def shot(name):
            if SHOTS:
                pg.screenshot(path=os.path.join(SHOTS, f'{name}.png'), full_page=True)

        def tap(s, f):
            pg.locator(f'rect.hit[data-s="{s}"][data-f="{f}"]').dispatch_event('pointerdown')

        js = lambda code: pg.evaluate(code)
        check('指板有 6 × 13 个可点位置', pg.locator('rect.hit').count() == 78)
        check('页脚显示版本号（来自 Flask 模板）', pg.inner_text('#build').startswith('v1.'))
        mf = js('fetch("/manifest.webmanifest").then(r => r.ok && r.headers.get("content-type").includes("manifest") ? r.json() : null)')
        check('manifest 可访问，名字和图标齐全', bool(mf) and mf['name'] == '十二音指板' and len(mf['icons']) >= 3)
        icons_ok = js('Promise.all(["icon.svg","icon-192.png","icon-512.png","icon-maskable-512.png","apple-touch-icon.png"].map(f => fetch("/static/icons/" + f).then(r => r.ok))).then(a => a.every(Boolean))')
        check('所有图标文件都能加载', icons_ok)
        check('页面上没有字母音名', not any(x in pg.inner_text('body') for x in [' C ', ' D ', ' E ', ' F ', ' G ', ' A ', ' B ']))

        # 听音找位：点对的位置
        pg.click('#tabs button[data-mode="hear"]')
        t = js('(() => { const t = guitar12.current.t; return [t.s, t.f, t.n]; })()')
        tap(t[0], t[1])
        check('听音找位：点对显示「对了」', '对了' in pg.inner_text('#big'))
        shot('hear_ok')
        pg.keyboard.press('Enter')
        t = js('(() => { const t = guitar12.current.t; return [t.s, t.f, t.n]; })()')
        wrong = js(f'(() => {{ const {{OPEN}} = {{OPEN: [null,28,23,19,14,9,4]}}; for (let s=1;s<=6;s++) for (let f=0;f<=12;f++) if (OPEN[s]+f !== {t[2]}) return [s,f]; }})()')
        tap(*wrong)
        check('听音找位：点错显示「不对」并标出正确位置', '不对' in pg.inner_text('#big') and pg.locator('.marker.hint').count() >= 1)
        shot('hear_bad')

        # 看位说数：键盘作答
        pg.click('#tabs button[data-mode="name"]')
        n = js('guitar12.current.t.n')
        key = {10: '-', 11: '='}.get(n % 12, str(n % 12))
        pg.keyboard.press(key)
        check('看位说数：按对的键显示「对了」', '对了' in pg.inner_text('#big'))
        shot('name_ok')
        pg.keyboard.press('Enter')
        n = js('guitar12.current.t.n')
        bad = (n % 12 + 1) % 12
        pg.click(f'#pad button[data-k="{bad}"]')
        check('看位说数：点错按钮标红、正确按钮标绿', pg.locator('#pad button.bad').count() == 1 and pg.locator('#pad button.ok').count() == 1)

        # 看数找位：把所有目标都点一遍
        pg.click('#tabs button[data-mode="findall"]')
        targets = js('guitar12.current.targets.map(q => [q.s, q.f])')
        for s, f in targets:
            tap(s, f)
        check(f'看数找位：找到全部 {len(targets)} 个位置', '全部找到了' in pg.inner_text('#big'))
        shot('findall_done')

        # 看位唱音：目标设成 6 弦 3 品（so = 7），假麦克风一直在唱 196Hz 的 so
        pg.click('#tabs button[data-mode="sing"]')
        js('(() => { const m = guitar12.current; m.t = { s: 6, f: 3, n: 7 }; guitar12.board.setMarkers([{ s: 6, f: 3, cls: "target pulse" }]); })()')
        pg.click('#controls button:has-text("开启麦克风")')
        try:
            pg.wait_for_function('document.getElementById("big").innerText.includes("唱对了")', timeout=8000)
            ok = True
        except Exception:
            ok = False
        check('看位唱音：假麦克风唱 so，判定为唱对', ok, pg.inner_text('#big') + ' / ' + pg.inner_text('#meterText'))
        shot('sing_ok')
        # 目标换成 la（9），同样的 so 应该判为偏低 2 个半音
        js('(() => { const m = guitar12.current; clearTimeout(m.timer); m.done = false; m.hold = 0; m.t = { s: 6, f: 5, n: 9 }; })()')
        pg.wait_for_timeout(1800)
        mt = pg.inner_text('#meterText')
        check('看位唱音：目标 la 时唱 so 显示「偏低 2 个半音」', '偏低 2 个半音' in mt, mt)
        js('guitar12.mic.stop()')

        # 自由弹：打开编号显示后点一个位置出现标签
        pg.click('#tabs button[data-mode="explore"]')
        pg.click('#settings summary')
        pg.select_option('#labelMode', 'number')
        pg.click('#tabs button[data-mode="explore"]')
        tap(6, 3)
        check('自由弹：显示编号时 6 弦 3 品标 7', pg.locator('.marker .mlabel').first.text_content() == '7')
        pg.select_option('#labelMode', 'syllable')
        pg.click('#controls button:has-text("显示全部位置")')
        check('自由弹：显示全部位置用唱名', pg.locator('.marker .mlabel').count() == 78 and 'so' in pg.locator('#board').text_content())
        shot('explore_all')
        pg.select_option('#labelMode', 'none')

        # 设置：品位范围改成 0～5
        pg.select_option('#fretMax', '5')
        check('设置：品位改成 0～5 后指板剩 6 × 6 个位置', pg.locator('rect.hit').count() == 36)
        pg.select_option('#fretMax', '12')

        # 统计：表格和热力图
        pg.click('#tabs button[data-mode="stats"]')
        txt = pg.inner_text('#statsView')
        check('统计：有今天的记录', '听音找位' in txt and '题' in txt)
        check('统计：热力图有格子', pg.locator('.marker.heat').count() >= 1)
        shot('stats')

        # 刷新后统计还在（本地存储）
        pg.reload()
        pg.wait_for_function('window.guitar12 !== undefined')
        check('刷新后统计仍在', js('guitar12.stats.summary("hear").n') >= 2)

        # 手机宽度
        pg.set_viewport_size({'width': 390, 'height': 844})
        pg.click('#tabs button[data-mode="name"]')
        pg.wait_for_timeout(600)
        visible = js('''(() => {
          const m = document.querySelector('.marker.target circle').getBoundingClientRect();
          const b = document.querySelector('.board-card').getBoundingClientRect();
          return m.left >= b.left && m.right <= b.right;
        })()''')
        check('手机宽度：目标位置自动滚到可见区域', visible)
        shot('mobile_name')

        check('没有页面错误', not errors, '; '.join(errors[:5]))
        browser.close()

    failed = [r for r in results if not r[1]]
    print(f'\n{len(results) - len(failed)}/{len(results)} 通过')
    sys.exit(1 if failed else 0)


if __name__ == '__main__':
    main()
