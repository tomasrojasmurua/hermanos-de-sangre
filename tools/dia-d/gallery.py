import json, subprocess, sys
def W(u,v): return (35.35-0.7071*u+0.7071*v, 35.35-0.7071*u-0.7071*v)
def tp(u,v): x,z=W(u,v); return ["eval",f"(()=>{{const p=window.__G().player;p.x={x};p.z={z};p.invuln=true;window.__G().cam.snap=true;}})()"]
tag=sys.argv[1]; q=sys.argv[2] if len(sys.argv)>2 else 'mid'
runs={
 'title':('',[["wait",7000],["shot","title"]]),
 'n0':('&cp=n0',[["wait",14000],["shot","n0"]]),
 'n1':('&cp=n1',[["wait",4000],["eval","window.__G().player.invuln=true"],tp(27,-14),["wait",6000],["shot","n1"]]),
 'n2':('&cp=n2',[["wait",4000],["eval","window.__G().player.invuln=true"],tp(62,-21),["wait",5000],["shot","n2"]]),
 'b0':('&cp=b0',[["wait",9000],["shot","b0"]]),
 'b1':('&cp=b1',[["wait",4000],["eval","window.__G().player.invuln=true"],["wait",9000],["shot","b1"]]),
 'b1t':('&cp=b1',[["wait",4000],["eval","window.__G().player.invuln=true"],tp(56,-13.5),["wait",7000],["shot","b1t"]]),
}
for k in sys.argv[3:] if len(sys.argv)>3 else runs:
    qs,steps=runs[k]
    r=subprocess.run(['python3','tools/run.py',tag,json.dumps(steps),f'?q={q}'+qs],capture_output=True,text=True,timeout=600)
    print(k, r.stdout.strip()[-300:], r.stderr.strip()[-300:])
