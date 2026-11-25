import {parseV3,parseBoard as parseBoardV3,KINDS as V3KINDS,newBoard as boardV3} from './model-v3.mjs';
import {BOARDS,addDays,monday} from './model.mjs';

export const KEY='terreno.demo.v4';
export const SCALE='terreno-demo-0-10-v1';
export const LOADS={'':'Sin definir',low:'Baja',medium:'Media',high:'Alta'};
export const KINDS={...V3KINDS,fullgoal:'Portería grande',bib:'Peto'};
export const ROLES={'':'Sin rol',keeper:'Portero',wildcard:'Comodín'};
export const MOVEMENTS={'':'Sin tipo',pass:'Pase',carry:'Conducción',move:'Desplazamiento',run:'Desmarque',shot:'Tiro',trajectory:'Trayectoria'};
export const uid=()=>crypto.randomUUID();
export const planDefaults=()=>({physicalObjective:'',tacticalObjective:'',plannedLoad:''});
const fail=message=>{throw new Error(message||'Datos fuera del contrato v4');};
const text=(v,max=3000,min=0)=>typeof v==='string'&&v.length>=min&&v.length<=max?v:fail();
const num=(v,min,max,int=false)=>Number.isFinite(v)&&v>=min&&v<=max&&(!int||Number.isInteger(v))?v:fail();
const optional=(v,min,max,int=false)=>v===null?null:num(v,min,max,int);
const list=(v,max,parse)=>Array.isArray(v)&&v.length<=max?v.map(parse):fail('Límite o colección v4 no válida');
const one=(v,choices)=>choices.includes(v)?v:fail();
const id=v=>text(v,80,1);
const date=v=>{text(v,10,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(v)||v<'1900-01-01'||v>'2100-12-31'||new Date(`${v}T12:00:00Z`).toISOString().slice(0,10)!==v)fail('Fecha ISO no válida');return v;};
const unique=values=>{if(new Set(values).size!==values.length)fail('IDs o jugadores repetidos');return values;};
const plan=s=>({physicalObjective:text(s.physicalObjective,1000),tacticalObjective:text(s.tacticalObjective,1000),plannedLoad:one(s.plannedLoad,Object.keys(LOADS))});
export const snapshot=b=>structuredClone({pieces:b.pieces,arrows:b.arrows,zones:b.zones,text:b.text});
export const newBoard=()=>({...boardV3(),frames:[],versions:[]});
export function upgradeBoard(b){return {...snapshot({...b,zones:b.zones??[],arrows:b.arrows??[],text:b.text??''}),pieces:b.pieces.map(p=>({...p,team:p.team??'neutral',role:p.role??''})),arrows:(b.arrows??[]).map(a=>({...a,team:a.team??'neutral',movement:a.movement??''})),frames:structuredClone(b.frames??[]),versions:structuredClone(b.versions??[])};}
export const upgradeTask=t=>({...structuredClone(t),...planDefaults(),...Object.fromEntries(Object.keys(planDefaults()).filter(k=>Object.hasOwn(t,k)).map(k=>[k,t[k]])),board:upgradeBoard(t.board)});
function legacyBoard(b){return {pieces:b.pieces.map(p=>({...p,kind:p.kind==='fullgoal'?'goal':p.kind==='bib'?'player':p.kind})),arrows:b.arrows,zones:b.zones,text:b.text};}
function parseSnapshot(b){
  const base=parseBoardV3(legacyBoard(b));
  return {...base,pieces:base.pieces.map((p,i)=>({...p,kind:one(b.pieces[i].kind,Object.keys(KINDS)),role:one(b.pieces[i].role,Object.keys(ROLES))})),arrows:base.arrows.map((a,i)=>({...a,movement:one(b.arrows[i].movement,Object.keys(MOVEMENTS))}))};
}
function parseTimeline(b){
  const base=parseSnapshot(b),frames=list(b.frames,8,f=>({id:id(f.id),title:text(f.title,80,1),snapshot:parseSnapshot(f.snapshot)}));
  unique(frames.map(f=>f.id));
  const types=new Map();
  for(const shot of [base,...frames.map(f=>f.snapshot)])for(const[k,items]of Object.entries({pieces:shot.pieces,arrows:shot.arrows,zones:shot.zones}))for(const p of items){const type=k==='pieces'?p.kind:k;if(types.has(p.id)&&types.get(p.id)!==type)fail('Identidad de recurso inconsistente entre cuadros');types.set(p.id,type);}
  return {...base,frames};
}
export function parseBoard(b){const versions=list(b.versions,12,v=>({id:id(v.id),title:text(v.title,80,1),board:parseTimeline(v.board)}));unique(versions.map(v=>v.id));return {...parseTimeline(b),versions};}
export function migrateV3(s){
  const match={...structuredClone(s.match),boards:Object.fromEntries(Object.entries(s.match.boards).map(([k,b])=>[k,upgradeBoard(b)])),bench:[],notCalled:[],positionNotes:Array(11).fill(''),variants:[]};
  return {...structuredClone(s),schemaVersion:4,sessions:s.sessions.map(t=>({...structuredClone(t),...planDefaults(),tasks:t.tasks.map(upgradeTask),board:upgradeBoard(t.board)})),library:s.library.map(upgradeTask),match,season:{name:'',objective:'',phases:[]},fixtures:[],referenceMatchId:null,records:[],nutrition:[],problems:[]};
}
export function parseV4(s,legacyLibrary,formations){
  if(s?.schemaVersion!==4)fail();
  const rawSessions=list(s.sessions,200,t=>t);
  const shadowTask=t=>({...t,board:legacyBoard(t.board)});
  const shadowSession=t=>({...t,tasks:t.tasks.map(shadowTask),board:legacyBoard(t.board)});
  const shadowMatch={...s.match,boards:Object.fromEntries(Object.keys(BOARDS).map(k=>[k,legacyBoard(s.match.boards[k])]))};
  // Frozen v3 validates the unchanged envelope and chunks of at most 50 sessions.
  const envelope={...s,schemaVersion:3,sessions:[],selectedSessionId:null,library:s.library.map(shadowTask),match:shadowMatch};
  const common=parseV3(envelope,legacyLibrary,formations);
  const normalized=[];
  for(let start=0;start<rawSessions.length;start+=50){const chunk=rawSessions.slice(start,start+50);const parsed=parseV3({...envelope,library:[],sessions:chunk.map(shadowSession),selectedSessionId:chunk.some(t=>t.id===s.selectedSessionId)?s.selectedSessionId:null},legacyLibrary,formations);normalized.push(...parsed.sessions);}
  const sessions=normalized.map((t,i)=>({...t,...plan(rawSessions[i]),board:parseBoard(rawSessions[i].board),tasks:t.tasks.map((a,j)=>({...a,...plan(rawSessions[i].tasks[j]),board:parseBoard(rawSessions[i].tasks[j].board)}))}));
  unique(sessions.map(t=>t.id));
  const library=common.library.map((t,i)=>({...t,...plan(s.library[i]),board:parseBoard(s.library[i].board)}));
  const exerciseIds=unique([...library,...sessions.flatMap(t=>t.tasks)].map(t=>t.id));
  if(s.selectedSessionId!==null&&!sessions.some(t=>t.id===s.selectedSessionId&&t.date===s.activeDate))fail('Selección de sesión no válida');
  const playerIds=common.players.map(p=>p.id),sessionIds=sessions.map(t=>t.id);
  const fixtures=list(s.fixtures,60,f=>({id:id(f.id),title:text(f.title,80,1),date:date(f.date)}));unique(fixtures.map(f=>f.id));
  const referenceMatchId=s.referenceMatchId===null?null:one(s.referenceMatchId,fixtures.map(f=>f.id));
  const phases=list(s.season.phases,20,p=>{const v={id:id(p.id),title:text(p.title,80,1),start:date(p.start),end:date(p.end)};if(v.end<v.start)fail('La fase termina antes de empezar');return v;});unique(phases.map(p=>p.id));
  const records=list(s.records,500,r=>({id:id(r.id),sessionId:r.sessionId===null?null:one(r.sessionId,sessionIds),playerId:one(r.playerId,playerIds),date:date(r.date),trainingMinutes:optional(r.trainingMinutes,0,360,true),matchMinutes:optional(r.matchMinutes,0,240,true),effort:optional(r.effort,0,10,true),scale:one(r.scale,[SCALE]),origin:one(r.origin,['registrado_simulado']),...Object.fromEntries(['fatigue','recovery','rest','discomfort','availability'].map(k=>[k,text(r[k],500)]))}));unique(records.map(r=>r.id));
  const nutrition=list(s.nutrition,100,n=>({id:id(n.id),playerId:one(n.playerId,playerIds),date:date(n.date),professional:text(n.professional,80),text:text(n.text,3000),notes:text(n.notes,1000),status:one(n.status,['Pendiente de revisión']),quality:one(n.quality,['No evaluado'])}));unique(nutrition.map(n=>n.id));
  const problems=list(s.problems,100,p=>({id:id(p.id),side:one(p.side,['own','rival']),phase:one(p.phase,['attack','defend','recover','loss']),problem:text(p.problem,1000),individual:text(p.individual,1000),collective:text(p.collective,1000),improvement:text(p.improvement,1000),exerciseId:p.exerciseId===null?null:one(p.exerciseId,exerciseIds)}));unique(problems.map(p=>p.id));
  const variant=(v,base=false)=>{
    const formation=one(v.formation,Object.keys(formations)),lineup=list(v.lineup,11,p=>one(p,playerIds));if(lineup.length!==11)fail();
    const bench=list(v.bench,18,p=>one(p,playerIds)),notCalled=list(v.notCalled,18,p=>one(p,playerIds));unique([...lineup,...bench,...notCalled]);
    const positionNotes=list(v.positionNotes,11,p=>text(p,500));if(positionNotes.length!==11)fail();
    return {...(!base?{id:id(v.id),title:text(v.title,80,1)}:{}),formation,lineup,bench,notCalled,positionNotes,boards:Object.fromEntries(Object.keys(BOARDS).map(k=>[k,parseBoard(v.boards[k])]))};
  };
  const variants=list(s.match.variants,12,v=>variant(v));unique(variants.map(v=>v.id));
  return {...common,schemaVersion:4,selectedSessionId:s.selectedSessionId,sessions,library,season:{name:text(s.season.name,80),objective:text(s.season.objective,1000),phases},fixtures,referenceMatchId,records,nutrition,problems,match:{...common.match,...variant(s.match,true),variants}};
}
export function demoIndex(record){return record.sessionId===null||record.scale!==SCALE||record.origin!=='registrado_simulado'||record.trainingMinutes===null||record.effort===null?null:record.trainingMinutes*record.effort;}
export function mdLabel(iso,fixture){if(!fixture)return 'Sin partido de referencia';const delta=Math.round((Date.parse(`${iso}T12:00:00Z`)-Date.parse(`${fixture.date}T12:00:00Z`))/86400000);return delta===0?'MD0':`MD${delta>0?'+':''}${delta}`;}
export function cloneBoard(board,map=new Map()){
  const remap=id=>{if(!map.has(id))map.set(id,uid());return map.get(id);};
  const shot=b=>({...snapshot(b),pieces:b.pieces.map(p=>({...p,id:remap(p.id)})),arrows:b.arrows.map(p=>({...p,id:remap(p.id)})),zones:b.zones.map(p=>({...p,id:remap(p.id)}))});
  const timeline=b=>({...shot(b),frames:b.frames.map(f=>({id:remap(f.id),title:f.title,snapshot:shot(f.snapshot)}))});
  return {...timeline(board),versions:board.versions.map(v=>({id:remap(v.id),title:v.title,board:timeline(v.board)}))};
}
export function cloneExercise(t,map=new Map()){
  const value=upgradeTask(t);if(!map.has(t.id))map.set(t.id,uid());return {...value,id:map.get(t.id),board:cloneBoard(value.board,map)};
}
export function duplicateWeek(state,destination,validate){
  date(destination);if(monday(destination)!==destination)fail('El destino debe ser lunes');
  const source=monday(state.activeDate),end=addDays(source,6),last=addDays(destination,6);
  if(state.sessions.some(t=>t.date>=destination&&t.date<=last))fail('La semana destino ya contiene planes; no se sobrescribe');
  const originals=state.sessions.filter(t=>t.date>=source&&t.date<=end);if(!originals.length)fail('La semana origen no tiene sesiones');if(state.sessions.length+originals.length>200)fail('Límite v4: 200 sesiones');
  const map=new Map(),candidate=structuredClone(state);for(const s of originals)map.set(s.id,uid());
  const offset=Math.round((Date.parse(`${destination}T12:00:00Z`)-Date.parse(`${source}T12:00:00Z`))/86400000);
  const copies=originals.map(s=>({...structuredClone(s),id:map.get(s.id),date:addDays(s.date,offset),tasks:s.tasks.map(t=>cloneExercise(t,map)),board:cloneBoard(s.board,map)}));
  const linked=state.problems.filter(p=>map.has(p.exerciseId)).map(p=>({...p,id:uid(),exerciseId:map.get(p.exerciseId)}));
  candidate.sessions.push(...copies);candidate.problems.push(...linked);candidate.activeDate=copies[0].date;candidate.selectedSessionId=copies[0].id;
  const result=validate(candidate);JSON.stringify(result);return result;
}
