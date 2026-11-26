import {cloneExercise,OBJECTIVES} from './model-v6.mjs';
import {enrichTask} from './model-v3.mjs';
import {planDefaults,newBoard} from './model-v4.mjs';
export const libraryDefaults=()=>({query:'',filter:'',destination:''});
export function filteredLibrary(state,ui){
  const query=ui.query.trim().toLocaleLowerCase('es');
  return state.library.filter(t=>(!query||[t.title,t.type,t.objective,t.attackObjective,t.defendObjective,t.description].join(' ').toLocaleLowerCase('es').includes(query))&&(!ui.filter||(ui.filter==='unclassified'?!t.objectiveTags.length:t.objectiveTags.includes(ui.filter))));
}
export function newExercise(state){
  if(state.library.length>=30)throw new Error('Límite: 30 ejercicios en biblioteca');
  return {...enrichTask({id:crypto.randomUUID(),libraryId:state.library[0]?.libraryId??'rondo',title:'Nuevo ejercicio',duration:null,objective:''}),...planDefaults(),board:newBoard(),objectiveTags:[]};
}
export function copyToSession(state,exerciseId,destination,validate){
  if(!destination)throw new Error('Elige una sesión de destino');
  const exercise=state.library.find(t=>t.id===exerciseId),session=state.sessions.find(s=>s.id===destination);
  if(!exercise||!session)throw new Error('Ejercicio o sesión de destino no disponible');
  if(session.tasks.length>=30)throw new Error('Límite: 30 ejercicios por sesión');
  const candidate=structuredClone(state),copy=cloneExercise(exercise);
  candidate.sessions.find(s=>s.id===destination).tasks.push(copy);
  return {candidate:validate(candidate),copyId:copy.id};
}
export function objectiveLabels(t){return t.objectiveTags.length?t.objectiveTags.map(k=>OBJECTIVES[k]).join(' · '):'Sin clasificar';}
