import {BOARDS} from './model.mjs';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icon=name=>`<i data-lucide="${name}" aria-hidden="true"></i>`;
export function matchEntries8(state,variantId=null){
  const match=variantId?state.match.variants.find(v=>v.id===variantId):state.match;
  if(!match)return [];
  return [...Object.entries(BOARDS).map(([key,title])=>{const meta=state.matchV8.legacyNotes.find(n=>n.variantId===variantId&&n.boardKey===key);return {id:JSON.stringify(['legacy',key]),sourceId:key,groupKey:key,title:meta?.title??title,notes:meta?.notes??'',board:match.boards[key],legacy:true};}),...state.matchV8.boards.filter(b=>b.variantId===variantId).map(b=>({...b,id:JSON.stringify(['additional',b.id]),sourceId:b.id,legacy:false}))];
}
export const matchEntry8=(state,variantId,id)=>matchEntries8(state,variantId).find(b=>b.id===id);
export function renderMatchboards8(state,variantId,{renderBoard}){
  const entries=matchEntries8(state,variantId);
  return `<section class="v8m-workspace"><div class="section-heading"><h2>Pizarras de partido</h2><div class="v8m-actions"><button type="button" class="secondary" data-action="v8m-project">${icon('presentation')}Proyectar</button><button type="button" class="secondary" data-action="v8m-print">${icon('printer')}Imprimir partido</button></div></div>${Object.entries(BOARDS).map(([key,title])=>`<section class="v8m-group"><div class="section-heading"><h3>${esc(title)}</h3><button class="icon-button secondary" type="button" data-action="v8m-new" data-group="${key}" title="Nueva situacion" aria-label="Nueva situacion en ${esc(title)}">${icon('plus')}</button></div><div class="v8m-list">${entries.filter(b=>b.groupKey===key).map(b=>`<article class="v8m-item"><button type="button" class="v8m-open" data-action="v8m-open" data-id="${esc(b.id)}">${renderBoard(b.board,{interactive:false,selectedId:null,label:b.title,print:false})}<span><strong>${esc(b.title)}</strong>${b.notes?`<small>${esc(b.notes)}</small>`:''}</span></button><button type="button" class="icon-button secondary" data-action="v8m-copy" data-id="${esc(b.id)}" title="Copiar pizarra" aria-label="Copiar ${esc(b.title)}">${icon('copy')}</button>${b.legacy?'':`<button type="button" class="icon-button danger" data-action="v8m-remove" data-id="${esc(b.id)}" title="Eliminar pizarra" aria-label="Eliminar ${esc(b.title)}">${icon('trash-2')}</button>`}</article>`).join('')}</div></section>`).join('')}<form id="v8m-observation"><label for="v8m-final">Observacion final (opcional)</label><textarea id="v8m-final" name="text" maxlength="3000" rows="2">${esc(state.matchV8.observations.find(n=>n.variantId===variantId)?.text??'')}</textarea><button class="secondary" type="submit">${icon('check')}Guardar observacion</button></form></section>`;
}
export function renderMatchMeta8(entry){
  return `<form id="v8m-board-meta" class="v8m-meta"><label for="v8m-title">Situacion</label><input id="v8m-title" name="title" maxlength="120" required value="${esc(entry.title)}"><label for="v8m-notes">Notas de esta pizarra</label><textarea id="v8m-notes" name="notes" rows="2" maxlength="3000">${esc(entry.notes)}</textarea><button class="secondary" type="submit">${icon('check')}Guardar titulo y notas</button></form>`;
}
export function matchCommand8(state,command,{uid,cloneBoard,newBoard}){
  const next=structuredClone(state),v=command.variantId??null,entry=matchEntry8(next,v,command.id);
  if(command.type==='new'||command.type==='copy'){
    if(command.type==='copy'&&!entry)throw new Error('Selecciona una pizarra disponible');
    if(next.matchV8.boards.length>=60)throw new Error('Limite: 60 pizarras adicionales');
    const row={id:uid(),variantId:v,groupKey:entry?.groupKey??command.groupKey,title:entry?`${entry.title.slice(0,110)} (copia)`:'Nueva situacion',board:entry?cloneBoard(entry.board):newBoard(),notes:entry?.notes??''};
    next.matchV8.boards.push(row);return {state:next,id:JSON.stringify(['additional',row.id])};
  }
  if(command.type==='remove'){if(!entry||entry.legacy)throw new Error('Solo se eliminan pizarras adicionales');next.matchV8.boards=next.matchV8.boards.filter(b=>b.id!==entry.sourceId);return {state:next,id:null};}
  if(command.type==='meta'){
    if(!entry)throw new Error('Pizarra no disponible');
    if(entry.legacy){const key=entry.sourceId,row={variantId:v,boardKey:key,title:command.title,notes:command.notes},i=next.matchV8.legacyNotes.findIndex(n=>n.variantId===v&&n.boardKey===key);if(i<0)next.matchV8.legacyNotes.push(row);else next.matchV8.legacyNotes[i]=row;}
    else Object.assign(next.matchV8.boards.find(b=>b.id===entry.sourceId),{title:command.title,notes:command.notes});
  }
  if(command.type==='observation'){const row={variantId:v,text:command.text},i=next.matchV8.observations.findIndex(n=>n.variantId===v);if(i<0)next.matchV8.observations.push(row);else next.matchV8.observations[i]=row;}
  return {state:next,id:command.id??null};
}
export function copyMatchExtensions8(state,sourceId,targetId,{uid,cloneBoard}){
  const ext=state.matchV8;
  ext.boards.push(...ext.boards.filter(b=>b.variantId===sourceId).map(b=>({...structuredClone(b),id:uid(),variantId:targetId,board:cloneBoard(b.board)})));
  ext.legacyNotes.push(...ext.legacyNotes.filter(b=>b.variantId===sourceId).map(b=>({...b,variantId:targetId})));
  ext.observations.push(...ext.observations.filter(b=>b.variantId===sourceId).map(b=>({...b,variantId:targetId})));
}
