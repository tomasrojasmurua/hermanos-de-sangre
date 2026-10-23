# usage: run.py name 'steps-json'   steps: [["wait",ms],["shot","tag"],["click","css"],["eval","js"],["key","KeyW",ms]]
import sys, asyncio, json
from playwright.async_api import async_playwright
name=sys.argv[1]; steps=json.loads(sys.argv[2]); q=sys.argv[3] if len(sys.argv)>3 else "?q=mid"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--autoplay-policy=no-user-gesture-required'])
        pg = await b.new_page(viewport={'width':390,'height':844}, device_scale_factor=1, is_mobile=True, has_touch=True)
        logs=[]
        pg.on('console', lambda m: logs.append(m.type+': '+m.text) if m.type in ('error','warning') else None)
        pg.on('pageerror', lambda e: logs.append('PAGEERROR: '+str(e)))
        await pg.goto('file:///home/claude/dday/dist/dev.html'+q)
        for s in steps:
            k=s[0]
            if k=='wait': await pg.wait_for_timeout(s[1])
            elif k=='shot': await pg.screenshot(timeout=120000, path=f'/home/claude/dday/shots/{name}_{s[1]}.png')
            elif k=='click':
                try: await pg.click(s[1], timeout=8000)
                except Exception as e: logs.append('CLICKFAIL '+s[1])
            elif k=='eval':
                r=await pg.evaluate(s[1]); 
                if r is not None: print('EVAL',r)
            elif k=='key':
                await pg.keyboard.down(s[1]); await pg.wait_for_timeout(s[2]); await pg.keyboard.up(s[1])
        for l in logs[:25]: print(l[:300])
        await b.close()
asyncio.run(main())
