import json, subprocess, sys
def W(u,v): return (35.35-0.7071*u+0.7071*v, 35.35-0.7071*u-0.7071*v)
probe=open('tools/probe.js').read()
def tp(u,v): x,z=W(u,v); return ["eval",f"(()=>{{const p=window.__G().player;p.x={x};p.z={z};p.invuln=true;}})()"]
def until(cond, t=60000, press=None, js=""):
    pr = f"window.__G().input.press('{press}');setTimeout(()=>window.__G().input.release('{press}'),80);" if press else ""
    return ["eval", f"new Promise(r=>{{const t0=performance.now();const iv=setInterval(()=>{{const g=window.__G();try{{if({cond}){{clearInterval(iv);r('ok')}}}}catch(e){{}};{pr}{js} if(performance.now()-t0>{t}){{clearInterval(iv);r({json.dumps('TIMEOUT '+cond[:50])})}}}},300)}})"]
killgun=lambda i: ["eval",f"(()=>{{const g=window.__G();g.soldiers.filter(s=>s.gun==={i}&&s.alive).forEach(s=>g.kill(s,g.player));}})()"]
clickcard="document.querySelector('#cards .next')&&document.querySelector('#cards .next').click();document.querySelector('#cards .choice')&&document.querySelector('#cards .choice').click();"
steps=[["wait",3000],["eval","window.__G().player.invuln=true"],
 until("g.tnt===3",60000), tp(60,-9), until("!g.curAct",15000,"act"), ["wait",7500],
 tp(67,4), until("!g.curAct",15000,"act"), ["wait",7500], ["shot","boom"],
 tp(73,16), until("!g.curAct",15000,"act"), until("g.save.cp==='b4'",40000), ["eval",probe], ["wait",3000],["shot","retreat"],
 tp(40,-21.2), until("document.querySelectorAll('#cards .paper').length>0",30000), ["shot","end"], ["eval",probe]]
r=subprocess.run(['python3','tools/run.py','ab',json.dumps(steps),'?q=low&cp=b3'],capture_output=True,text=True,timeout=1500)
print(r.stdout[-6000:]); print(r.stderr[-2000:])
