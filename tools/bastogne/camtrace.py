import os
ROOT=os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.makedirs(os.path.join(ROOT,'shots'),exist_ok=True)
import sys, asyncio, json
from playwright.async_api import async_playwright
f=sys.argv[1]
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        pg = await b.new_page(viewport={'width':390,'height':844}, is_mobile=True, has_touch=True)
        await pg.goto('file://'+ROOT+'/'+f+'?skip=1&notut=1&q=low')
        await pg.wait_for_timeout(3000)
        # force dusk -> night through the game's own phase switch
        await pg.evaluate("(()=>{const g=window.__game; g.phase='night'; g.phaseT=0; g.startNight(); g.nightPlan.threat='patrulla'; })()")
        tr = await pg.evaluate("""new Promise(r=>{const o=[];const t0=performance.now();const iv=setInterval(()=>{const c=window.__camTarget;o.push([Math.round(performance.now()-t0),+c.x.toFixed(2),+c.z.toFixed(2),+window.__cam.zoom.toFixed(2),window.__game.enemies.filter(e=>e.alive).length]); if(performance.now()-t0>14000){clearInterval(iv);r(o)}},100)})""")
        mx=0
        for a,bb in zip(tr,tr[1:]):
            dt=(bb[0]-a[0])/1000; v=((bb[1]-a[1])**2+(bb[2]-a[2])**2)**.5/dt; mx=max(mx,v)
        print('max cam speed u/s', round(mx,1)); print([x for x in tr[::10]])
        await b.close()
asyncio.run(main())
