"""ファビコンを作り直す。使い方: python3 src/og/favicon.py   必要なもの: Pillow
ゲームの箱っぽい馬に合わせた、16マスのドット絵の馬(右向き)。"""
import os
from PIL import Image, ImageDraw
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
G = [
"................",
"..........##....",
".........###....",
"........r#####..",
".--....rr######.",
"......rr###o###.",
".---.rr########.",
"....rr#####..##.",
"..-.rr#####.....",
"....rr######....",
".--.rr#######...",
"....rr########..",
"..-.rr########..",
"....rr########..",
"....rr########..",
"................",
]
COL = {'#':'#16130f', 'r':'#ff2d3d', 'o':'#ffffff', '-':'#16130f'}
BG = '#ffd60a'
def svg():
    out = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" shape-rendering="crispEdges">', '<rect width="16" height="16" rx="3" fill="%s"/>' % BG]
    for y, row in enumerate(G):
        x = 0
        while x < 16:
            c = row[x]
            if c == '.': x += 1; continue
            x0 = x
            while x < 16 and row[x] == c: x += 1
            out.append('<rect x="%d" y="%d" width="%d" height="1" fill="%s"%s/>' % (x0, y, x - x0, COL[c], ' opacity=".55"' if c == '-' else ''))
    out.append('</svg>')
    return '\n'.join(out) + '\n'
def png(size, round_corners=True):
    k = 8; im = Image.new('RGBA', (16 * k, 16 * k), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    if round_corners: d.rounded_rectangle([0, 0, 16 * k - 1, 16 * k - 1], radius=3 * k, fill=BG)
    else: d.rectangle([0, 0, 16 * k, 16 * k], fill=BG)
    for y, row in enumerate(G):
        for x, c in enumerate(row):
            if c == '.': continue
            col = COL[c]
            if c == '-': col = '#8c7a0c'   # 黄色の上の半透明の黒
            d.rectangle([x * k, y * k, x * k + k - 1, y * k + k - 1], fill=col)
    return im.resize((size, size), Image.NEAREST if size % 16 == 0 else Image.LANCZOS)
open(os.path.join(ROOT, 'favicon.svg'), 'w').write(svg())
png(48).save(os.path.join(ROOT, 'favicon.ico'), sizes=[(16, 16), (32, 32), (48, 48)])
png(180, False).save(os.path.join(ROOT, 'apple-touch-icon.png'), optimize=True)
