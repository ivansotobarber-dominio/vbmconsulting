export function interpolate(source,target,progress){
  if(progress>=1)return structuredClone(target);
  const destinations=new Map(target.pieces.map(p=>[p.id,p]));
  return {...source,pieces:source.pieces.map(p=>{const end=destinations.get(p.id);return end?.kind===p.kind?{...p,x:p.x+(end.x-p.x)*progress,y:p.y+(end.y-p.y)*progress}:{...p};})};
}
export function createAnimation({draw,restore,status,request=requestAnimationFrame,cancel=cancelAnimationFrame,now=()=>performance.now()}){
  let frames=[],elapsed=0,started=0,token=null,mode='idle';
  const clear=()=>{if(token!==null)cancel(token);token=null;};
  const paint=()=>{
    const last=frames.length-1,segment=Math.min(last,Math.floor(elapsed/1000)),progress=segment===last?1:(elapsed%1000)/1000;
    draw(segment===last?frames[last]:interpolate(frames[segment],frames[segment+1],progress));
    return {segment,progress};
  };
  const tick=time=>{elapsed=Math.min(Math.max(0,time-started),(frames.length-1)*1000);const detail=paint();if(elapsed>=(frames.length-1)*1000){token=null;mode='finished';status(mode,detail);return;}status(mode,detail);token=request(tick);};
  return {
    get playing(){return mode==='playing';},get mode(){return mode;},get elapsed(){return elapsed;},
    play(snapshots){
      if(mode==='paused'){mode='playing';started=now()-elapsed;status(mode,paint());token=request(tick);return;}
      if(!snapshots?.length)return;
      clear();frames=snapshots.map(s=>structuredClone(s));elapsed=0;mode='playing';started=now();paint();status(mode,{segment:0,progress:0});token=request(tick);
    },
    pause(){if(mode!=='playing')return;elapsed=Math.min(now()-started,(frames.length-1)*1000);clear();const detail=paint();mode='paused';status(mode,detail);},
    stop(){if(mode==='idle')return;clear();mode='idle';elapsed=0;frames=[];restore();status(mode,{segment:0,progress:0});}
  };
}
