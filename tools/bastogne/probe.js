(() => {
  const g = window.__game, c = window.__ocam;
  const cam = c.isCamera ? c : (c.camera || c.cam || Object.values(c).find(v=>v&&v.isCamera));
  function unproj(px,py){
    const x = px/innerWidth*2-1, y = -(py/innerHeight*2-1);
    const P = cam.projectionMatrixInverse.elements, M = cam.matrixWorld.elements;
    function ap(v,m){const [a,b,cc]=v; const w=m[3]*a+m[7]*b+m[11]*cc+m[15]; return [(m[0]*a+m[4]*b+m[8]*cc+m[12])/w,(m[1]*a+m[5]*b+m[9]*cc+m[13])/w,(m[2]*a+m[6]*b+m[10]*cc+m[14])/w];}
    const n = ap(ap([x,y,-1],P),M), f = ap(ap([x,y,1],P),M);
    const t = n[1]/(n[1]-f[1]); return [n[0]+(f[0]-n[0])*t, n[2]+(f[2]-n[2])*t].map(v=>+v.toFixed(1));
  }
  return JSON.stringify({camType: cam&&cam.type, ring: unproj(150,730), fire: g.W && g.W.fire && [g.W.fire.x,g.W.fire.z],
    holes: (g.W||{}).holes && g.W.holes.map(h=>[+h.x.toFixed(1),+h.z.toFixed(1),h.cover,!!h.occupant]), keys:Object.keys(g).slice(0,60)});
})()
