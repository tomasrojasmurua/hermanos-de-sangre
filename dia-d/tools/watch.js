new Promise(res=>{const out=[];let n=0;const iv=setInterval(()=>{const g=window.__G(),R=window.__R;const b=new Uint16Array(4);R.r.readRenderTargetPixels(R.rt,Math.floor(R.w/2),Math.floor(R.h*0.6),1,1,b);
const sm=g.fx.smoke.d;let near=0,maxS=0;for(const q of sm){const d=Math.hypot(q.x-g.cam.x,q.z-g.cam.z);if(d<25){near++;}maxS=Math.max(maxS,q.s1||0)}
out.push([n,b[1],sm.length,near,g.fx.glow.d.length,g.fx.tracers.list.length,+g.cam.x.toFixed(1),g.soldiers.filter(s=>s.ai&&s.ai.mode==='alert').length]);n++;if(n>=24){clearInterval(iv);res(JSON.stringify(out))}},500)})
