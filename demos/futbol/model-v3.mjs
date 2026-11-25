import {KINDS as LEGACY_KINDS,BOARDS,parseV2,emptyBoard} from './model.mjs';
export const KEY='terreno.demo.v3';
export const V2KEY='terreno.demo.v2';
export const KINDS={...LEGACY_KINDS,staff:'Técnico',step:'Step',hurdle:'Valla',hoop:'Aro',bosu:'Bosu',marker:'Chincheta',pole:'Pica',medicineball:'Balón medicinal',wall:'Barrera'};
export const TEAMS={neutral:'Sin equipo',A:'Equipo A',B:'Equipo B',wildcard:'Comodín'};
export const NUMBERS={participants:['Participantes previstos, total',0,100,true],jokers:['Comodines incluidos',0,100,true],length:['Largo (m)',.1,300,false],width:['Ancho (m)',.1,300,false],sets:['Series',1,100,true],workMinutes:['Minutos por serie',.1,180,false],restSeconds:['Descanso (seg)',1,3600,true]};
export const TEXTS={type:['Tipo',80],part:['Parte de sesión',80],objective:['Objetivo general',500],attackObjective:['Objetivos ofensivos',3000],defendObjective:['Objetivos defensivos',3000],description:['Descripción',3000],variants:['Variantes',3000]};
const fail=()=>{throw new Error('Datos fuera del contrato v3');};
const str=(v,max,min=0)=>typeof v==='string'&&v.length>=min&&v.length<=max?v:fail();
const number=(v,min,max,integer=false)=>Number.isFinite(v)&&v>=min&&v<=max&&(!integer||Number.isInteger(v))?v:fail();
const list=(v,max,parse)=>Array.isArray(v)&&v.length<=max?v.map(parse):fail();
const one=(v,values)=>values.includes(v)?v:fail();
const id=v=>str(v,80,1);
const unique=xs=>{if(new Set(xs).size!==xs.length)fail();};
const xy=(p,k)=>number(p[k],k.startsWith('x')||k==='cx'?3:5,k.startsWith('x')||k==='cx'?97:95);
export const newBoard=()=>({...emptyBoard(),zones:[]});
export const upgradeBoard=b=>({...structuredClone(b),pieces:b.pieces.map(p=>({...p,team:'neutral'})),arrows:b.arrows.map(a=>({...a,cx:(a.x+a.x2)/2,cy:(a.y+a.y2)/2,curve:false,dashed:false,team:'neutral'})),zones:[]});
export function parseBoard(b){
  const pieces=list(b.pieces,40,p=>({id:id(p.id),kind:one(p.kind,Object.keys(KINDS)),label:str(p.label,12,1),x:xy(p,'x'),y:xy(p,'y'),team:one(p.team,Object.keys(TEAMS))}));
  const arrows=list(b.arrows,30,a=>{if(typeof a.curve!=='boolean'||typeof a.dashed!=='boolean')fail();return {id:id(a.id),x:xy(a,'x'),y:xy(a,'y'),x2:xy(a,'x2'),y2:xy(a,'y2'),cx:xy(a,'cx'),cy:xy(a,'cy'),curve:a.curve,dashed:a.dashed,team:one(a.team,Object.keys(TEAMS))};});
  const zones=list(b.zones,20,z=>{const value={id:id(z.id),label:str(z.label,12,1),x:xy(z,'x'),y:xy(z,'y'),width:number(z.width,2,94),height:number(z.height,2,90),team:one(z.team,Object.keys(TEAMS))};if(value.x+value.width>97||value.y+value.height>95)fail();return value;});
  unique([...pieces,...arrows,...zones].map(p=>p.id));return {pieces,arrows,zones,text:str(b.text,3000)};
}
export function enrichTask(t){return {...t,...Object.fromEntries(Object.keys(NUMBERS).map(k=>[k,null])),...Object.fromEntries(Object.keys(TEXTS).filter(k=>k!=='objective').map(k=>[k,''])),board:newBoard()};}
function parseTask(t){
  const task={id:id(t.id),libraryId:id(t.libraryId),title:str(t.title,80,1),duration:t.duration===null?null:number(t.duration,1,180,true),board:parseBoard(t.board)};
  if(!task.title.trim())fail();
  for(const[k,[,min,max,integer]]of Object.entries(NUMBERS))task[k]=t[k]===null?null:number(t[k],min,max,integer);
  if(task.jokers!==null&&(task.participants===null||task.jokers>task.participants))fail();
  for(const[k,[,max]]of Object.entries(TEXTS))task[k]=str(t[k],max);
  return task;
}
export function migrateV2(s,library){return {...structuredClone(s),schemaVersion:3,sessions:s.sessions.map(t=>({...structuredClone(t),board:upgradeBoard(t.board),tasks:t.tasks.map(enrichTask)})),match:{...structuredClone(s.match),boards:Object.fromEntries(Object.entries(s.match.boards).map(([k,b])=>[k,upgradeBoard(b)]))},library:structuredClone(library)};}
export function parseV3(s,legacyLibrary,formations){
  if(s?.schemaVersion!==3)fail();
  // Reuse the frozen v2 envelope checks, not its task-title or board contract.
  const common=parseV2({...s,schemaVersion:2,sessions:list(s.sessions,50,t=>({...t,tasks:[],board:emptyBoard()})),match:{...s.match,boards:Object.fromEntries(Object.keys(BOARDS).map(k=>[k,emptyBoard()]))}},legacyLibrary,formations);
  const sessions=common.sessions.map((t,i)=>({...t,tasks:list(s.sessions[i].tasks,30,parseTask),board:parseBoard(s.sessions[i].board)}));
  const library=list(s.library,30,parseTask);
  const ids=[...library,...sessions.flatMap(t=>t.tasks)].map(t=>t.id);unique(ids);
  return {...common,schemaVersion:3,sessions,library,match:{...common.match,boards:Object.fromEntries(Object.keys(BOARDS).map(k=>[k,parseBoard(s.match.boards[k])]))}};
}
export function cloneExercise(t){const copy=structuredClone(t);copy.id=crypto.randomUUID();for(const item of [...copy.board.pieces,...copy.board.arrows,...copy.board.zones])item.id=crypto.randomUUID();return copy;}
