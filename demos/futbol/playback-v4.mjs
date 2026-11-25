export function createPlayback(step,onStop){
  let timer=null;
  return {get playing(){return timer!==null;},play(){if(timer===null)timer=setInterval(step,1000);},stop(){if(timer!==null){clearInterval(timer);timer=null;onStop();}}};
}
