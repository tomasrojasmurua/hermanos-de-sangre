import json, subprocess, sys
def W(u,v): return (35.35-0.7071*u+0.7071*v, 35.35-0.7071*u-0.7071*v)
probe=open('tools/probe.js').read()
def tp(u,v): x,z=W(u,v); return ["eval",f"(()=>{{const p=window.__G().player;p.x={x};p.z={z};p.invuln=true;}})()"]
def until(cond, t=60000, press=None):
    pr = f"window.__G().input.press('{press}');setTimeout(()=>window.__G().input.release('{press}'),80);" if press else ""
    return ["eval", f"new Promise(r=>{{const t0=performance.now();const iv=setInterval(()=>{{const g=window.__G();try{{if({cond}){{clearInterval(iv);r('ok '+({cond}))}}}}catch(e){{}};{pr} if(performance.now()-t0>{t}){{clearInterval(iv);r({json.dumps('TIMEOUT '+cond[:50])})}}}},250)}})"]
steps=[["wait",2500],["eval","window.__G().player.invuln=true"],
 until("g.curAct&&g.curAct.label==='Soltar el arnés'"), until("g.flags.free",8000,"act"), ["eval",probe],
 until("g.objective&&g.objective.text.startsWith('Ayuda')"), tp(8.6,4.2), until("g.flags.helped",8000,"act"),
 until("g.objective&&g.objective.text.startsWith('Recupera')",20000), ["eval",probe],
 tp(15,17), until("g.objective&&g.objective.text.startsWith('Aléjate')",30000), ["shot","mg"], ["eval",probe],
 tp(20.6,-11.8), until("g.save.cp==='n1'",10000), ["eval",probe],
 tp(46.8,6.2), until("g.save.cp==='n2'",10000), ["eval",probe], ["wait",1500],["key","KeyQ",150], until("g.pingT>0",8000), ["shot","call"],
 tp(65.2,-20.8), until("g.save.cp==='n3'",30000), ["eval",probe], ["shot","lipton"],
 tp(93,12.5), until("g.part==='brecourt'||document.querySelectorAll('#cards .paper').length>0",40000), ["shot","group"], ["eval",probe]]
r=subprocess.run(['python3','tools/run.py','an',json.dumps(steps),'?q=low&cp=n0'],capture_output=True,text=True,timeout=1200)
print(r.stdout[-5000:]); print(r.stderr[-2000:])
