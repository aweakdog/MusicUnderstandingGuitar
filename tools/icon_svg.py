"""生成十二音圆环图标的 SVG：12 个点围成一圈（0 在正上方，顺时针），do / mi / so（0、4、7）连成大三和弦三角形。

用法：python3 tools/icon_svg.py <variant> > out.svg
variant：round（网页、圆角方块）、mask（安卓可裁切版，满底色、图案缩进安全区）、mac（macOS 图标，四周留白）
"""
import math
import sys

TRIAD = (0, 4, 7)


def svg(variant="round"):
    if variant == "mac":
        bg = '<rect x="5.5" y="5.5" width="53" height="53" rx="12" fill="url(#g)"/>'
        R, dot, big, sw = 16.5, 2.6, 3.3, 1.9
    elif variant == "mask":
        bg = '<rect width="64" height="64" fill="url(#g)"/>'
        R, dot, big, sw = 15.5, 2.5, 3.2, 1.8
    else:
        bg = '<rect width="64" height="64" rx="14" fill="url(#g)"/>'
        R, dot, big, sw = 20.5, 3.1, 3.9, 2.3
    pt = lambda k: (32 + R * math.sin(math.radians(30 * k)), 32 - R * math.cos(math.radians(30 * k)))
    tri = " ".join(f"{x:.2f},{y:.2f}" for x, y in map(pt, TRIAD))
    dots = []
    for k in range(12):
        x, y = pt(k)
        if k in TRIAD:
            dots.append(f'<circle cx="{x:.2f}" cy="{y:.2f}" r="{big}" fill="#fde68a"/>')
        else:
            dots.append(f'<circle cx="{x:.2f}" cy="{y:.2f}" r="{dot}" fill="#ffffff" fill-opacity="0.62"/>')
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 64 64">
<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#14897f"/><stop offset="1" stop-color="#0b5f58"/></linearGradient></defs>
{bg}
<circle cx="32" cy="32" r="{R}" fill="none" stroke="#ffffff" stroke-opacity="0.22" stroke-width="1.1"/>
<polygon points="{tri}" fill="#fde68a" fill-opacity="0.18" stroke="#fde68a" stroke-width="{sw}" stroke-linejoin="round"/>
{"".join(dots)}
</svg>'''


if __name__ == "__main__":
    print(svg(sys.argv[1] if len(sys.argv) > 1 else "round"))
