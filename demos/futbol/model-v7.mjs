import {parseV6,migrateV5,tags} from './model-v6.mjs';
import {newBoard as legacyBoard,upgradeBoard as legacyUpgrade} from './model-v4.mjs';
import {monday,addDays} from './model.mjs';
export const KEY='terreno.demo.v7';
export const V6KEY='terreno.demo.v6';
export const SCALE='terreno-demo-0-10-v1';
export const TEAMS={neutral:'Sin equipo',A:'Equipo A',B:'Equipo B',C:'Equipo C',D:'Equipo D',wildcard:'Comodín'};
export const PALETTE={neutral:'#ffffff',A:'#f18b6d',B:'#8fc9ef',C:'#83d4a5',D:'#ef9cc5',wildcard:'#ffe99b',keeper:'#ffb85c'};
export const CATEGORIES={unknown:'Desconocida',rest:'Descanso',low:'Baja',medium:'Media',high:'Alta'};
export const BLOCKS={own:'Equipo propio',rival:'Rival y once',moments:'Cuatro momentos',abp:'ABP',strengths:'Fortalezas y debilidades'};
const fail=m=>{throw new Error(m||'Datos v7 fuera de contrato');};
const one=(v,keys)=>keys.includes(v)?v:fail();
const text=(v,max=3000)=>typeof v==='string'&&v.length<=max?v:fail();
const optional=(v,max)=>v===null?null:Number.isFinite(v)&&v>=0&&v<=max?v:fail('Valor DEMO fuera de rango');
const date=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&v>='1900-01-01'&&v<='2100-12-31'&&new Date(v+'T12:00:00Z').toISOString().slice(0,10)===v?v:fail('Fecha no válida');
export const loadDefaults=()=>({plannedMinutes:null,plannedEffort:null,actualMinutes:null,actualEffort:null,scaleId:SCALE});
function parseLoad(v=loadDefaults()){
  const r={scaleId:one(v.scaleId,[SCALE])};
  for(const k of ['plannedMinutes','actualMinutes','plannedEffort','actualEffort']){r[k]=optional(v[k],k.endsWith('Minutes')?360:10);if(k.endsWith('Minutes')&&r[k]!==null&&!Number.isInteger(r[k]))fail('Minutos enteros requeridos');}
  return r;
}
function extras(b){
  const palette=b.palette??PALETTE;
  if(Object.keys(palette).length!==Object.keys(PALETTE).length)fail('Paleta incompleta');
  return {fieldMode:one(b.fieldMode??'full',['full','half']),palette:Object.fromEntries(Object.keys(PALETTE).map(k=>[k,typeof palette[k]==='string'&&/^#[0-9a-f]{6}$/i.test(palette[k])?palette[k]:fail('Color no válido')]))};
}
export const snapshot7=b=>structuredClone({pieces:b.pieces,arrows:b.arrows,zones:b.zones,text:b.text,...extras(b)});
function boardMap(b,fn){
  return {...fn(b),frames:(b.frames??[]).map(f=>({...f,snapshot:fn(f.snapshot)})),...(b.versions?{versions:b.versions.map(v=>({...v,board:boardMap(v.board,fn)}))}:{})};
}
function visitBoards(s,fn){
  s.library=s.library.map(t=>({...t,board:fn(t.board)}));
  s.sessions=s.sessions.map(t=>({...t,board:fn(t.board),tasks:t.tasks.map(a=>({...a,board:fn(a.board)}))}));
  const match=v=>({...v,boards:Object.fromEntries(Object.entries(v.boards).map(([k,b])=>[k,fn(b)]))});
  s.match={...match(s.match),variants:s.match.variants.map(match)};return s;
}
export function migrateV6(state){
  const s=visitBoards(structuredClone(state),b=>boardMap(b,shot=>({...structuredClone(shot),...extras(shot)})));
  s.schemaVersion=7;s.sessions=s.sessions.map(t=>({...t,load:loadDefaults()}));s.manualLoads={days:{},weeks:{}};
  s.analysisV7={rivalFormation:'4-3-3',rivalLineup:[],ownABPAttack:'',ownABPDefend:'',rivalABPAttack:'',rivalABPDefend:'',blocks:Object.keys(BLOCKS)};return s;
}
export function parseV7(raw,library,formations){
  if(raw?.schemaVersion!==7)fail('Esquema v7 requerido');
  const shadow=visitBoards(structuredClone(raw),b=>boardMap(b,shot=>{
    extras(shot);
    const items=key=>shot[key].map(p=>({...p,team:['C','D'].includes(one(p.team,Object.keys(TEAMS)))?'neutral':p.team}));
    return {...shot,pieces:items('pieces'),arrows:items('arrows'),zones:items('zones')};
  }));
  const normalized=parseV6({...shadow,schemaVersion:6},library,formations);
  const rawBoards=[];visitBoards(structuredClone(raw),b=>{rawBoards.push(b);return b;});let index=0;
  const restore=(clean,source)=>{
    const shot=(c,s)=>({...c,...extras(s),...Object.fromEntries(['pieces','arrows','zones'].map(k=>[k,c[k].map((p,i)=>({...p,team:s[k][i].team}))]))});
    return {...shot(clean,source),frames:clean.frames.map((f,i)=>({...f,snapshot:shot(f.snapshot,source.frames[i].snapshot)})),...(clean.versions?{versions:clean.versions.map((v,i)=>({...v,board:restore(v.board,source.versions[i].board)}))}:{})};
  };
  const s=visitBoards(normalized,b=>restore(b,rawBoards[index++]));s.schemaVersion=7;
  s.sessions=s.sessions.map((t,i)=>({...t,load:parseLoad(raw.sessions[i].load)}));
  const manual=raw.manualLoads;if(!manual||typeof manual!=='object')fail('Categorías manuales requeridas');
  s.manualLoads=Object.fromEntries(['days','weeks'].map(k=>{
    const map=manual[k];if(!map||typeof map!=='object'||Array.isArray(map)||Object.keys(map).length>1000)fail('Límite de categorías manuales');
    return[k,Object.fromEntries(Object.entries(map).map(([d,v])=>{date(d);if(k==='weeks'&&monday(d)!==d)fail('La semana debe empezar un lunes');return[d,one(v,Object.keys(CATEGORIES))];}))];
  }));
  const a=raw.analysisV7;if(!a||!Array.isArray(a.rivalLineup)||a.rivalLineup.length>11||new Set(a.rivalLineup).size!==a.rivalLineup.length||a.rivalLineup.some(id=>!s.rivals.some(p=>p.id===id)))fail('Once rival no válido');
  if(!Array.isArray(a.blocks)||a.blocks.length>5||new Set(a.blocks).size!==a.blocks.length)fail('Bloques de presentación no válidos');
  s.analysisV7={rivalFormation:one(a.rivalFormation,Object.keys(formations)),rivalLineup:[...a.rivalLineup],blocks:a.blocks.map(v=>one(v,Object.keys(BLOCKS))),...Object.fromEntries(['ownABPAttack','ownABPDefend','rivalABPAttack','rivalABPDefend'].map(k=>[k,text(a[k])]))};return s;
}
export const newBoard7=()=>({...legacyBoard(),...extras({})});
export const upgradeBoard7=b=>({...legacyUpgrade(b),...extras(b)});
export function cloneBoard7(b,map=new Map()){
  const id=v=>{if(!map.has(v))map.set(v,crypto.randomUUID());return map.get(v);};
  const shot=v=>({...snapshot7(v),...Object.fromEntries(['pieces','arrows','zones'].map(k=>[k,v[k].map(p=>({...p,id:id(p.id)}))]))});
  const timeline=v=>({...shot(v),frames:(v.frames??[]).map(f=>({id:id(f.id),title:f.title,snapshot:shot(f.snapshot)}))});
  return {...timeline(b),versions:(b.versions??[]).map(v=>({id:id(v.id),title:v.title,board:timeline(v.board)}))};
}
export function cloneExercise7(t,map=new Map()){
  if(!map.has(t.id))map.set(t.id,crypto.randomUUID());return {...structuredClone(t),id:map.get(t.id),objectiveTags:tags(t.objectiveTags),board:cloneBoard7(t.board,map)};
}
export function duplicateWeek7(state,destination,validate){
  date(destination);if(monday(destination)!==destination)fail('Selecciona un lunes');
  const start=monday(state.activeDate),end=addDays(start,6),last=addDays(destination,6);
  if(state.sessions.some(s=>s.date>=destination&&s.date<=last))fail('La semana destino ya contiene sesiones');
  const source=state.sessions.filter(s=>s.date>=start&&s.date<=end);if(!source.length||source.length+state.sessions.length>200)fail('Semana vacía o límite de 200 sesiones');
  const offset=(Date.parse(destination+'T12:00:00Z')-Date.parse(start+'T12:00:00Z'))/86400000,map=new Map(),s=structuredClone(state);
  const copies=source.map(t=>{map.set(t.id,crypto.randomUUID());return {...structuredClone(t),id:map.get(t.id),date:addDays(t.date,offset),board:cloneBoard7(t.board,map),tasks:t.tasks.map(a=>cloneExercise7(a,map)),load:{...t.load,actualMinutes:null,actualEffort:null}};});
  s.sessions.push(...copies);s.problems.push(...state.problems.filter(p=>map.has(p.exerciseId)).map(p=>({...p,id:crypto.randomUUID(),exerciseId:map.get(p.exerciseId)})));s.activeDate=copies[0].date;s.selectedSessionId=copies[0].id;return validate(s);
}
export function copyToSession7(state,id,destination,validate){
  const exercise=state.library.find(t=>t.id===id),target=state.sessions.find(s=>s.id===destination);if(!exercise||!target)fail('Selecciona ejercicio y sesión de destino');if(target.tasks.length>=30)fail('Límite de 30 ejercicios');
  const candidate=structuredClone(state),copy=cloneExercise7(exercise);candidate.sessions.find(s=>s.id===destination).tasks.push(copy);return {candidate:validate(candidate),copyId:copy.id};
}
export function compareLoad(load){
  const valid=load?.scaleId===SCALE,number=v=>Number.isFinite(v)&&v>=0;
  const side=p=>valid&&number(load[p+'Minutes'])&&load[p+'Minutes']<=360&&number(load[p+'Effort'])&&load[p+'Effort']<=10?load[p+'Minutes']*load[p+'Effort']:null;
  const planned=side('planned'),actual=side('actual'),delta=planned!==null&&actual!==null?actual-planned:null;
  return {planned,actual,delta,percent:delta!==null&&planned>0?100*delta/planned:null};
}
export function aggregateLoads(sessions){
  const unique=[...new Map(sessions.map(s=>[s.id,s])).values()],pairs=unique.map(s=>compareLoad(s.load)).filter(v=>v.delta!==null);
  const planned=pairs.reduce((n,v)=>n+v.planned,0),actual=pairs.reduce((n,v)=>n+v.actual,0),delta=pairs.length?actual-planned:null;
  return {n:pairs.length,N:unique.length,planned:pairs.length?planned:null,actual:pairs.length?actual:null,delta,percent:delta!==null&&planned>0?100*delta/planned:null};
}
