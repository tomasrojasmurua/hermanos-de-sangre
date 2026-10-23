(()=>{const g=window.__G(),R=window.__R;const read=()=>{R.render(g.scene,g.camera,1);const b=new Uint16Array(4);R.r.readRenderTargetPixels(R.rt,Math.floor(R.w/2),Math.floor(R.h*0.6),1,1,b);return b[1]};
const base=read();const res=[];const kids=g.scene.children.slice();
for(const k of kids){if(!k.visible)continue;k.visible=false;const v=read();k.visible=true;if(Math.abs(v-base)>300)res.push([k.type,k.name||'',(k.geometry&&k.geometry.attributes.position.count)||0,v]);}
return JSON.stringify({base,res:res.slice(0,12),n:kids.length,fog:!!g.scene.fog});})()
