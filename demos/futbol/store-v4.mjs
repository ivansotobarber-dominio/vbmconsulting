export class LocalStoreV4{
  constructor({key,parse,seed,legacy}){Object.assign(this,{key,parse,seed,legacy});this.raw=null;this.sources={};this.needsSave=false;this.blocked=false;this.message='';}
  read(){
    try{
      this.raw=localStorage.getItem(this.key);
      if(this.raw!==null)return this.parse(JSON.parse(this.raw));
      this.needsSave=true;
      for(const entry of this.legacy){const raw=localStorage.getItem(entry.key);this.sources[entry.key]=raw;if(raw!==null)return this.parse(entry.convert(JSON.parse(raw)));}
      return this.parse(this.seed());
    }catch(error){this.blocked=true;this.message=`No se pudo recuperar el guardado (${error.name}). Demo temporal en memoria, sin sobrescribir fuentes. Exporta JSON antes de cerrar.`;return this.parse(this.seed());}
  }
  write(state){
    const candidate=this.parse(state);
    if(this.blocked)return {state:candidate,saved:false};
    try{
      if(localStorage.getItem(this.key)!==this.raw||(this.needsSave&&Object.entries(this.sources).some(([key,raw])=>localStorage.getItem(key)!==raw)))throw new Error('Conflicto de pestañas o migración');
      candidate.revision++;candidate.updatedAt=new Date().toISOString();const raw=JSON.stringify(candidate);localStorage.setItem(this.key,raw);
      if(localStorage.getItem(this.key)!==raw)throw new Error('Conflicto de verificación');
      this.raw=raw;this.needsSave=false;return {state:candidate,saved:true};
    }catch(error){this.blocked=true;this.message=`${error.name==='QuotaExceededError'?'Cuota local agotada':error.message.includes('Conflicto')?error.message:'Acceso al guardado bloqueado'}. La candidata y los borradores se conservan en memoria exportable; no se confirma guardado.`;return {state:candidate,saved:false};}
  }
  reset(){this.raw=localStorage.getItem(this.key);this.sources={};this.needsSave=false;this.blocked=false;this.message='';}
  affected(key){return key===null||key===this.key||(this.needsSave&&Object.hasOwn(this.sources,key));}
  conflict(){this.blocked=true;this.message='Otra pestaña ha cambiado los datos. Esta versión y sus borradores siguen en memoria; exporta antes de recargar. No se sobrescribirá la versión ajena.';}
}
