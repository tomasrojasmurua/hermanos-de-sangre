# usage: cards.py name 'query' seconds [pick]   — plays with the bots and screenshots every new paper card
import sys, asyncio, os, re, time
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.makedirs(os.path.join(ROOT, 'shots'), exist_ok=True)
from playwright.async_api import async_playwright
name, q, secs = sys.argv[1], sys.argv[2], int(sys.argv[3])
pick = sys.argv[4] if len(sys.argv) > 4 else "0"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'])
        pg = await b.new_page(viewport={'width': 844, 'height': 390}, device_scale_factor=1, is_mobile=True, has_touch=True)
        errs = []
        pg.on('pageerror', lambda e: errs.append('PAGEERROR: ' + str(e)))
        pg.on('console', lambda m: errs.append(m.type + ': ' + m.text) if m.type == 'error' and 'ERR_TUNNEL' not in m.text else None)
        await pg.add_init_script(path=os.path.join(ROOT, 'tools', 'currahee', 'bot.js'))
        await pg.goto('file://' + os.path.join(ROOT, 'juego.html') + q)
        await pg.evaluate(f"__autocards({pick});__autoweek([0,1,2,3,4]);__autobot('good')")
        seen = set()
        t0 = time.time()
        while time.time() - t0 < secs:
            h = await pg.evaluate("(()=>{const c=document.querySelector('#cards .paper h3');return c?c.textContent:''})()")
            if h and h not in seen:
                seen.add(h)
                await pg.wait_for_timeout(700)
                slug = re.sub(r'[^a-z0-9]+', '-', h.lower())[:30]
                await pg.screenshot(path=os.path.join(ROOT, 'shots', f'{name}_{len(seen):02d}_{slug}.png'))
                print('CARD', h, flush=True)
            await pg.wait_for_timeout(400)
        for e in errs[:20]: print(e[:300])
        await b.close()
asyncio.run(main())
