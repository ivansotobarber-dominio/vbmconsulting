import {SCORE_SCALE} from './model-v5.mjs';
export const rosterDefaults=(s)=>({playerId:s.players[0].id,mode:'profile',cut:s.activeDate,days:7,seasonId:'',competitionId:'',statId:null,statContext:null,ruleId:'',sanctionId:null,seasonEdit:null,competitionEdit:null});
const uid=()=>crypto.randomUUID();
const fail=m=>{throw new Error(m);};
const editorContext=ui=>({playerId:ui.playerId,seasonId:ui.seasonId,competitionId:ui.competitionId});
const sameContext=(context,ui)=>context&&['playerId','seasonId','competitionId'].every(k=>context[k]===ui[k]);
const fixtureInContext=(fixture,ui)=>fixture&&(!ui.seasonId||fixture.seasonId===ui.seasonId)&&(!ui.competitionId||fixture.competitionId===ui.competitionId);
export function reconcileStatisticEditor(state,ui){
  const row=state.statistics.find(t=>t.id===ui.statId);
  if(!row||!sameContext(ui.statContext,ui)||row.playerId!==ui.playerId||!fixtureInContext(state.fixtures.find(f=>f.id===row.fixtureId),ui)){ui.statId=null;ui.statContext=null;return null;}
  return row;
}
export function submitRoster(form,data,state,ui,shared,formCandidate,section){
  const s=structuredClone(state),v=k=>String(data.get(k)??''),n=k=>v(k)===''?null:Number(v(k)),entry=v('entryId');
  const upsert=(key,row)=>{const i=s[key].findIndex(t=>t.id===row.id);if(i<0)s[key].push(row);else s[key][i]=row;};
  if(form.id==='v5-profile'){const p=s.players.find(p=>p.id===ui.playerId);Object.assign(p,{position:v('position'),foot:v('foot'),availability:v('availability'),availabilityDate:v('availabilityDate')||null});}
  else if(form.id==='v5-season')upsert('seasons',{id:entry||uid(),name:v('seasonName').trim(),start:v('start')||null,end:v('end')||null});
  else if(form.id==='v5-competition')upsert('competitions',{id:entry||uid(),name:v('competitionName').trim(),seasonId:v('seasonId')});
  else if(form.id==='v5-session-season'){const t=s.sessions.find(t=>t.id===v('sessionId'));if(!t)fail('Selecciona una sesión existente');t.seasonId=v('planSeasonId')||null;}
  else if(form.id==='v5-stat'){
    const original=entry?state.statistics.find(t=>t.id===entry):null,target=state.fixtures.find(f=>f.id===v('fixtureId'));
    if(!fixtureInContext(target,ui))fail('El partido no corresponde al ámbito seleccionado');
    if(entry&&(!original||ui.statId!==entry||!sameContext(ui.statContext,ui)||original.playerId!==ui.playerId||!fixtureInContext(state.fixtures.find(f=>f.id===original.fixtureId),ui)))fail('El editor ya no corresponde al contexto actual; selecciona el registro de nuevo');
    if(original&&original.fixtureId!==target.id)fail('No se reasigna el partido de una estadística existente desde este editor');
    const source=v('recordId')||null;
    const row={id:entry||uid(),playerId:ui.playerId,fixtureId:v('fixtureId'),participation:v('participation'),recordId:source,minutes:source===null?n('minutes'):null,...Object.fromEntries(['goals','assists','yellow','red','effort'].map(k=>[k,n(k)]))};
    if(source){const r=s.records.find(r=>r.id===source&&r.playerId===ui.playerId);if(!r)fail('Fuente legacy no válida');r.matchMinutes=n('minutes');}
    upsert('statistics',row);
  }else if(form.id==='v5-rule'){
    if(!ui.seasonId||!ui.competitionId)fail('Selecciona temporada y competición');
    const group=s.discipline.rules.filter(r=>r.seasonId===ui.seasonId&&r.competitionId===ui.competitionId).sort((a,b)=>b.version-a.version);
    s.discipline.rules.push({id:uid(),groupId:group[0]?.groupId??uid(),version:(group[0]?.version??0)+1,seasonId:ui.seasonId,competitionId:ui.competitionId,start:v('start'),threshold:n('threshold')});
  }else if(form.id==='v5-sanction'){
    const row={id:entry||uid(),playerId:ui.playerId,seasonId:ui.seasonId,competitionId:ui.competitionId,date:v('sanctionDate'),reason:v('reason').trim(),total:Number(v('total')),served:data.getAll('served')};
    const i=s.discipline.sanctions.findIndex(r=>r.id===row.id);if(i<0)s.discipline.sanctions.push(row);else s.discipline.sanctions[i]=row;
  }else if(form.id.startsWith('v4-')){
    const next=formCandidate(form,data,state,shared);
    if(form.id==='v4-record'){
      if(section==='roster'&&v('recordPlayer')!==ui.playerId)fail('El registro debe corresponder al jugador seleccionado');
      const row=next.records.find(r=>r.id===(entry||next.records.at(-1)?.id));
      const old=state.records.find(r=>r.id===entry);
      if(row.sessionId!==null&&state.records.some(r=>r.id!==row.id&&r.playerId===row.playerId&&r.sessionId===row.sessionId)&&(!old||old.sessionId!==row.sessionId||old.playerId!==row.playerId))fail('Ya existe un registro del jugador en esa sesión; edítalo');
      Object.assign(row,Object.fromEntries(['fatigueScore','recoveryScore','wellbeingScore'].map(k=>[k,n(k)])),{scoreScale:SCORE_SCALE});
    }
    if(form.id==='v4-nutrition'){
      if(section==='roster'&&v('nutritionPlayer')!==ui.playerId)fail('La pauta debe corresponder al jugador seleccionado');
      if(!entry&&(!v('professional').trim()||!v('nutritionDate')))fail('Una pauta nueva requiere autor ficticio y fecha');
      const row=next.nutrition.find(r=>r.id===(entry||next.nutrition.at(-1)?.id));row.type=v('nutritionType');
    }
    if(form.id==='v4-fixture'){
      const row=next.fixtures.find(f=>f.id===(entry||next.fixtures.at(-1)?.id)),old=state.fixtures.find(f=>f.id===entry);
      Object.assign(row,{status:v('fixtureStatus')||'unknown',seasonId:v('fixtureSeason')||null,competitionId:v('fixtureCompetition')||null});
      if(old&&['date','status','seasonId','competitionId'].some(k=>old[k]!==row[k])&&(state.statistics.some(t=>t.fixtureId===entry)||state.discipline.sanctions.some(t=>t.served.includes(entry))))fail('Este partido tiene estadísticas o cumplimientos; concilia esas relaciones antes de cambiar fecha, estado o ámbito');
    }
    return next;
  }else return null;
  return s;
}
export function rosterAction(action,id,state,ui){
  if(action==='v5-edit-stat'){const row=state.statistics.find(t=>t.id===id);if(!row||row.playerId!==ui.playerId||!fixtureInContext(state.fixtures.find(f=>f.id===row.fixtureId),ui))fail('La estadística no corresponde al contexto seleccionado');ui.statId=id;ui.statContext=editorContext(ui);return null;}
  if(action==='v5-new-stat'){ui.statId=null;ui.statContext=null;return null;}
  if(action==='v5-edit-sanction'){ui.sanctionId=id;return null;}
  if(action==='v5-new-sanction'){ui.sanctionId=null;return null;}
  if(action==='v5-edit-season'){ui.seasonEdit=id;return null;}
  if(action==='v5-new-season'){ui.seasonEdit=null;return null;}
  if(action==='v5-edit-competition'){ui.competitionEdit=id;return null;}
  if(action==='v5-new-competition'){ui.competitionEdit=null;return null;}
  const s=structuredClone(state);
  const collections={'v5-delete-stat':'statistics','v5-delete-season':'seasons','v5-delete-competition':'competitions'};
  if(collections[action]){s[collections[action]]=s[collections[action]].filter(r=>r.id!==id);if(action==='v5-delete-stat')ui.statId=null;return s;}
  if(action==='v5-delete-sanction'){s.discipline.sanctions=s.discipline.sanctions.filter(r=>r.id!==id);ui.sanctionId=null;return s;}
  return null;
}
