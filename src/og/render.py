"""OGP画像とファビコンを作り直す。使い方: python3 src/og/render.py [@fontsource を入れた node_modules のパス]
必要なもの: playwright(chromium)、Pillow、npm の @fontsource/dela-gothic-one と @fontsource/zen-kaku-gothic-new"""
import asyncio, os, sys
from playwright.async_api import async_playwright
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(HERE))
NM = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'node_modules'))
FONTS = ''.join('<link rel="stylesheet" href="file://%s/@fontsource/%s">' % (NM, f) for f in ('dela-gothic-one/index.css', 'zen-kaku-gothic-new/700.css', 'zen-kaku-gothic-new/900.css'))
async def shot(pg, name, out, w, h, scale):
    html = open(os.path.join(HERE, name), encoding='utf-8').read().replace('</head>', FONTS + '</head>')
    tmp = os.path.join(HERE, '_' + name); open(tmp, 'w', encoding='utf-8').write(html)
    await pg.set_viewport_size({'width':w, 'height':h})
    await pg.goto('file://' + tmp); await pg.evaluate('document.fonts.ready'); await pg.wait_for_timeout(400)
    await pg.screenshot(path=out, omit_background=True); os.remove(tmp)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); c = await b.new_context(device_scale_factor=2); pg = await c.new_page()
        big = os.path.join(HERE, '_og2x.png')
        await shot(pg, 'og.html', big, 1200, 630, 2)
        # 写真まじりなので JPEG(色のにじみを避けて 4:4:4)。PNG の3分の1ほどの重さになる
        Image.open(big).convert('RGB').resize((1200, 630), Image.LANCZOS).save(os.path.join(ROOT, 'og.jpg'), quality=90, subsampling=0, optimize=True); os.remove(big)
        await b.close()
asyncio.run(main())
