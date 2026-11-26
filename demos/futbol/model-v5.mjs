import {parseV4,SCALE} from './model-v4.mjs';
export const KEY='terreno.demo.v5',V4KEY='terreno.demo.v4',SCORE_SCALE='terreno-bienestar-demo-0-10-v1';
export const PARTICIPATION={unknown:'Desconocida',not_called:'No convocado',called_unknown:'Convocado sin participación definida',starter:'Titular',substitute:'Suplente utilizado',bench:'Suplente sin jugar'};
export const STATUS={unknown:'Desconocido',planned:'Programado',played:'Jugado',postponed:'Aplazado',cancelled:'Cancelado'};
export const AVAILABILITY={'':'Sin definir',available:'Disponible',limited:'Limitada',unavailable:'No disponible'};
export const NUTRITION_TYPES={'':'Sin clasificar',nutrition:'Nutrición',hydration:'Hidratación',supplement:'Suplementación'};
const fail=message=>{throw new Error(message||'Datos fuera del contrato v5');};
const text=(v,max=1000,min=0)=>typeof v==='string'&&v.length>=min&&v.length<=max?v:fail('Texto fuera de límites');
const id=v=>text(v,80,1),one=(v,choices)=>choices.includes(v)?v:fail('Opción no admitida');
const number=(v,min,max,int=true)=>Number.isFinite(v)&&v>=min&&v<=max&&(!int||Number.isInteger(v))?v:fail('Número fuera de límites');
const optional=(v,min,max)=>v===null?null:number(v,min,max);
const list=(v,max,parse)=>Array.isArray(v)&&v.length<=max?v.map(parse):fail('Tope o colección v5 no válida');
const unique=values=>{if(new Set(values).size!==values.length)fail('Identidad o relación duplicada');return values;};
export function iso(v){text(v,10,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(v)||v<'1900-01-01'||v>'2100-12-31'||new Date(`${v}T12:00:00Z`).toISOString().slice(0,10)!==v)fail('Fecha ISO no válida');return v;}
const maybeDate=v=>v===null?null:iso(v);
export function migrateV4(s){return {...structuredClone(s),schemaVersion:5,players:s.players.map(p=>({...p,position:'',foot:'',availability:'',availabilityDate:null})),sessions:s.sessions.map(t=>({...t,seasonId:null})),fixtures:s.fixtures.map(f=>({...f,status:'unknown',seasonId:null,competitionId:null})),records:s.records.map(r=>({...r,fatigueScore:null,recoveryScore:null,wellbeingScore:null,scoreScale:SCORE_SCALE})),nutrition:s.nutrition.map(n=>({...n,type:''})),seasons:[],competitions:[],statistics:[],discipline:{rules:[],sanctions:[]}};}
export const matchMinutes=(s,row)=>row.recordId===null?row.minutes:s.records.find(r=>r.id===row.recordId)?.matchMinutes??null;
export function parseV5(s,library,formations){
  if(s?.schemaVersion!==5)fail('Esquema v5 requerido');
  const common=parseV4({...s,schemaVersion:4,records:[],fixtures:[],referenceMatchId:null},library,formations);
  const seasons=list(s.seasons,10,t=>{const v={id:id(t.id),name:text(t.name,80,1),start:maybeDate(t.start),end:maybeDate(t.end)};if(v.start&&v.end&&v.end<v.start)fail('Fechas de temporada invertidas');return v;});unique(seasons.map(t=>t.id));
  const seasonIds=seasons.map(t=>t.id),competitions=list(s.competitions,20,t=>({id:id(t.id),name:text(t.name,80,1),seasonId:one(t.seasonId,seasonIds)}));unique(competitions.map(t=>t.id));
  const scope=(seasonId,competitionId,required=false)=>{if(!required&&seasonId===null&&competitionId===null)return;if(!seasonIds.includes(seasonId)||!competitions.some(c=>c.id===competitionId&&c.seasonId===seasonId))fail('Temporada y competición incompatibles');};
  const players=common.players.map((p,i)=>({...p,position:text(s.players[i].position,80),foot:one(s.players[i].foot,['','right','left','both']),availability:one(s.players[i].availability,Object.keys(AVAILABILITY)),availabilityDate:maybeDate(s.players[i].availabilityDate)}));
  const playerIds=players.map(p=>p.id),sessionIds=common.sessions.map(t=>t.id);
  const sessions=common.sessions.map((t,i)=>({...t,seasonId:s.sessions[i].seasonId==null?null:one(s.sessions[i].seasonId,seasonIds)}));
  const fixtures=list(s.fixtures,120,f=>{const value={id:id(f.id),title:text(f.title,80,1),date:iso(f.date),status:one(f.status??'unknown',Object.keys(STATUS)),seasonId:f.seasonId??null,competitionId:f.competitionId??null};scope(value.seasonId,value.competitionId);return value;});unique(fixtures.map(f=>f.id));
  const records=list(s.records,5000,r=>({id:id(r.id),playerId:one(r.playerId,playerIds),sessionId:r.sessionId===null?null:one(r.sessionId,sessionIds),date:iso(r.date),trainingMinutes:optional(r.trainingMinutes,0,360),matchMinutes:optional(r.matchMinutes,0,240),effort:optional(r.effort,0,10),scale:one(r.scale,[SCALE]),origin:one(r.origin,['registrado_simulado']),...Object.fromEntries(['fatigue','recovery','rest','discomfort','availability'].map(k=>[k,text(r[k],500)])),...Object.fromEntries(['fatigueScore','recoveryScore','wellbeingScore'].map(k=>[k,optional(r[k]??null,0,10)])),scoreScale:one(r.scoreScale??SCORE_SCALE,[SCORE_SCALE])}));unique(records.map(r=>r.id));
  const fixtureFor=(fixtureId,seasonId=null,competitionId=null)=>{const f=fixtures.find(f=>f.id===fixtureId);if(!f||f.status!=='played'||f.seasonId===null||f.competitionId===null||(seasonId!==null&&(f.seasonId!==seasonId||f.competitionId!==competitionId)))fail('Se requiere partido jugado y atribuido al ámbito');return f;};
  const statistics=list(s.statistics,2000,t=>{
    const v={id:id(t.id),fixtureId:id(t.fixtureId),playerId:one(t.playerId,playerIds),participation:one(t.participation,Object.keys(PARTICIPATION)),recordId:t.recordId===null?null:id(t.recordId),minutes:optional(t.minutes,0,240),goals:optional(t.goals,0,50),assists:optional(t.assists,0,50),yellow:optional(t.yellow,0,20),red:optional(t.red,0,1),effort:optional(t.effort,0,10)};fixtureFor(v.fixtureId);
    if(v.recordId!==null){if(v.minutes!==null||!records.some(r=>r.id===v.recordId&&r.playerId===v.playerId))fail('Fuente de minutos incompatible o duplicada');}
    const minutes=matchMinutes({records},v);if(!['starter','substitute'].includes(v.participation)&&[minutes,v.goals,v.assists].some(n=>n!==null&&n>0))fail('Participación incompatible con minutos/goles/asistencias');return v;
  });unique(statistics.map(t=>t.id));unique(statistics.map(t=>`${t.fixtureId}:${t.playerId}`));unique(statistics.filter(t=>t.recordId!==null).map(t=>t.recordId));
  if(!s.discipline||!Array.isArray(s.discipline.rules)||!Array.isArray(s.discipline.sanctions)||s.discipline.rules.length+s.discipline.sanctions.length>200)fail('Tope combinado: 200 reglas/versiones y sanciones');
  const rules=list(s.discipline.rules,200,r=>{const v={id:id(r.id),groupId:id(r.groupId),version:number(r.version,1,200),seasonId:id(r.seasonId),competitionId:id(r.competitionId),start:iso(r.start),threshold:optional(r.threshold,1,50)};scope(v.seasonId,v.competitionId,true);return v;});unique(rules.map(r=>r.id));unique(rules.map(r=>`${r.groupId}:${r.version}`));
  for(const groupId of new Set(rules.map(r=>r.groupId))){const group=rules.filter(r=>r.groupId===groupId).sort((a,b)=>a.version-b.version);for(let i=0;i<group.length;i++)if(group[i].version!==i+1||group[i].seasonId!==group[0].seasonId||group[i].competitionId!==group[0].competitionId)fail('Historial de regla inconsistente');}
  const scopeGroups=new Map();for(const r of rules){const key=`${r.seasonId}:${r.competitionId}`;if(scopeGroups.has(key)&&scopeGroups.get(key)!==r.groupId)fail('Un grupo de reglas por ámbito');scopeGroups.set(key,r.groupId);}
  const sanctions=list(s.discipline.sanctions,200,r=>{const v={id:id(r.id),playerId:one(r.playerId,playerIds),seasonId:id(r.seasonId),competitionId:id(r.competitionId),date:iso(r.date),reason:text(r.reason,1000,1),total:number(r.total,1,100),served:list(r.served,100,x=>id(x))};scope(v.seasonId,v.competitionId,true);unique(v.served);if(v.served.length>v.total)fail('Cumplimiento superior a sanción confirmada');for(const f of v.served)if(fixtureFor(f,v.seasonId,v.competitionId).date<v.date)fail('Cumplimiento anterior a sanción');return v;});unique(sanctions.map(r=>r.id));
  const nutrition=common.nutrition.map((n,i)=>({...n,type:one(s.nutrition[i].type??'',Object.keys(NUTRITION_TYPES))}));
  return {...common,schemaVersion:5,players,sessions,fixtures,records,nutrition,referenceMatchId:s.referenceMatchId===null?null:one(s.referenceMatchId,fixtures.map(f=>f.id)),seasons,competitions,statistics,discipline:{rules,sanctions}};
}
