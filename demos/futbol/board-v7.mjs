import {objectSVG as legacyObject,boardEditor as legacyEditor,inspector as legacyInspector,boardItems,teamColor,itemKind} from './board-v4.mjs';
import {PALETTE,TEAMS} from './model-v7.mjs';
const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let serial=0;
export function inspector7(board,p){
  return legacyInspector(board,p).replace(/(<select id="piece-team"[^>]*>)[\s\S]*?<\/select>/,(_,open)=>open+Object.entries(TEAMS).map(([k,v])=>`<option value="${k}" ${p?.team===k?'selected':''}>${v}</option>`).join('')+'</select>');
}
export function objectSVG7(p,selected,marker,interactive=true,palette=PALETTE){
  const team=['C','D'].includes(p.team)?'A':p.team;
  const key=p.role==='keeper'?'keeper':p.role==='wildcard'?'wildcard':p.team;
  const color=palette[key]??PALETTE[key],original=teamColor(team);
  let svg=legacyObject({...p,team},selected,marker,interactive);
  if(color&&original)svg=svg.replaceAll(original,color);
  if(color&&(p.role||team!=='neutral')){
    if(itemKind(p)==='arrow')svg=svg.replaceAll('#ffe99b',color);
  }
  return svg;
}
export function boardSVG7(board,lines,selected=null,interactive=false){
  const marker='v7-direction-'+(++serial),mode=board.fieldMode??'full',width={full:900,threeQuarter:675,half:450}[mode]??900;
  return `<svg ${interactive?'id="pitch"':''} class="${interactive?'pitch':'mini-pitch'} v7-pitch" viewBox="0 0 ${width} 580" data-field="${mode}" role="${interactive?'group':'img'}" aria-label="${{full:'Campo completo',threeQuarter:'Tres cuartos de campo',half:'Medio campo izquierdo'}[mode]}" data-marker="${marker}" xmlns="http://www.w3.org/2000/svg"><defs><marker id="${marker}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10Z" fill="context-stroke"/></marker></defs>${lines()}<g ${interactive?'id="pieces"':''}>${[...board.zones,...board.arrows,...board.pieces].map(p=>objectSVG7(p,p.id===selected,marker,interactive,board.palette)).join('')}</g></svg>`;
}
export function boardEditor7(board,lines,id,advanced='',quick=''){
  const projection={...board,pieces:board.pieces.map(p=>({...p,team:['C','D'].includes(p.team)?'A':p.team})),arrows:board.arrows.map(p=>({...p,team:['C','D'].includes(p.team)?'A':p.team})),zones:board.zones.map(p=>({...p,team:['C','D'].includes(p.team)?'A':p.team}))};
  const p=boardItems(board).find(p=>p.id===id);
  const template=document.createElement('template');template.innerHTML=legacyEditor(projection,lines,id);
  const section=template.content.querySelector('.board-layout > section');section.querySelector('svg').remove();
  const limit={half:50,threeQuarter:75,full:100}[board.fieldMode]??100;
  const outside=boardItems(board).filter(p=>Math.max(p.x+(p.width??0),p.x2??0,p.curve?p.cx??0:0)>limit).length;
  const encuadre=`<div class="segmented" role="group" aria-label="Encuadre del campo">${[['full','Completo'],['threeQuarter','Tres cuartos'],['half','Medio']].map(([k,v])=>`<button type="button" data-action="v7-field" data-value="${k}" aria-pressed="${board.fieldMode===k}">${v}</button>`).join('')}</div>`;
  const palette=`<details class="v7-palette" id="v7-palette-details"><summary>Colores de equipos y roles</summary><div class="v7-swatches">${Object.entries(PALETTE).map(([k,v])=>`<label>${esc(TEAMS[k]??'Portero')}<input type="color" data-v7-color="${k}" value="${board.palette?.[k]??v}" aria-label="Color ${esc(TEAMS[k]??'Portero')}"></label>`).join('')}</div></details>`;
  return `<div class="v7-tactical-workspace"><section class="v7-field-stage" aria-label="Campo y reproducción"><div class="v7-quickbar">${encuadre}${quick}</div>${boardSVG7(board,lines,id,true)}${outside?`<p class="v7-outside" role="status">${outside} recursos fuera del encuadre, conservados</p>`:''}<details class="v7-board-note" id="v7-board-note"><summary>Consigna y recursos (${boardItems(board).length})</summary>${section.innerHTML}</details></section><aside class="v7-toolbox" aria-label="Herramientas de pizarra"><details id="v7-tools-drawer"><summary>Fases, materiales y colores</summary>${advanced}${palette}<section id="board-inspector" class="board-inspector" data-selected="${esc(p?.id??'')}">${inspector7(board,p)}</section></details></aside></div>`;
}
export function phaseQuickToolbar7(board,ui,reduced,playing){
  const button=(action,name,icon,disabled=false)=>`<button type="button" class="icon-button secondary" data-action="${action}" aria-label="${name}" title="${name}" ${disabled?'disabled':''}><i data-lucide="${icon}"></i></button>`;
  return `<label for="v4-frame" class="sr-only">Fase táctica</label><select id="v4-frame" aria-label="Fase táctica"><option value="-1" ${ui.frameIndex<0?'selected':''}>Base</option>${board.frames.map((f,i)=>`<option value="${i}" ${ui.frameIndex===i?'selected':''}>${esc(f.title)}</option>`).join('')}</select><div class="v7-transport" role="group" aria-label="Reproducción de fases">${button('v4-step-back','Fase anterior','skip-back',ui.frameIndex<0)}${button('v4-play',playing?'Pausar':'Reproducir fases',playing?'pause':'play',reduced||!board.frames.length)}${button('v6-stop','Detener y restaurar seleccionado','square')}${button('v4-step-next','Fase siguiente','skip-forward',ui.frameIndex>=board.frames.length-1)}</div>`;
}
export function phaseToolbar7(board,ui,reduced,playing){
  const button=(action,name,icon,disabled=false)=>`<button type="button" class="icon-button secondary" data-action="${action}" aria-label="${name}" title="${name}" ${disabled?'disabled':''}><i data-lucide="${icon}"></i></button>`;
  return `<div class="frame-tools v7-phases"><div class="frame-commands">${button('v4-add-frame','Guardar nueva fase','plus',board.frames.length>=8)}${button('v4-delete-frame','Eliminar fase','trash-2',ui.frameIndex<0)}</div><form id="v7-phase-form"><label for="v7-phase-title">Nombre de fase</label><input id="v7-phase-title" name="title" maxlength="80" required value="${esc(board.frames[ui.frameIndex]?.title??'Base')}" ${ui.frameIndex<0?'disabled':''}>${button('v7-rename-phase','Guardar nombre de fase','check',ui.frameIndex<0)}</form><div class="frame-commands"><label for="v4-versionTitle">Versión táctica</label><input id="v4-versionTitle" maxlength="80" placeholder="Nombre de versión">${button('v4-save-version','Guardar versión','copy-plus')}<select id="v4-version" aria-label="Versión guardada"><option value="">Seleccionar</option>${board.versions.map(v=>`<option value="${esc(v.id)}">${esc(v.title)}</option>`).join('')}</select>${button('v4-restore-version','Cargar copia de versión','folder-open')}${button('v4-export-svg','SVG de fase','image-down')}${button('v4-print-frame','Imprimir fase','printer')}${button('v7-record','Grabar vídeo local','video',reduced||!board.frames.length)}${button('v7-record-stop','Detener grabación','circle-stop')}</div><p id="v7-video-status" role="status"></p><p id="v6-preview-status" role="status">Seleccionado: ${ui.frameIndex<0?'Base':esc(board.frames[ui.frameIndex]?.title??'')}</p>${reduced?'<p>Movimiento reducido: fases manuales. Vídeo no iniciado.</p>':''}</div>`;
}
