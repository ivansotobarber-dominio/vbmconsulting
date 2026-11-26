import {parseV5} from './model-v5.mjs';
import {cloneExercise as legacyClone,duplicateWeek as legacyWeek} from './model-v4.mjs';
import {monday,addDays} from './model.mjs';
export const KEY='terreno.demo.v6';
export const OBJECTIVES={finishing:'Finalizaciones',counterpress:'Presión tras pérdida',set_pieces:'ABP',defensive_transition:'Transición defensiva',offensive_transition:'Transición ofensiva',possession:'Posesión'};
export function tags(value){
  if(!Array.isArray(value)||value.length>6||new Set(value).size!==value.length||value.some(t=>typeof t!=='string'||!Object.hasOwn(OBJECTIVES,t)))throw new Error('Etiquetas de objetivo no válidas');
  return [...value];
}
export function migrateV5(state){return {...structuredClone(state),schemaVersion:6,library:state.library.map(t=>({...structuredClone(t),objectiveTags:[]})),sessions:state.sessions.map(s=>({...structuredClone(s),tasks:s.tasks.map(t=>({...structuredClone(t),objectiveTags:[]}))}))};}
export function parseV6(state,library,formations){
  if(state?.schemaVersion!==6)throw new Error('Esquema v6 requerido');
  const common=parseV5({...state,schemaVersion:5},library,formations);
  const originals=new Map([...state.library,...state.sessions.flatMap(s=>s.tasks)].map(t=>[t.id,t]));
  const extend=t=>({...t,objectiveTags:tags(originals.get(t.id)?.objectiveTags)});
  return {...common,schemaVersion:6,library:common.library.map(extend),sessions:common.sessions.map(s=>({...s,tasks:s.tasks.map(extend)}))};
}
export function cloneExercise(exercise,map=new Map()){return {...legacyClone(exercise,map),objectiveTags:tags(exercise.objectiveTags)};}
export function duplicateWeek(state,destination,validate){
  return legacyWeek(state,destination,candidate=>{
    const copies=candidate.sessions.slice(state.sessions.length);
    // Legacy duplication preserves order; pair by the single date offset, not title or libraryId.
    const start=monday(state.activeDate),end=addDays(start,6);
    const source=state.sessions.filter(s=>s.date>=start&&s.date<=end);
    copies.forEach((s,i)=>s.tasks.forEach((t,j)=>{t.objectiveTags=tags(source[i].tasks[j].objectiveTags);}));
    return validate(candidate);
  });
}
