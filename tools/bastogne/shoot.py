import os
ROOT=os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.makedirs(os.path.join(ROOT,'shots'),exist_ok=True)
import sys, asyncio, json
from playwright.async_api import async_playwright
# usage: shoot.py query name times(comma sec) [w h]
q, name, times = sys.argv[1], sys.argv[2], [float(x) for x in sys.argv[3].split(',')]
w,h = (int(sys.argv[4]), int(sys.argv[5])) if len(sys.argv)>5 else (390,844)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
        pg = await b.new_page(viewport={'width':w,'height':h}, device_scale_factor=1, is_mobile=True, has_touch=True)
        logs=[]
        pg.on('console', lambda m: logs.append(m.type+': '+m.text))
        pg.on('pageerror', lambda e: logs.append('PAGEERROR: '+str(e)))
        await pg.goto('file://'+ROOT+'/'+(__import__('os').environ.get('F','hermanos-de-sangre.html'))+q)
        t0=0
        for t in times:
            await pg.wait_for_timeout(int((t-t0)*1000)); t0=t
            await pg.screenshot(timeout=120000, animations='disabled', path=ROOT+f'/shots/{name}_{t:g}.png')
        extra = sys.argv[6] if len(sys.argv)>6 else None
        if extra:
            print(await pg.evaluate(extra))
        for l in logs[:30]: print(l)
        await b.close()
asyncio.run(main())
