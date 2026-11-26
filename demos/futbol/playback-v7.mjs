import {createAnimation,interpolate} from './animation-v6.mjs';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
export function createPlayback7({draw,restore,status,renderSVG,videoStatus}){
  const animation=createAnimation({draw,restore,status});let recording=null;
  const cancelRecord=()=>{if(recording){recording.cancelled=true;recording.finish=true;}};
  const controller={
    get playing(){return animation.playing;},get mode(){return animation.mode;},get elapsed(){return animation.elapsed;},get recording(){return Boolean(recording);},
    play:frames=>animation.play(frames),pause:()=>animation.pause(),
    stop(){cancelRecord();animation.stop();},
    stopRecording(){if(recording)recording.finish=true;},
    async record(frames){
      if(recording)throw new Error('Ya hay una grabación local en curso');
      animation.stop();
      if(!frames?.length)throw new Error('Guarda al menos una fase');
      const canvas=document.createElement('canvas');canvas.width=900;canvas.height=580;
      const mime=typeof MediaRecorder==='function'&&typeof canvas.captureStream==='function'?['video/webm;codecs=vp8','video/webm;codecs=vp9','video/webm'].find(t=>MediaRecorder.isTypeSupported(t)):null;
      if(!mime)throw new Error('Vídeo no compatible. SVG, JSON e impresión siguen disponibles.');
      const token={finish:false,cancelled:false};recording=token;const shots=structuredClone(frames),ctx=canvas.getContext('2d'),stream=canvas.captureStream(20),chunks=[];
      const recorder=new MediaRecorder(stream,{mimeType:mime});let recorderError=null;
      const ended=new Promise(resolve=>{recorder.onstop=resolve;recorder.onerror=e=>{recorderError=e.error??new Error('Error de grabación');resolve();};});
      recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
      let downloadURL=null;
      try{
        videoStatus('Grabando vídeo local, sin audio ni subida.');
        recorder.start(100);
        const total=Math.max(20,(shots.length-1)*20);
        for(let i=0;i<=total&&!token.finish;i++){
          const segment=Math.min(shots.length-1,Math.floor(i/20)),progress=(i%20)/20;
          const shot=segment===shots.length-1?shots.at(-1):interpolate(shots[segment],shots[segment+1],progress);
          const image=new Image(),svg=renderSVG(shot);
          await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(new Error('No se pudo rasterizar la pizarra'));image.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);});
          ctx.fillStyle='#162c21';ctx.fillRect(0,0,900,580);
          const ratio=image.naturalWidth/image.naturalHeight||900/580,w=Math.min(900,580*ratio),h=w/ratio;ctx.drawImage(image,(900-w)/2,(580-h)/2,w,h);
          await sleep(50);
        }
        await sleep(120);if(recorder.state!=='inactive')recorder.stop();await ended;
        if(token.cancelled){videoStatus('Grabación cancelada. No se descargó vídeo.');return;}
        if(recorderError)throw recorderError;
        const blob=new Blob(chunks,{type:recorder.mimeType||mime});if(!blob.size)throw new Error('Grabación vacía');
        const video=document.createElement('video');video.muted=true;downloadURL=URL.createObjectURL(blob);
        try{await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(new Error('No se pudo verificar el vídeo grabado')),5000);video.onloadeddata=()=>{clearTimeout(timeout);resolve();};video.onerror=()=>{clearTimeout(timeout);reject(new Error('El navegador no decodifica la grabación'));};video.src=downloadURL;video.load();});if(!video.videoWidth)throw new Error('Vídeo sin fotogramas');}finally{video.removeAttribute('src');video.load();}
        if(token.cancelled)return;
        const a=document.createElement('a');a.href=downloadURL;a.download='terreno-fases-demo.webm';a.click();videoStatus(`Vídeo WebM local verificado · ${blob.size} bytes. Sin audio.`);
      }catch(error){videoStatus(`${error.message}. Vídeo pendiente; usa SVG, JSON o impresión.`);}
      finally{if(recorder.state!=='inactive'){recorder.stop();await ended;}stream.getTracks().forEach(t=>t.stop());if(downloadURL)setTimeout(()=>URL.revokeObjectURL(downloadURL),1500);recording=null;restore();}
    }
  };return controller;
}
