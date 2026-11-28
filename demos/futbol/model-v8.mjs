import {parseV7,newBoard7,PALETTE,TEAMS} from './model-v7.mjs';
import {parseBoard as parseBoard4} from './model-v4.mjs';
import {BOARDS} from './model.mjs';
import {domainDefaults8,parseDomain8} from './domain-model-v8.mjs';

export const KEY='terreno.demo.v8';
const fail=message=>{throw new Error(message||'Datos fuera del contrato v8');};
const text=(v,max,min=0)=>typeof v==='string'&&v.length>=min&&v.length<=max?v:fail();
const id=v=>text(v,80,1);
const list=(v,max,fn)=>Array.isArray(v)&&v.length<=max?v.map(fn):fail('Coleccion v8 no valida');
const one=(v,values)=>values.includes(v)?v:fail();
function equal(a,b){
  if(a===b)return true;
  if(!a||!b||typeof a!=='object'||typeof b!=='object'||Array.isArray(a)!==Array.isArray(b))return false;
  const ak=Object.keys(a),bk=Object.keys(b);
  return ak.length===bk.length&&ak.every(k=>Object.hasOwn(b,k)&&equal(a[k],b[k]));
}
function exact(raw,clean){if(!equal(raw,clean))fail('Campos desconocidos o normalizacion con perdida v8');return clean;}
function mapBoard(board,shot){
  const base=shot(board);
  return {...base,frames:board.frames.map(f=>({...f,snapshot:shot(f.snapshot)})),...(Object.hasOwn(board,'versions')?{versions:board.versions.map(v=>({...v,board:mapBoard(v.board,shot)}))}:{})};
}
function visitCore(s,fn){
  s.library=s.library.map(t=>({...t,board:fn(t.board)}));
  s.sessions=s.sessions.map(t=>({...t,board:fn(t.board),tasks:t.tasks.map(a=>({...a,board:fn(a.board)}))}));
  const match=v=>({...v,boards:Object.fromEntries(Object.entries(v.boards).map(([k,b])=>[k,fn(b)]))});
  s.match={...match(s.match),variants:s.match.variants.map(match)};return s;
}
function extras(b){
  const palette=Object.fromEntries(Object.keys(PALETTE).map(k=>[k,typeof b.palette?.[k]==='string'&&/^#[0-9a-f]{6}$/i.test(b.palette[k])?b.palette[k]:fail('Paleta no valida')]));
  if(Object.keys(b.palette).length!==Object.keys(palette).length)fail('Paleta fuera de contrato');
  return {fieldMode:one(b.fieldMode,['full','threeQuarter','half']),palette};
}
export function parseBoard8(raw){
  const shadow=mapBoard(raw,b=>{
    extras(b);
    return {...b,...Object.fromEntries(['pieces','arrows','zones'].map(k=>[k,b[k].map(p=>({...p,team:['C','D'].includes(one(p.team,Object.keys(TEAMS)))?'neutral':p.team}))]))};
  });
  const clean=parseBoard4(shadow);
  function restore(c,s){
    const shot=(a,b)=>({...a,...extras(b),...Object.fromEntries(['pieces','arrows','zones'].map(k=>[k,a[k].map((p,i)=>({...p,team:b[k][i].team}))]))});
    return {...shot(c,s),frames:c.frames.map((f,i)=>({...f,snapshot:shot(f.snapshot,s.frames[i].snapshot)})),...(c.versions?{versions:c.versions.map((v,i)=>({...v,board:restore(v.board,s.versions[i].board)}))}:{})};
  }
  return exact(raw,restore(clean,raw));
}
export function snapshot8(board){return structuredClone({pieces:board.pieces,arrows:board.arrows,zones:board.zones,text:board.text,...extras(board)});}
export function cloneBoard8(board,map=new Map()){
  const remap=v=>{if(!map.has(v))map.set(v,crypto.randomUUID());return map.get(v);};
  const shot=b=>({...snapshot8(b),...Object.fromEntries(['pieces','arrows','zones'].map(k=>[k,b[k].map(p=>({...p,id:remap(p.id)}))]))});
  const timeline=b=>({...shot(b),frames:b.frames.map(f=>({...f,id:remap(f.id),snapshot:shot(f.snapshot)}))});
  return {...timeline(board),versions:board.versions.map(v=>({...v,id:remap(v.id),board:timeline(v.board)}))};
}
export function parsePhoto8(value){
  if(value===null)return null;
  text(value,90000,1);
  if(!/^data:image\/png;base64,[A-Za-z0-9+/]+=*$/.test(value))fail('Foto raster normalizada requerida');
  const bytes=Uint8Array.from(atob(value.slice(22)),c=>c.charCodeAt(0));
  if(bytes.length<33||bytes[0]!==137||String.fromCharCode(...bytes.slice(1,4))!=='PNG'||String.fromCharCode(...bytes.slice(12,16))!=='IHDR')fail('Firma PNG no valida');
  const view=new DataView(bytes.buffer),w=view.getUint32(16),h=view.getUint32(20);
  if(w<1||h<1||w>128||h>128)fail('Dimensiones de foto no validas');return value;
}
function parseMatch(raw,core){
  const variant=v=>v===null?null:one(id(v),core.match.variants.map(a=>a.id));
  const boards=list(raw.boards,60,b=>exact(b,{id:id(b.id),variantId:variant(b.variantId),groupKey:one(b.groupKey,Object.keys(BOARDS)),title:text(b.title,120,1),board:parseBoard8(b.board),notes:text(b.notes,3000)}));
  const legacyNotes=list(raw.legacyNotes,117,b=>exact(b,{variantId:variant(b.variantId),boardKey:one(b.boardKey,Object.keys(BOARDS)),title:text(b.title,120,1),notes:text(b.notes,3000)}));
  const observations=list(raw.observations,13,b=>exact(b,{variantId:variant(b.variantId),text:text(b.text,3000)}));
  for(const keys of [boards.map(b=>b.id),legacyNotes.map(b=>JSON.stringify([b.variantId,b.boardKey])),observations.map(b=>b.variantId)])if(new Set(keys).size!==keys.length)fail('Identidad de partido duplicada');
  return exact(raw,{boards,legacyNotes,observations});
}
export function parseV8(raw,library,formations){
  if(raw?.schemaVersion!==8)fail('Esquema v8 requerido');
  const {domainV8,matchV8,...source}=raw;
  const boards=[];
  const shadow=visitCore({...structuredClone(source),schemaVersion:7},b=>{
    const valid=parseBoard8(b);boards.push(valid);
    return mapBoard(valid,s=>({...s,fieldMode:s.fieldMode==='threeQuarter'?'full':s.fieldMode}));
  });
  const parsed=parseV7(shadow,library,formations);exact(shadow,parsed);
  let index=0;const core=visitCore(parsed,()=>boards[index++]);core.schemaVersion=8;
  const result={...core,domainV8:parseDomain8(domainV8,core,{parseBoard:parseBoard8,parsePhoto:parsePhoto8}),matchV8:parseMatch(matchV8,core)};
  return exact(raw,result);
}
export function migrateV7(core7,library,formations){
  const core=parseV7(core7,library,formations);exact(core7,core);
  return parseV8({...structuredClone(core),schemaVersion:8,domainV8:domainDefaults8(core,{newBoard:newBoard7}),matchV8:{boards:[],legacyNotes:[],observations:[]}},library,formations);
}
