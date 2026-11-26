import {V1KEY,ANCHOR,PHASES,BOARDS,addDays,monday,parseV1,parseV2,migrate,readPhoto} from './model.mjs';
import {KEY as V3KEY,V2KEY,NUMBERS,TEXTS,enrichTask,parseV3,migrateV2} from './model-v3.mjs';
import {KINDS,planDefaults,newBoard,upgradeBoard,migrateV3,parseV4,cloneBoard,snapshot,mdLabel,LOADS} from './model-v4.mjs';
import {KEY as V5KEY,V4KEY,parseV5,migrateV4} from './model-v5.mjs';
import {KEY,parseV6,migrateV5,cloneExercise,duplicateWeek} from './model-v6.mjs';
import {libraryDefaults,newExercise,copyToSession,objectiveLabels} from './library-controller-v6.mjs';
import {libraryView,libraryResults,tagFields} from './library-view-v6.mjs';
import {createAnimation} from './animation-v6.mjs';
import {renderRoster,rosterSummary,minimalWeekSummary} from './roster-view-v5.mjs';
import {rosterDefaults,submitRoster,rosterAction} from './roster-controller-v5.mjs';
import {LocalStoreV4} from './store-v4.mjs';
import {weekNavigation,microcycleToolbar,planForm,renderSeason,renderIndividual,renderNutrition,renderProblems,variantTools,variantDetails,frameToolbar,formCandidate} from './workbench-v4.mjs';
import {boardItems,itemKind,itemName,objectSVG,boardSVG,boardEditor as baseBoardEditor,inspector} from './board-v4.mjs';
const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const SHORT = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'];
const PLAYERS = Array.from({ length: 18 }, (_, i) => ({ id: `p${i + 1}`, name: `Jugador ${String(i + 1).padStart(2, '0')}` }));
const LIBRARY = [
  { id: 'rondo', title: 'Rondo de orientación', category: 'Activación · 12 × 12 m', duration: 15, objective: 'Orientar el primer control y encontrar al tercer jugador.' },
  { id: 'possession', title: 'Posesión con apoyos', category: 'Conservación · 30 × 25 m', duration: 20, objective: 'Dar amplitud y crear líneas de pase por dentro.' },
  { id: 'transition', title: 'Transición tras recuperación', category: 'Juego condicionado · Medio campo', duration: 20, objective: 'Buscar un pase vertical después de recuperar.' },
  { id: 'finish', title: 'Finalización por bandas', category: 'Ataque · Medio campo', duration: 18, objective: 'Coordinar centro, llegada y ocupación del área.' },
  { id: 'setpiece', title: 'Balón parado ofensivo', category: 'Estrategia · Área', duration: 15, objective: 'Ajustar tiempos de entrada y segunda jugada.' },
  { id: 'game', title: 'Partido de aplicación', category: 'Juego real · Campo completo', duration: 25, objective: 'Transferir al juego los principios de la sesión.' },
];
const FORMATIONS = {
  '4-3-3': [[9,50],[27,17],[27,39],[27,61],[27,83],[48,26],[43,50],[48,74],[72,16],[78,50],[72,84]],
  '4-4-2': [[9,50],[27,17],[27,39],[27,61],[27,83],[50,15],[48,38],[48,62],[50,85],[76,35],[76,65]],
  '3-5-2': [[9,50],[29,24],[26,50],[29,76],[52,10],[47,30],[43,50],[47,70],[52,90],[76,35],[76,65]],
};
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const esc = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const icon = name => `<i data-lucide="${name}" aria-hidden="true"></i>`;
const uid = () => crypto.randomUUID();
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const minutes = session => session.tasks.reduce((sum, task) => sum + (task.duration??0), 0);
const volume = session => `${minutes(session)} min${session.tasks.some(t=>t.duration===null)?' · suma parcial, tiempos pendientes':''}`;
const textValid = (v, max, min = 0) => typeof v === 'string' && v.length >= min && v.length <= max;
const unique = list => new Set(list).size === list.length;
const legacyTaskFrom = id => { const task = LIBRARY.find(t => t.id === id); return { id: uid(), libraryId: id, title: task.title, duration: task.duration, objective: task.objective }; };
const taskFrom = id => cloneExercise(state.library.find(t=>t.id===id)??{...ownLibrary().find(t=>t.id===id),objectiveTags:[]});
const defaultBoard = () => ({ pieces: [
  ...FORMATIONS['4-3-3'].map(([x,y], i) => ({ id: uid(), kind: 'player', label: String(i + 1), x, y })),
  ...[[46,16],[58,16],[46,83],[58,83]].map(([x,y], i) => ({ id: uid(), kind: 'cone', label: `C${i + 1}`, x, y })),
] });
function seed() {
  const first = { id: uid(), day: 0, title: 'Conectar y progresar', objective: 'Encontrar al tercer jugador y progresar con amplitud.', tasks: ['rondo', 'possession', 'transition'].map(legacyTaskFrom), board: defaultBoard() };
  return { schemaVersion: 1, updatedAt: new Date().toISOString(), activeDay: 0, selectedSessionId: first.id, sessions: [first,
    { id: uid(), day: 2, title: 'Transiciones y finalización', objective: 'Dar continuidad al ataque tras recuperar.', tasks: ['transition', 'finish'].map(legacyTaskFrom), board: defaultBoard() },
    { id: uid(), day: 4, title: 'Ajustes del plan de partido', objective: 'Coordinar la estrategia y las distancias entre líneas.', tasks: ['setpiece', 'game'].map(legacyTaskFrom), board: defaultBoard() }],
    analysis: { own: { strengths: 'Amplitud en la salida y apoyos cercanos al poseedor.', weaknesses: 'Distancias largas después de perder el balón.', notes: 'Mantener un apoyo por detrás de la jugada.' }, rival: { strengths: 'Presión alta y llegada por fuera.', weaknesses: 'Espacio a la espalda de la primera línea.', notes: 'Alternar el pase corto con la salida al lado débil.' } },
    match: { formation: '4-3-3', lineup: PLAYERS.slice(0, 11).map(p => p.id), attacking: 'Abrir el campo y buscar al tercer jugador.', defending: 'Cerrar el carril central y bascular juntos.', setPieces: 'Primer movimiento al primer palo; llegada al segundo.' },
  };
}
function validateLegacy(s) {
  if (!s || s.schemaVersion !== 1 || !textValid(s.updatedAt, 40) || !Number.isFinite(Date.parse(s.updatedAt)) || !Number.isInteger(s.activeDay) || s.activeDay < 0 || s.activeDay > 6 || !Array.isArray(s.sessions) || s.sessions.length > 50) return false;
  const ids = [];
  for (const session of s.sessions) {
    if (!session || !textValid(session.id, 80, 1) || !Number.isInteger(session.day) || session.day < 0 || session.day > 6 || !textValid(session.title, 80, 1) || !session.title.trim() || !textValid(session.objective, 500) || !Array.isArray(session.tasks) || session.tasks.length > 30 || !session.board || !Array.isArray(session.board.pieces) || session.board.pieces.length > 40) return false;
    ids.push(session.id);
    for (const t of session.tasks) {
      if (!t || !textValid(t.id,80,1) || !LIBRARY.some(l => l.id === t.libraryId && l.title === t.title) || !Number.isInteger(t.duration) || t.duration < 1 || t.duration > 180 || !textValid(t.objective,500)) return false;
      ids.push(t.id);
    }
    for (const p of session.board.pieces) {
      if (!p || !textValid(p.id,80,1) || !['player','cone'].includes(p.kind) || !textValid(p.label,12,1) || !Number.isFinite(p.x) || !Number.isFinite(p.y) || p.x < 3 || p.x > 97 || p.y < 5 || p.y > 95) return false;
      ids.push(p.id);
    }
  }
  if (!unique(ids) || !(s.selectedSessionId === null || s.sessions.some(t => t.id === s.selectedSessionId && t.day === s.activeDay))) return false;
  if (!s.analysis || !['own','rival'].every(k => s.analysis[k] && ['strengths','weaknesses','notes'].every(f => textValid(s.analysis[k][f],3000)))) return false;
  const m = s.match;
  return !!m && Object.hasOwn(FORMATIONS, m.formation) && Array.isArray(m.lineup) && m.lineup.length === 11 && unique(m.lineup) && m.lineup.every(id => PLAYERS.some(p => p.id === id)) && ['attacking','defending','setPieces'].every(f => textValid(m[f],3000));
}
// Whitelist the persisted/exported contract; never retain unknown stored fields.
function cleanLegacy(s) {
  return { schemaVersion: 1, updatedAt: s.updatedAt, activeDay: s.activeDay, selectedSessionId: s.selectedSessionId,
    sessions: s.sessions.map(t => ({ id: t.id, day: t.day, title: t.title, objective: t.objective,
      tasks: t.tasks.map(a => ({ id:a.id, libraryId:a.libraryId, title:a.title, duration:a.duration, objective:a.objective })),
      board: { pieces: t.board.pieces.map(p => ({ id:p.id, kind:p.kind, label:p.label, x:p.x, y:p.y })) } })),
    analysis: Object.fromEntries(['own','rival'].map(k => [k, Object.fromEntries(['strengths','weaknesses','notes'].map(f => [f,s.analysis[k][f]]))])),
    match: { formation:s.match.formation, lineup:[...s.match.lineup], attacking:s.match.attacking, defending:s.match.defending, setPieces:s.match.setPieces } };
}
let storageBlocked = false;
let storageMessage = '';
let expectedRaw = null;
let migrationRaw = null;
let migrationSources = {};
let needsInitialSave = false;
const clean = s => parseV6(s,LIBRARY,FORMATIONS);
const validate = s => {try {clean(s);return true;}catch{return false;}};
function fresh() {
  return migrateV5(migrateV4(migrateV3(migrateV2(migrate(seed(),PLAYERS),ownLibrary()))));
}
function ownLibrary(){
  return LIBRARY.map(t=>({...enrichTask({id:t.id,libraryId:t.id,title:t.title,duration:t.duration,objective:t.objective}),participants:8,jokers:2,length:30,width:25,type:t.category,part:'Principal',attackObjective:'Crear apoyos y líneas de pase.',defendObjective:'Cerrar espacios y coordinar la recuperación.',description:'Ejercicio sintético de preparación colectiva con oposición y apoyos.',variants:'Variar el espacio o limitar los contactos.',board:{pieces:Array.from({length:8},(_,i)=>({id:uid(),kind:'player',label:String(i+1),x:25+(i%4)*16,y:30+Math.floor(i/4)*35,team:i<3?'A':i<6?'B':'wildcard'})),arrows:[],zones:[],text:'Organización ficticia editable.'}}));
}
const store=new LocalStoreV4({key:KEY,parse:clean,seed:fresh,legacy:[
  {key:V5KEY,convert:s=>migrateV5(parseV5(s,LIBRARY,FORMATIONS))},
  {key:V4KEY,convert:s=>migrateV5(migrateV4(parseV4(s,LIBRARY,FORMATIONS)))},
  {key:V3KEY,convert:s=>migrateV5(migrateV4(migrateV3(parseV3(s,LIBRARY,FORMATIONS))))},
  {key:V2KEY,convert:s=>migrateV5(migrateV4(migrateV3(migrateV2(parseV2(s,LIBRARY,FORMATIONS),ownLibrary()))))},
  {key:V1KEY,convert:s=>migrateV5(migrateV4(migrateV3(migrateV2(migrate(parseV1(s,LIBRARY,FORMATIONS,PLAYERS),PLAYERS),ownLibrary()))))},
]});
function syncStore(){storageBlocked=store.blocked;if(store.message)storageMessage=store.message;expectedRaw=store.raw;migrationSources=store.sources;needsInitialSave=store.needsSave;}
function load(){const value=store.read();syncStore();return value;}
let state = load();
let view = 'home';
let section = 'week';
let period = 'week';
let boardKey = null;
let previousView = 'week';
let selectedRivalId = null;
let selectedExerciseId = null;
let exerciseOwner = 'session';
let exerciseSummaryOnly = false;
const ui4={weekMode:'microcycle',fixtureId:null,phaseId:null,recordId:null,nutritionId:null,problemId:null,variantId:null,frameIndex:-1,boardContext:'',framePrint:null};
const rosterUi=rosterDefaults(state);
const motion=matchMedia('(prefers-reduced-motion: reduce)');
const libraryUi=libraryDefaults();
let homeReturn=null;
const playback=createAnimation({draw:drawPreview,restore:()=>drawPreview(currentBoard()),status:previewStatus});
let photoBusy = false;
let dirty = false;
const dirtyForms = new Set();
const formBaselines = new Map();
let analysisReturn = null;
const formNames={'session-edit':'Sesión','exercise-form':'Ejercicio','analysis-form':'Análisis','match-form':'Once','board-form':'Consigna','person-form':'Ficha','new-session-form':'Nueva sesión','v4-plan-session':'Planificación de sesión','v4-plan-exercise':'Planificación de ejercicio','v4-fixture':'Partido de referencia','v4-phase':'Fase','v4-season':'Temporada','v4-record':'Registro ficticio','v4-nutrition':'Pauta ficticia','v4-problem':'Problema','v4-partitions':'Banquillo y consignas'};
Object.assign(formNames,{'v5-profile':'Datos deportivos','v5-season':'Temporada deportiva','v5-competition':'Competición','v5-session-season':'Atribución de sesión','v5-stat':'Estadística de partido','v5-rule':'Nueva versión de regla','v5-sanction':'Sanción manual'});
function formSignature(form){return JSON.stringify([...form.elements].filter(f=>['INPUT','TEXTAREA','SELECT'].includes(f.tagName)&&!['submit','button','reset','image'].includes(f.type)).map((f,i)=>[f.id||f.name||i,f.type==='file'?[...f.files].map(v=>[v.name,v.size,v.type,v.lastModified]):['checkbox','radio'].includes(f.type)?f.checked:f.multiple?[...f.selectedOptions].map(o=>o.value):f.value,Boolean(f.validity?.badInput)]));}
function refreshDirty(){
  dirtyForms.clear();
  for(const form of $$('form')){
    if(!formBaselines.has(form.id))formBaselines.set(form.id,formSignature(form));
    const changed=formSignature(form)!==formBaselines.get(form.id);
    if(changed)dirtyForms.add(form.id);
    const marker=form.querySelector('.form-dirty');if(marker)marker.hidden=!changed;
  }
  dirty=dirtyForms.size>0;storageUI();
}
function baselineForms(){
  formBaselines.clear();dirtyForms.clear();dirty=false;
  for(const form of $$('form')){
    form.querySelector('.form-dirty')?.remove();
    const marker=document.createElement('p');marker.id=`pending-${form.id}`;marker.className='form-dirty';marker.hidden=true;marker.setAttribute('role','status');marker.textContent=`${formNames[form.id]??'Formulario'}: cambios sin guardar`;
    form.prepend(marker);form.setAttribute('aria-describedby',[...(form.getAttribute('aria-describedby')??'').split(' ').filter(id=>id&&id!==marker.id),marker.id].join(' '));formBaselines.set(form.id,formSignature(form));
  }
}
function savedForm(form){
  for(const field of form.elements){if(field.type==='file')field.value='';else if(field.tagName==='SELECT')for(const option of field.options)option.defaultSelected=option.selected;else if(field.type==='checkbox'||field.type==='radio')field.defaultChecked=field.checked;else if('defaultValue'in field)field.defaultValue=field.value;}
  formBaselines.set(form.id,formSignature(form));refreshDirty();
}
let selectedPieceId = null;
let drag = null;
let noticeTimer;
let dialogTrigger;
const currentSession = () => state.sessions.find(s => s.id === state.selectedSessionId);
const currentExercise = () => (exerciseOwner==='library'?state.library:currentSession()?.tasks??[]).find(t=>t.id===selectedExerciseId);
const currentMatch = () => ui4.variantId?state.match.variants.find(v=>v.id===ui4.variantId)??state.match:state.match;
const currentBoardRoot = () => section==='match'?currentMatch().boards[boardKey]:['week','library'].includes(view==='summary'?previousView:view)?currentExercise()?.board:currentSession()?.board;
const currentBoard = () => {const b=currentBoardRoot();return b?.frames[ui4.frameIndex]?.snapshot??b;};
const currentPiece = () => currentBoard()?boardItems(currentBoard()).find(p=>p.id===selectedPieceId):null;
function icons() { window.lucide?.createIcons({ attrs: { 'aria-hidden': 'true' } }); }
function notify(message, error = false) {
  const node = $('#notice'); node.textContent = message; node.classList.toggle('error', error); node.hidden = false;
  clearTimeout(noticeTimer); noticeTimer = setTimeout(() => { node.hidden = true; }, 4500);
}
function storageUI() {
  $('#storage-warning').hidden = !storageMessage;
  $('#storage-warning').textContent = storageMessage;
  const pending=dirty?`${dirtyForms.size} ${dirtyForms.size===1?'formulario pendiente':'formularios pendientes'} · `:'';
  const status=pending+(storageBlocked?'Sin guardar · solo en memoria':`${dirty?'Último guardado local':'Guardado local'} · ${new Date(state.updatedAt).toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'})}`);
  if($('#save-status').textContent!==status)$('#save-status').textContent=status;
}
function save(message) {
  try{const result=store.write(state);state=result.state;syncStore();}catch(error){notify(`No se guardó: ${error.message}`,true);return false;}
  storageUI();
  if (message) notify(storageBlocked ? `${message} Solo en memoria; no guardado local.` : message, storageBlocked);
  return !storageBlocked;
}
function canLeave() {
  if(photoBusy){notify('Espera a que termine la validación de la foto.',true);return false;}
  refreshDirty();
  if (!dirty) return true;
  if (!window.confirm('Hay cambios de formulario sin guardar. ¿Descartarlos y continuar?')) return false;
  for(const form of $$('form'))if(dirtyForms.has(form.id))HTMLFormElement.prototype.reset.call(form);
  refreshDirty();return true;
}
function focusElement(selector) { $(selector)?.focus(); }
function focusOpen(selector){const node=$(selector);for(let parent=node?.parentElement;parent;parent=parent.parentElement)if(parent.tagName==='DETAILS')parent.open=true;node?.focus();}
function selectRosterPlayer(id){if(!state.players.some(p=>p.id===id))return;rosterUi.playerId=selectedPlayerId=id;rosterUi.statId=rosterUi.sanctionId=null;ui4.recordId=ui4.nutritionId=null;render();focusElement('.roster-player-title');}
function changeView(next, focus = false, keepReturn = false) {
  playback.stop();
  if (!canLeave()) return false;
  playback.stop();if(next!=='summary')ui4.framePrint=null;
  if(['week','analysis','match','roster','academy'].includes(next)){if(!keepReturn)analysisReturn=null;section=next;boardKey=null;exerciseSummaryOnly=false;if(next==='roster')selectedPlayerId=rosterUi.playerId;if(next==='week'&&!keepReturn)exerciseOwner='session';}
  view = next; selectedPieceId = null; render();
  if (focus) focusElement('#view-panel h1');
  return true;
}
function heading(title, subtitle, actions = '') {
  return `<div class="view-heading"><div><p class="eyebrow">Terreno · ${esc(monday(state.activeDate))}</p><h1 tabindex="-1">${title}</h1><p>${subtitle}</p></div><div class="heading-actions">${actions}${view!=='summary'?`<button class="icon-button secondary" data-action="summary" title="Resumen del contexto" aria-label="Resumen del contexto">${icon('clipboard-list')}</button>`:''}</div></div>`;
}
function render(preview=false) {
  if(!preview)playback.stop();
  if(view==='week'||view==='library'){const tasks=exerciseOwner==='library'?state.library:currentSession()?.tasks??[];if(!tasks.some(t=>t.id===selectedExerciseId))selectedExerciseId=tasks[0]?.id??null;}
  if(analysisReturn&&view==='week'&&(ui4.weekMode!=='microcycle'||selectedExerciseId!==analysisReturn.targetId||exerciseOwner!==analysisReturn.targetOwner))analysisReturn=null;
  const context=view==='home'||view==='summary'?ui4.boardContext:section==='match'?`match:${ui4.variantId??'base'}:${boardKey}`:view==='board'?`general:${state.selectedSessionId}`:`exercise:${exerciseOwner}:${selectedExerciseId}`;
  if(ui4.boardContext!==context){ui4.boardContext=context;ui4.frameIndex=-1;selectedPieceId=null;}
  document.body.dataset.view = view;
  $$('[data-tab]').forEach(tab => { const active = view!=='home'&&tab.dataset.tab === section; tab.setAttribute('aria-selected', String(active)); tab.tabIndex = tab.dataset.tab===section ? 0 : -1; });
  $('#view-panel').setAttribute('aria-labelledby',view==='home'?'home-access':`tab-${section}`);
  $('#view-panel').setAttribute('role',view==='home'?'region':'tabpanel');
  $('#view-panel').innerHTML = ({home:renderHome,library:()=>libraryView(state,libraryUi,selectedExerciseId)+exerciseEditor(currentExercise()),week:renderWeek,board:renderBoard,analysis:renderAnalysis,match:renderMatch,summary:renderSummary,roster:()=>renderRoster(state,rosterUi,ui4,personEditor('player')),academy:()=>'<section class="v4-section"><h1 tabindex="-1">Academia</h1><p role="status">No conectada</p><p>Arquitectura propuesta. Sin cuentas, organizaciones operativas o sincronización.</p></section>'})[view]();
  const exerciseForm=$('#exercise-form');if(exerciseForm)exerciseForm.querySelector('.form-footer').insertAdjacentHTML('beforebegin',tagFields(currentExercise()));
  if(view==='library')$('#exercise-form')?.insertAdjacentHTML('beforebegin','<h3 tabindex="-1" id="v6-selected-title">Ejercicio seleccionado</h3>');
  const frames=$('#v4-frame');if(frames)for(const [i,option]of [...frames.options].entries())if(i>0)option.textContent=`Paso ${i} · ${option.textContent}`;
  if(view==='summary'&&!ui4.framePrint){const node=$('#print-summary');if(section==='analysis')node.insertAdjacentHTML('beforeend',`<div class="summary-v4">${renderProblems(state,ui4)}</div>`);if(section==='match')node.insertAdjacentHTML('beforeend',matchSummaryExtras());if(section==='week'&&ui4.weekMode==='microcycle'){const exercises=exerciseSummaryOnly||exerciseOwner==='library'?[currentExercise()].filter(Boolean):state.sessions.filter(s=>s.date>=monday(state.activeDate)&&s.date<=addDays(monday(state.activeDate),6)).flatMap(s=>s.tasks);node.insertAdjacentHTML('beforeend',`<section class="summary-section"><h2>Objetivos de ejercicios</h2>${exercises.map(t=>summaryText(t.title,objectiveLabels(t))).join('')}</section>`);}}
  if(view==='week')for(const s of state.sessions){const node=$(`[data-action="session"][data-id="${CSS.escape(s.id)}"] small`);if(node)node.textContent=`${s.tasks.length} ejercicios · ${volume(s)}`;}
  if(analysisReturn&&view==='week'&&$('.exercise-sheet'))$('.exercise-sheet').insertAdjacentHTML('afterbegin',`<div class="context-return"><button class="secondary" data-action="return-analysis" title="Volver al análisis de origen">${icon('arrow-left')}Volver al análisis</button></div>`);
  for(const link of $$('[data-action="open-exercise-link"]')){const target=exerciseTarget(state.problems.find(p=>p.id===link.dataset.id)?.exerciseId);link.disabled=!target;link.title=target?`Ir al ejercicio: ${target.exercise.title}`:'Ejercicio no disponible';}
  baselineForms();icons();storageUI();
}
function renderHome(){
  const sessions=state.sessions.filter(s=>s.date===state.activeDate),fixtures=state.fixtures.filter(f=>f.date===state.activeDate);
  const link=(destination,label,symbol)=>`<button class="secondary" data-action="v6-goto" data-destination="${destination}">${icon(symbol)}${label}</button>`;
  return `<section class="home-work"><div class="view-heading"><div><p class="eyebrow">Equipo demo · Adultos ficticios</p><h1 tabindex="-1">Inicio</h1><p>Contexto elegido · ${esc(state.activeDate)}</p></div><button class="primary" data-action="v6-continue">${icon('arrow-right')}Continuar trabajo</button></div><div class="home-shortcuts">${link('week','Planificación','calendar-days')}${link('analysis','Análisis','scan-eye')}${link('match','Partido','flag')}${link('roster','Plantilla','users')}${link('academy','Academia · No conectada','school')}<button class="secondary" data-action="library">${icon('library')}Biblioteca local</button></div><section class="home-agenda"><div class="section-heading"><h2>Sesiones · ${esc(state.activeDate)}</h2><button class="secondary" data-action="new-session">${icon('plus')}Nueva sesión</button></div>${sessions.map(s=>`<div class="home-row"><button class="session-choice" data-action="v6-open-session" data-id="${esc(s.id)}"><strong>${esc(s.title)}</strong><small>${volume(s)}</small></button><button class="icon-button secondary" data-action="v6-open-general" data-id="${esc(s.id)}" title="Pizarra general de ${esc(s.title)}" aria-label="Pizarra general de ${esc(s.title)}">${icon('waypoints')}</button></div>`).join('')||'<p>Sin sesiones en la fecha elegida.</p>'}<button class="text-button" data-action="v6-goto" data-destination="week">${icon('calendar')}Abrir calendario</button></section><section class="home-agenda"><h2>Partidos de referencia · ${esc(state.activeDate)}</h2>${fixtures.map(f=>`<p>${esc(f.title)} · ${esc(f.date)}</p>`).join('')||'<p>Sin partidos de referencia en esta fecha.</p>'}</section></section>`;
}
function drawPreview(board){
  const target=$('#pieces'),svg=$('#pitch');if(!target||!svg||!board)return;
  target.innerHTML=[...board.zones,...board.arrows,...board.pieces].map(p=>objectSVG(p,p.id===selectedPieceId,svg.dataset.marker,true)).join('');
}
function previewStatus(mode,detail){
  const button=$('[data-action="v4-play"]'),label=mode==='playing'?'Pausar vista previa':mode==='paused'?'Reanudar vista previa':'Reproducir pasos';
  if(button&&button.getAttribute('aria-label')!==label){button.innerHTML=icon(mode==='playing'?'pause':'play');button.setAttribute('aria-label',label);button.title=label;icons();}
  const selected=ui4.frameIndex<0?'Base':`Paso ${ui4.frameIndex+1}`;
  const text=mode==='idle'?`Seleccionado: ${selected}`:`Vista previa ${mode==='paused'?'pausada':mode==='finished'?'finalizada':'en reproducción'} · Paso ${detail.segment+1} · Seleccionado: ${selected}`;
  const node=$('#v6-preview-status');if(node&&node.textContent!==text)node.textContent=text;
}
function renderWeekBase() {
  const s = currentSession();
  const daySessions = state.sessions.filter(t => t.date===state.activeDate);
  const start=period==='week'?monday(state.activeDate):monday(`${state.activeDate.slice(0,7)}-01`);
  const dates=Array.from({length:period==='week'?7:42},(_,i)=>addDays(start,i));
  return heading('Semana de trabajo', 'Equipo demo · Preparación colectiva', `<button class="primary" data-action="new-session">${icon('plus')}Nueva sesión</button>`) +
    `<div class="calendar-toolbar"><div class="segmented"><button data-action="period" data-period="week" aria-pressed="${period==='week'}">Semana</button><button data-action="period" data-period="month" aria-pressed="${period==='month'}">Mes</button></div><button class="icon-button secondary" data-action="calendar-prev" title="Periodo anterior" aria-label="Periodo anterior">${icon('chevron-left')}</button><label for="calendar-date" class="sr-only">Fecha de calendario</label><input id="calendar-date" type="date" min="1900-01-01" max="2100-12-31" value="${state.activeDate}"><button class="icon-button secondary" data-action="calendar-next" title="Periodo siguiente" aria-label="Periodo siguiente">${icon('chevron-right')}</button><strong>${new Date(`${state.activeDate}T12:00:00`).toLocaleDateString('es-ES',{month:'long',year:'numeric'})}</strong></div>` +
    `<div class="week-strip ${period==='month'?'month-grid':''}" aria-label="Calendario">${dates.map((date,i) => { const sessions = state.sessions.filter(t => t.date === date); return `<button class="day" data-action="day" data-date="${date}" aria-label="${date}, ${sessions.length} sesiones" aria-pressed="${!state.legacySelected && state.activeDate === date}"><span class="day-name">${SHORT[i%7]}</span><span class="day-number">${Number(date.slice(8))}</span><span class="day-load">${sessions.length ? `${sessions.reduce((sum,t) => sum+minutes(t),0)} min` : 'Libre'}</span></button>`; }).join('')}</div>` +
    `<div class="week-layout"><aside class="session-sidebar"><div class="section-heading"><h2>${state.legacySelected?'Sin fecha':state.activeDate}</h2><span class="count">${daySessions.length} ses.</span></div><div class="session-choices">${daySessions.map(t => `<button class="session-choice" data-action="session" data-id="${esc(t.id)}" aria-pressed="${s?.id === t.id}"><strong>${esc(t.title)}</strong><small>${t.tasks.length} tareas · ${minutes(t)} min${t.date===null?` · ${DAYS[t.day]} original`:''}</small></button>`).join('') || '<p class="sidebar-empty">Sin sesiones programadas.</p>'}</div><h3>Plantillas de sesión</h3>${[['connect','Conectar y progresar'],['transition','Transiciones y finalización'],['match','Preparación de partido']].map(([id,title])=>`<button class="text-button sidebar-add" data-action="template" data-template="${id}">${icon('copy-plus')}${title}</button>`).join('')}</aside><section class="session-workspace">${s ? sessionEditor(s) : `<div class="empty-state">${icon('calendar-plus')}<h2>Un día por preparar</h2><p>${state.activeDate}</p><button class="primary" data-action="new-session">${icon('plus')}Crear sesión</button></div>`}</section></div>`;
}
function renderWeek(){
  const content=ui4.weekMode==='season'?renderSeason(state,ui4):ui4.weekMode==='individual'?renderIndividual(state,ui4):ui4.weekMode==='nutrition'?renderNutrition(state,ui4):microcycleToolbar(state,ui4)+(exerciseOwner==='library'&&!currentSession()?heading('Biblioteca propia','Ejercicios ficticios')+sessionEditor(null):renderWeekBase());
  return weekNavigation(ui4)+content;
}
function boardEditor(board,lines,id){const root=currentBoardRoot();return frameToolbar(root,ui4,motion.matches,playback.playing)+`<div class="preview-state"><button type="button" class="icon-button secondary" data-action="v6-stop" title="Detener y restaurar seleccionado" aria-label="Detener y restaurar seleccionado">${icon('square')}</button><p id="v6-preview-status" role="status">Seleccionado: ${ui4.frameIndex<0?'Base':`Paso ${ui4.frameIndex+1}`}</p></div>`+baseBoardEditor(currentBoard(),lines,id);}
function sessionEditorV2(s) {
  return `<form id="session-edit" class="session-form"><div><label for="session-title">Sesión</label><input id="session-title" name="title" value="${esc(s.title)}" maxlength="80" required></div><div class="minutes-total">${minutes(s)} <span>min previstos</span></div><div><label for="session-date">Fecha${s.date===null?' · Sin fecha':''}</label><input id="session-date" name="date" type="date" min="1900-01-01" max="2100-12-31" value="${s.date??''}"></div><div><label for="session-intensity">Intensidad prevista (opcional 1–10)</label><input id="session-intensity" name="intensity" type="number" min="1" max="10" step="1" value="${s.intensity??''}"></div><div class="objective-field"><label for="session-objective">Objetivo colectivo</label><textarea id="session-objective" name="objective" maxlength="500" rows="2">${esc(s.objective)}</textarea><fieldset class="called"><legend>Convocados ficticios (${s.called.length})</legend>${state.players.map(p=>`<label><input type="checkbox" name="called" value="${esc(p.id)}" ${s.called.includes(p.id)?'checked':''}>${esc(p.name)}</label>`).join('')}</fieldset></div><div class="form-actions"><button type="button" class="text-button danger" data-action="delete-session">${icon('trash-2')}Eliminar sesión</button><button type="button" class="secondary" data-action="open-board">${icon('waypoints')}Pizarra</button><button class="secondary" type="submit">${icon('check')}Guardar sesión</button></div></form><div class="section-heading"><h2>Tareas <span class="count">/ ${s.tasks.length}</span></h2><button class="secondary" data-action="library">${icon('plus')}Añadir tarea</button></div>${s.tasks.length ? `<ol class="task-list">${s.tasks.map((t,i) => `<li class="task-item" data-task="${esc(t.id)}"><span class="task-number">${String(i+1).padStart(2,'0')}</span><div class="task-main"><h3>${esc(t.title)}</h3><small>${esc(LIBRARY.find(l => l.id === t.libraryId).category)}</small><label for="objective-${esc(t.id)}">Objetivo de la tarea</label><textarea id="objective-${esc(t.id)}" class="task-objective" data-task-field="objective" data-id="${esc(t.id)}" maxlength="500" rows="2">${esc(t.objective)}</textarea></div><div class="duration-field"><label for="duration-${esc(t.id)}">Minutos</label><input id="duration-${esc(t.id)}" type="number" min="1" max="180" step="1" value="${t.duration}" data-task-field="duration" data-id="${esc(t.id)}"></div><button class="icon-button danger" data-action="delete-task" data-id="${esc(t.id)}" title="Eliminar tarea" aria-label="Eliminar ${esc(t.title)}">${icon('trash-2')}</button></li>`).join('')}</ol>` : '<div class="empty-state"><h3>Sesión sin tareas</h3><button class="secondary" data-action="library">Abrir biblioteca</button></div>'}`;
}
function sessionVolume(s){
  const pending=s.tasks.some(t=>t.duration===null);
  return `<div class="minutes-total" ${pending?'aria-describedby="session-volume-status"':''}><strong class="minutes-value">${minutes(s)}</strong> <span>min</span><small>previstos</small></div><p id="session-volume-status" class="volume-status" ${pending?'':'hidden'}>Suma parcial, tiempos pendientes</p>`;
}
function sessionEditor(s){
  if(exerciseOwner==='library')return `<div class="section-heading"><h2>Biblioteca propia</h2><button class="secondary" data-action="leave-library">${icon('arrow-left')}Sesión</button></div>${exerciseEditor(currentExercise())}`;
  if(!s.tasks.some(t=>t.id===selectedExerciseId))selectedExerciseId=s.tasks[0]?.id??null;
  return `<form id="session-edit" class="session-form"><div><label for="session-title">Sesión</label><input id="session-title" name="title" maxlength="80" required value="${esc(s.title)}"></div><div class="session-volume">${sessionVolume(s)}</div><div><label for="session-date">Fecha</label><input id="session-date" name="date" type="date" min="1900-01-01" max="2100-12-31" required value="${s.date}"></div><div><label for="session-intensity">Intensidad prevista (opcional 1–10)</label><input id="session-intensity" name="intensity" type="number" min="1" max="10" step="1" value="${s.intensity??''}"></div><div class="objective-field"><label for="session-objective">Objetivo colectivo</label><textarea id="session-objective" name="objective" maxlength="500">${esc(s.objective)}</textarea><fieldset class="called"><legend>Convocados ficticios (${s.called.length})</legend>${state.players.map(p=>`<label><input type="checkbox" name="called" value="${esc(p.id)}" ${s.called.includes(p.id)?'checked':''}>${esc(p.name)}</label>`).join('')}</fieldset></div><div class="form-actions"><button type="button" class="text-button danger" data-action="delete-session">${icon('trash-2')}Eliminar sesión</button><button type="button" class="secondary" data-action="open-board">${icon('waypoints')}Pizarra general de sesión</button><button class="secondary" type="submit">${icon('check')}Guardar sesión</button></div></form>${planForm(s,'session')}<div class="section-heading"><h2>Ejercicios (${s.tasks.length})</h2><button class="secondary" data-action="library">${icon('plus')}Biblioteca</button></div><ol class="exercise-list">${s.tasks.map((t,i)=>`<li data-task="${esc(t.id)}"><button class="exercise-choice" data-action="select-exercise" data-id="${esc(t.id)}" aria-pressed="${t.id===selectedExerciseId}"><span>${i+1}</span><strong data-exercise-title="${esc(t.id)}">${esc(t.title)}</strong><small>${t.duration===null?'Tiempo pendiente':`${t.duration} min`}</small></button><button class="icon-button" data-action="task-up" data-id="${esc(t.id)}" title="Subir ejercicio" aria-label="Subir ${esc(t.title)}" ${i===0?'disabled':''}>${icon('arrow-up')}</button><button class="icon-button" data-action="task-down" data-id="${esc(t.id)}" title="Bajar ejercicio" aria-label="Bajar ${esc(t.title)}" ${i===s.tasks.length-1?'disabled':''}>${icon('arrow-down')}</button></li>`).join('')}</ol>${s.tasks.length?exerciseEditor(currentExercise()):'<p class="muted">Sin ejercicios.</p>'}`;
}
function exerciseEditor(t){
  if(!t)return '<p>Sin ejercicio seleccionado.</p>';
  if(!boardItems(currentBoard()).some(p=>p.id===selectedPieceId))selectedPieceId=boardItems(currentBoard())[0]?.id??null;
  return `<section class="exercise-sheet"><div class="section-heading"><h2>Ficha de ejercicio</h2><div class="exercise-actions"><button class="icon-button secondary" data-action="exercise-summary" title="Resumen del ejercicio" aria-label="Resumen del ejercicio">${icon('clipboard-list')}</button><button class="icon-button secondary" data-action="copy-task" title="Copiar ejercicio" aria-label="Copiar ejercicio">${icon('copy')}</button><button class="icon-button danger" data-action="delete-exercise" title="Eliminar ejercicio" aria-label="Eliminar ejercicio">${icon('trash-2')}</button></div></div><form id="exercise-form"><label for="exercise-title">Título</label><input id="exercise-title" name="title" value="${esc(t.title)}" maxlength="80" required><div class="exercise-fields"><div><label for="exercise-duration">Tiempo total previsto (min)</label><input id="exercise-duration" name="duration" type="number" min="1" max="180" step="1" value="${t.duration??''}"></div>${Object.entries(NUMBERS).map(([k,[label,min,max,integer]])=>`<div><label for="exercise-${k}">${label}</label><input id="exercise-${k}" name="${k}" type="number" min="${min}" max="${max}" step="${integer?'1':'any'}" value="${t[k]??''}"></div>`).join('')}${['type','part'].map(k=>`<div><label for="exercise-${k}">${TEXTS[k][0]}</label><input id="exercise-${k}" name="${k}" value="${esc(t[k])}" maxlength="80"></div>`).join('')}</div>${Object.entries(TEXTS).filter(([k])=>!['type','part'].includes(k)).map(([k,[label,max]])=>`<label for="exercise-${k}">${label}</label><textarea id="exercise-${k}" name="${k}" maxlength="${max}" rows="2">${esc(t[k])}</textarea>`).join('')}<p id="exercise-error" class="form-error" role="alert"></p><div class="form-footer"><button class="secondary" type="submit">${icon('check')}Guardar ejercicio</button></div></form>${planForm(t,'exercise')}<h3 class="inline-board-title">Pizarra del ejercicio</h3>${boardEditor(t.board,pitchLines,selectedPieceId)}</section>`;
}
function pitchLines() {
  return `<rect width="900" height="580" fill="#287b53"/>${[0,2,4,6,8].map(i => `<rect x="${i*100}" y="0" width="100" height="580" fill="#ffffff" opacity=".025"/>`).join('')}<g class="pitch-lines" stroke="#e3f0e6" stroke-width="2" fill="none"><rect x="30" y="30" width="840" height="520"/><path d="M450 30V550"/><circle cx="450" cy="290" r="72"/><circle cx="450" cy="290" r="3" fill="#e3f0e6"/><path d="M30 150H165V430H30 M870 150H735V430H870 M30 230H78V350H30 M870 230H822V350H870"/><path d="M165 230Q210 290 165 350 M735 230Q690 290 735 350"/><circle cx="122" cy="290" r="3" fill="#e3f0e6"/><circle cx="778" cy="290" r="3" fill="#e3f0e6"/><path d="M15 258H30 M15 258V322H30 M885 258H870 M885 258V322H870"/></g>`;
}
function pieceSVG(p) {
  const label = `${KINDS[p.kind]??'Flecha'} ${p.label??''}`;
  const shapes={player:`<circle r="18" fill="#fff" stroke="#173f2d" stroke-width="2"/><text text-anchor="middle" dominant-baseline="central" font-size="15" fill="#173f2d">${esc(p.label)}</text>`,cone:'<path d="M0 -16L16 14H-16Z" fill="#f18b6d" stroke="#ffe3d8" stroke-width="2"/>',ladder:'<path d="M-15 -22V22M15 -22V22M-15 -16H15M-15 -5H15M-15 6H15M-15 17H15" stroke="#ffe99b" stroke-width="4"/>',goal:'<path d="M-24 15V-15H24V15M-24 5H24M-12 -15V15M0 -15V15M12 -15V15" stroke="white" stroke-width="3" fill="none"/>',ball:'<circle r="14" fill="white" stroke="#173f2d" stroke-width="2"/><path d="M0 -7L7 -2L4 7H-4L-7 -2Z" fill="#202923"/>',obstacle:'<rect x="-22" y="-9" width="44" height="18" fill="#f18b6d" stroke="white" stroke-width="2"/>'};
  const arrow=!p.kind;
  return `<g class="piece${selectedPieceId === p.id ? ' is-selected' : ''}" data-piece="${esc(p.id)}" transform="translate(${p.x*9},${p.y*5.8})" tabindex="0" role="button" aria-label="${esc(label)}, X ${Math.round(p.x)}, Y ${Math.round(p.y)}" aria-pressed="${selectedPieceId === p.id}">${arrow?`<path d="M0 0L${(p.x2-p.x)*9} ${(p.y2-p.y)*5.8}" stroke="#ffe99b" stroke-width="5" marker-end="url(#direction)"/><circle cx="${(p.x2-p.x)*9}" cy="${(p.y2-p.y)*5.8}" r="8" fill="#ffe99b"/>`:''}<circle class="hit-area" r="34" fill="transparent"/><circle class="selection-ring" r="23"/>${arrow?'<circle r="9" fill="#ffe99b"/>':shapes[p.kind]}</g>`;
}
function renderBoardV2() {
  const s = currentSession();
  const board=currentBoard();
  if (!board) return heading('Pizarra', 'Sin contexto seleccionado');
  const elements=[...board.pieces,...board.arrows];
  if (!elements.some(p => p.id === selectedPieceId)) selectedPieceId = elements[0]?.id ?? null;
  const p = currentPiece();
  return heading('Pizarra',section==='match'?BOARDS[boardKey]:esc(s.title),`<button class="secondary" data-action="back">${icon('arrow-left')}Volver</button>`) + `<div class="board-layout"><section><svg id="pitch" class="pitch" viewBox="0 0 900 580" role="group" aria-label="Pizarra contextual"><defs><marker id="direction" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10Z" fill="#ffe99b"/></marker></defs>${pitchLines()}<g id="pieces">${elements.map(pieceSVG).join('')}</g></svg><div class="board-bottom"><p>${Object.entries(KINDS).map(([k,v])=>`${v}: ${board.pieces.filter(p=>p.kind===k).length}`).join(' · ')} · Flechas: ${board.arrows.length}</p><button class="text-button" data-action="reset-board">${icon('rotate-ccw')}Restablecer pizarra</button></div><form id="board-form"><label for="board-text">Consigna de esta pizarra</label><textarea id="board-text" name="text" maxlength="3000">${esc(board.text)}</textarea><button class="secondary" type="submit">${icon('check')}Guardar consigna</button></form></section><aside class="board-inspector"><h2>Disposición</h2><label for="piece-select">Pieza seleccionada</label><select id="piece-select" ${!p?'disabled':''}>${elements.map(a=>`<option value="${esc(a.id)}" ${a.id===selectedPieceId?'selected':''}>${KINDS[a.kind]??'Flecha'} ${esc(a.label??'')}</option>`).join('')}</select><div class="inspector-row">${['x','y',...(!p?.kind&&p?['x2','y2']:[])].map(axis=>`<div><label for="piece-${axis}">${axis.toUpperCase()} ${axis.endsWith('2')?'destino':'origen'} (%)</label><input id="piece-${axis}" data-coordinate="${axis}" type="number" min="${axis.startsWith('x')?3:5}" max="${axis.startsWith('x')?97:95}" step="any" value="${p?.[axis]??''}" ${!p?'disabled':''}></div>`).join('')}</div><div class="direction-controls" aria-label="Mover pieza">${[['up','0','-2','Arriba'],['left','-2','0','Izquierda'],['down','0','2','Abajo'],['right','2','0','Derecha']].map(([k,x,y,label])=>`<button class="${k}" data-action="move" data-dx="${x}" data-dy="${y}" aria-label="Mover ${label.toLowerCase()}" title="Mover ${label.toLowerCase()}" ${!p?'disabled':''}>${icon(`arrow-${k}`)}</button>`).join('')}</div><label for="add-kind">Recurso</label><select id="add-kind">${Object.entries(KINDS).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}<option value="arrow">Flecha</option></select><button class="secondary" data-action="add-piece">${icon('plus')}Añadir recurso</button><button class="text-button danger" data-action="delete-piece" ${!p?'disabled':''}>${icon('trash-2')}Eliminar pieza</button></aside></div>`;
}
function renderBoard(){
  const board=currentBoard();if(!board)return heading('Pizarra','Sin contexto seleccionado');
  if(!boardItems(board).some(p=>p.id===selectedPieceId))selectedPieceId=boardItems(board)[0]?.id??null;
  return heading(section==='match'?'Pizarra de partido':'Pizarra general de sesión',section==='match'?BOARDS[boardKey]:esc(currentSession().title),`<button class="secondary" data-action="back">${icon('arrow-left')}Volver</button>`)+boardEditor(board,pitchLines,selectedPieceId);
}
function renderAnalysisBase() {
  return heading('Lectura del juego', 'Equipo propio y rival ficticio') + `<form id="analysis-form"><div class="analysis-grid">${[['own','Equipo propio'],['rival','Rival de demo']].map(([k,title]) => `<section class="analysis-column"><h2>${title}</h2>${Object.entries(PHASES).map(([f,label]) => `<label for="${k}-${f}">${label}</label><textarea id="${k}-${f}" name="${k}-${f}" maxlength="3000" rows="3">${esc(state.analysis[k][f])}</textarea>`).join('')}<details class="legacy-notes"><summary>Notas anteriores</summary>${[['strengths','Fortalezas'],['weaknesses','Debilidades'],['notes','Notas']].map(([f,label])=>summaryText(label,state.analysis[k][f])).join('')}</details></section>`).join('')}</div><div class="form-footer"><button class="primary" type="submit">${icon('check')}Guardar análisis</button></div></form><section class="roster-section"><div class="section-heading"><h2>Rivales adultos ficticios</h2><button class="secondary" data-action="new-rival">${icon('user-plus')}Nueva ficha</button></div><div class="roster-list">${state.rivals.map(p=>`<button class="session-choice" data-action="edit-rival" data-id="${esc(p.id)}">${avatar(p)}${esc(p.name)}</button>`).join('')}</div>${selectedRivalId?personEditor('rival'):''}</section>`;
}
let selectedPlayerId = state.players[0].id;
function avatar(p){return p.photo?`<img class="avatar" src="${esc(p.photo)}" alt="Avatar ficticio">`:`<span class="avatar initials" aria-hidden="true">${esc(p.name.slice(0,2).toUpperCase())}</span>`;}
function personEditor(kind) {
  const rival=kind==='rival';const p=(rival?state.rivals:state.players).find(p=>p.id===(rival?selectedRivalId:selectedPlayerId));if(!p)return '';
  return `<form id="person-form" data-kind="${kind}" data-id="${esc(p.id)}"><h3>${rival?'Ficha rival':'Jugador de plantilla'} · Ficticio</h3><div class="person-grid"><div>${avatar(p)}<label for="person-name">Nombre ficticio</label><input id="person-name" name="name" maxlength="80" required value="${esc(p.name)}"></div>${rival?`<div><label for="person-age">Edad (adulto)</label><input id="person-age" name="age" type="number" min="18" max="80" step="1" required value="${p.age}"></div><div><label for="person-height">Altura (cm)</label><input id="person-height" name="height" type="number" min="130" max="230" step="1" required value="${p.height}"></div><div><label for="person-foot">Pierna dominante</label><select id="person-foot" name="foot">${[['right','Derecha'],['left','Izquierda'],['both','Ambas']].map(([k,v])=>`<option value="${k}" ${p.foot===k?'selected':''}>${v}</option>`).join('')}</select></div>`:`<div><label for="person-dorsal">Dorsal</label><input id="person-dorsal" name="dorsal" type="number" min="1" max="99" step="1" required value="${p.dorsal}"></div>`}</div>${rival?`<label for="person-description">Descripción</label><textarea id="person-description" name="description" maxlength="1000">${esc(p.description)}</textarea>`:''}<label class="photo-confirm"><input id="photo-fictional" type="checkbox">El archivo es una imagen ficticia, sin personas reales</label><label for="person-photo">Foto ficticia opcional · PNG/JPEG/WebP · 2 MB · 4096 × 4096 máx.</label><input id="person-photo" type="file" accept="image/png,image/jpeg,image/webp"><div class="form-footer"><button type="button" class="text-button danger" data-action="remove-photo">${icon('image-off')}Quitar foto</button>${rival?`<button type="button" class="text-button danger" data-action="delete-rival">${icon('trash-2')}Eliminar ficha</button>`:''}<button class="secondary" type="submit">${icon('check')}Guardar ficha</button></div><p id="photo-status" role="status"></p></form>`;
}
const nameMeasure = document.createElement('canvas').getContext('2d');
function lineupNameCells(positions) {
  // Formation columns and midpoint boundaries keep adjacent labels in separate cells.
  const columns=[];
  for(const point of [...positions].sort((a,b)=>a[0]-b[0])){
    const last=columns.at(-1);
    if(!last || point[0]-last.at(-1)[0]>12)columns.push([point]);else last.push(point);
  }
  return positions.map(point=>{
    const index=columns.findIndex(col=>col.includes(point)),column=columns[index];
    const row=[...column].sort((a,b)=>a[1]-b[1]),j=row.indexOf(point);
    return {left:index?(columns[index-1].at(-1)[0]+column[0][0])*4.5:4,
      right:index<columns.length-1?(column.at(-1)[0]+columns[index+1][0][0])*4.5:896,
      top:j?(row[j-1][1]+point[1])*2.9:4,bottom:j<row.length-1?(point[1]+row[j+1][1])*2.9:576};
  });
}
function lineupName(name,x,y,cell) {
  const width=cell.right-cell.left-12;
  let font=14,lines=[],above=0,below=0,lineHeight;
  for(;font>=10;font-=.5){
    nameMeasure.font=`${font}px Arial`;lines=[];let line='';
    for(const character of Array.from(name)){
      if(line && nameMeasure.measureText(line+character).width>width){
        const space=line.lastIndexOf(' ');
        if(space>=0){lines.push(line.slice(0,space+1));line=line.slice(space+1)+character;}
        else {lines.push(line);line=character;}
      }else line+=character;
    }
    lines.push(line);lineHeight=font*1.2;
    above=Math.max(0,Math.floor((y-cell.top-26)/lineHeight));
    below=Math.max(0,Math.floor((cell.bottom-y-26)/lineHeight));
    if(lines.length<=above+below)break;
  }
  const topLines=Math.max(0,lines.length-below);
  const center=lines.length===1?clamp(x,cell.left+6+nameMeasure.measureText(name).width/2,cell.right-6-nameMeasure.measureText(name).width/2):(cell.left+cell.right)/2;
  return `<text text-anchor="middle" fill="white" font-size="${font}" font-family="Arial" xml:space="preserve">${lines.map((line,i)=>`<tspan x="${center-x}" y="${i<topLines?-24-topLines*lineHeight+font+i*lineHeight:24+font+(i-topLines)*lineHeight}">${esc(line)}</tspan>`).join('')}</text>`;
}
function miniPitch(formation, lineup) {
  const positions=FORMATIONS[formation],cells=lineupNameCells(positions);
  return `<svg class="mini-pitch" viewBox="0 0 900 580" role="img" aria-label="Alineación ${esc(formation)}">${pitchLines()}${positions.map(([x,y],i) => {const p=state.players.find(p=>p.id===lineup[i]);return `<g transform="translate(${x*9},${y*5.8})"><title>${esc(p?.name??'')}</title>${p?.photo?`<image href="${esc(p.photo)}" x="-20" y="-20" width="40" height="40"/>`:'<circle r="19" fill="#fff"/>'}<text text-anchor="middle" dominant-baseline="central" fill="#173f2d" font-size="16" font-family="Arial" font-weight="700">${p?.dorsal??i+1}</text>${lineupName(p?.name??'',x*9,y*5.8,cells[i])}</g>`;}).join('')}</svg>`;
}
function renderAnalysis(){return renderAnalysisBase()+renderProblems(state,ui4);}
function renderMatchBase() {
  return heading('Plan de partido', 'Equipo demo · Once y situaciones') + `<form id="match-form"><div class="formation-row"><label for="formation">Formación</label><select id="formation" name="formation">${Object.keys(FORMATIONS).map(f => `<option ${currentMatch().formation === f ? 'selected' : ''}>${f}</option>`).join('')}</select></div><div class="match-layout"><section class="match-lineup"><div id="formation-preview">${miniPitch(currentMatch().formation,currentMatch().lineup)}</div><h2>Once inicial</h2><div class="lineup-list">${currentMatch().lineup.map((id,i)=>`<div class="lineup-slot"><label for="slot-${i}">${i===0?'POR':i+1}</label><select id="slot-${i}" name="slot-${i}">${state.players.map(p=>`<option value="${esc(p.id)}" ${p.id===id?'selected':''}>${p.dorsal} · ${esc(p.name)}</option>`).join('')}</select></div>`).join('')}</div></section><section><h2>Situaciones de partido</h2><div class="board-menu">${Object.entries(BOARDS).map(([k,v])=>`<button type="button" class="secondary" data-action="match-board" data-board="${k}">${icon('waypoints')}${v}</button>`).join('')}</div><details class="legacy-notes"><summary>Notas anteriores</summary>${[['attacking','Con balón'],['defending','Sin balón'],['setPieces','Balón parado']].map(([k,label])=>summaryText(label,state.match[k])).join('')}</details></section></div><div class="form-footer"><p id="match-error" class="form-error" role="alert"></p><button class="primary" type="submit">${icon('check')}Guardar partido</button></div></form><section class="roster-section"><h2>Plantilla sintética</h2><label for="player-edit">Jugador</label><select id="player-edit">${state.players.map(p=>`<option value="${esc(p.id)}" ${p.id===selectedPlayerId?'selected':''}>${p.dorsal} · ${esc(p.name)}</option>`).join('')}</select>${personEditor('player')}</section>`;
}
function summaryText(label,value) { return `<p class="summary-label">${label}</p><p>${value ? esc(value) : 'Sin completar'}</p>`; }
function renderSummaryLegacy() {
  return heading('Resumen de preparación', 'Semana, análisis y plan de partido', `<button class="secondary" data-action="export">${icon('download')}JSON</button><button class="primary" data-action="print">${icon('printer')}Imprimir</button>`) + `<article id="print-summary"><div class="summary-top"><div><p class="eyebrow">Terreno · Demo local · Sin datos reales</p><h2>Equipo demo / Microciclo 01</h2></div><p>23—29 noviembre 2026<br>${state.sessions.length} sesiones · ${state.sessions.reduce((n,s) => n+minutes(s),0)} minutos</p></div><section class="summary-section"><h2>Semana de trabajo</h2>${DAYS.map((day,i) => { const sessions = state.sessions.filter(t => t.day === i); return sessions.map(s => `<div class="summary-session"><h3>${day} ${23+i} · ${esc(s.title)} · ${minutes(s)} min</h3><p>${esc(s.objective)}</p><ul>${s.tasks.map(t => `<li><strong>${esc(t.title)} · ${t.duration} min</strong><br>${esc(t.objective)}</li>`).join('')}</ul></div>`).join(''); }).join('') || '<p>Sin sesiones.</p>'}</section><section class="summary-section"><h2>Análisis</h2><div class="summary-columns">${[['own','Equipo propio'],['rival','Rival de demo']].map(([k,title]) => `<div><h3>${title}</h3>${summaryText('Fortalezas',state.analysis[k].strengths)}${summaryText('Debilidades',state.analysis[k].weaknesses)}${summaryText('Notas',state.analysis[k].notes)}</div>`).join('')}</div></section><section class="summary-section"><h2>Plan de partido · ${state.match.formation}</h2><p class="summary-lineup">${state.match.lineup.map((id,i) => `${i+1}. ${PLAYERS.find(p => p.id === id).name}`).join(' · ')}</p><div class="summary-columns"><div>${summaryText('Con balón',state.match.attacking)}${summaryText('Sin balón',state.match.defending)}</div><div>${summaryText('Balón parado',state.match.setPieces)}</div></div></section></article>`;
}
function openDialog(id) { dialogTrigger = document.activeElement; $(id).showModal(); icons(); }
function boardSummary(board,title) {
  const timeline=(b,name)=>`<section class="summary-section"><h2>${esc(name)} · Base</h2>${boardSVG(b,pitchLines)}${summaryText('Consigna',b.text)}${b.frames.map((f,i)=>`<h3>Cuadro ${i+1} · ${esc(f.title)}</h3>${boardSVG(f.snapshot,pitchLines)}${summaryText('Consigna',f.snapshot.text)}`).join('')}</section>`;
  return timeline(board,title)+board.versions.map(v=>timeline(v.board,`${title} · Versión ${v.title}`)).join('');
}
function renderSummaryV2() {
  let content='';
  if(previousView==='board' && currentBoard())content=boardSummary(currentBoard(),section==='match'?BOARDS[boardKey]:currentSession().title);
  else if(section==='week') {
    const start=monday(state.activeDate),end=addDays(start,6);
    content=`<h2>${start} a ${end}</h2>`+state.sessions.filter(s=>s.date>=start&&s.date<=end).map(s=>`<section class="summary-section"><h2>${esc(s.date)} · ${esc(s.title)}</h2>${summaryText('Objetivo',s.objective)}<p>${minutes(s)} min previstos · Intensidad prevista: ${s.intensity??'Sin definir'}</p><p>Convocados: ${s.called.map(id=>esc(state.players.find(p=>p.id===id).name)).join(', ')||'Sin definir'}</p><ol>${s.tasks.map(t=>`<li>${esc(t.title)} · ${t.duration} min<p>${esc(t.objective)}</p></li>`).join('')}</ol>${boardSummary(s.board,'Pizarra de sesión')}</section>`).join('');
  } else if(section==='analysis')content=`<div class="summary-columns">${[['own','Equipo propio'],['rival','Rival']].map(([k,title])=>`<section><h2>${title}</h2>${Object.entries(PHASES).map(([f,v])=>summaryText(v,state.analysis[k][f])).join('')}<h3>Notas anteriores</h3>${['strengths','weaknesses','notes'].map(f=>summaryText({strengths:'Fortalezas',weaknesses:'Debilidades',notes:'Notas'}[f],state.analysis[k][f])).join('')}</section>`).join('')}</div><h2>Rivales ficticios</h2>${state.rivals.map(p=>`<section class="summary-section">${avatar(p)}<h3>${esc(p.name)}</h3><p>${p.age} años · ${p.height} cm · ${esc({right:'Derecha',left:'Izquierda',both:'Ambas'}[p.foot])}</p><p>${esc(p.description)}</p></section>`).join('')}`;
  else content=`<h2>Once · ${state.match.formation}</h2>${miniPitch(state.match.formation,state.match.lineup)}<p>${state.match.lineup.map(id=>{const p=state.players.find(p=>p.id===id);return `${p.dorsal}. ${esc(p.name)}`;}).join(' · ')}</p><h3>Notas anteriores</h3>${['attacking','defending','setPieces'].map(f=>summaryText({attacking:'Con balón',defending:'Sin balón',setPieces:'Balón parado'}[f],state.match[f])).join('')}${Object.entries(BOARDS).map(([k,v])=>boardSummary(state.match.boards[k],v)).join('')}`;
  return heading('Resumen de preparación', {week:'Semana',analysis:'Análisis',match:'Partido'}[section],`<button class="secondary" data-action="back">${icon('arrow-left')}Volver</button><button class="secondary" data-action="print">${icon('printer')}Imprimir</button>`) + `<article id="print-summary"><p>Terreno · Demo ficticia</p>${content}</article>`;
}
function exerciseSummary(t){return `<section class="summary-section"><h3>${esc(t.title)}</h3>${planSummary(t)}${summaryText('Tiempo total previsto',t.duration===null?'Pendiente':`${t.duration} min`)}${Object.entries(NUMBERS).map(([k,[label]])=>summaryText(label,t[k]===null?'Pendiente':t[k].toLocaleString('es-ES'))).join('')}${Object.entries(TEXTS).map(([k,[label]])=>summaryText(label,t[k])).join('')}${boardSummary(t.board,'Pizarra del ejercicio')}</section>`;}
function renderSummaryBase(){
  if(section!=='week'||previousView==='board')return renderSummaryV2();
  const start=monday(state.activeDate),end=addDays(start,6);
  const content=exerciseSummaryOnly||exerciseOwner==='library'?exerciseSummary(currentExercise()):`<h2>${start} a ${end}</h2>${state.sessions.filter(s=>s.date>=start&&s.date<=end).map(s=>`<section class="summary-section"><h2>${esc(s.date)} · ${esc(s.title)}</h2>${summaryText('Objetivo de sesión',s.objective)}${planSummary(s)}<p>${esc(mdLabel(s.date,state.fixtures.find(f=>f.id===state.referenceMatchId)))}</p><p>${volume(s)} previstos · Intensidad prevista: ${s.intensity??'Sin definir'}</p><p>Convocados: ${s.called.map(id=>esc(state.players.find(p=>p.id===id).name)).join(', ')||'Sin definir'}</p>${s.tasks.map(exerciseSummary).join('')}${boardSummary(s.board,'Pizarra general de sesión')}</section>`).join('')}`;
  return heading('Resumen de preparación',exerciseOwner==='library'?'Biblioteca propia':exerciseSummaryOnly?'Ejercicio':'Semana',`<button class="secondary" data-action="back">${icon('arrow-left')}Volver</button><button class="secondary" data-action="print">${icon('printer')}Imprimir</button>`)+`<article id="print-summary"><p>Terreno · Demo ficticia</p>${content}</article>`;
}
function renderMatch(){return variantTools(state,ui4)+renderMatchBase()+variantDetails(state,ui4);}
function planSummary(p){return summaryText('Carga prevista manual',LOADS[p.plannedLoad])+summaryText('Objetivo físico previsto',p.physicalObjective)+summaryText('Objetivo táctico previsto',p.tacticalObjective);}
function matchSummaryExtras(){
  const details=v=>`<p>Banquillo: ${v.bench.map(id=>esc(state.players.find(p=>p.id===id).name)).join(', ')||'Sin definir'}</p><p>No convocados: ${v.notCalled.map(id=>esc(state.players.find(p=>p.id===id).name)).join(', ')||'Sin definir'}</p>${v.positionNotes.map((n,i)=>summaryText(`Posición ${i+1}`,n)).join('')}`;
  return `<section class="summary-section"><h2>Particiones y consignas del plan base</h2>${details(state.match)}</section>${state.match.variants.map(v=>`<section class="summary-section"><h2>${esc(v.title)}</h2>${miniPitch(v.formation,v.lineup)}${details(v)}${Object.entries(BOARDS).map(([k,title])=>boardSummary(v.boards[k],title)).join('')}</section>`).join('')}`;
}
function renderSummary(){
  if(section==='roster')return heading('Resumen compartible','DEMO FICTICIA',`<button class="secondary" data-action="back">${icon('arrow-left')}Volver</button><button class="secondary" data-action="print">${icon('printer')}Imprimir</button>`)+`<article id="print-summary">${rosterSummary(state,rosterUi)}</article>`;
  if(section==='academy')return heading('Academia','No conectada',`<button class="secondary" data-action="back">${icon('arrow-left')}Volver</button>`)+'<article id="print-summary"><p>Academia no conectada. Arquitectura propuesta, sin servicios operativos.</p></article>';
  if(section==='week'&&['individual','nutrition'].includes(ui4.weekMode))return heading('Resumen compartible','DEMO FICTICIA',`<button class="secondary" data-action="back">${icon('arrow-left')}Volver</button><button class="secondary" data-action="print">${icon('printer')}Imprimir</button>`)+`<article id="print-summary">${minimalWeekSummary(state,ui4.weekMode)}</article>`;
  if(ui4.framePrint)return heading('Cuadro táctico',esc(ui4.framePrint.title),`<button class="secondary" data-action="back">${icon('arrow-left')}Volver</button><button class="secondary" data-action="print">${icon('printer')}Imprimir</button>`)+`<article id="print-summary">${boardSummary({...newBoard(),...ui4.framePrint.board},ui4.framePrint.title)}</article>`;
  if(section==='week'&&ui4.weekMode!=='microcycle')return heading('Resumen local','Datos ficticios',`<button class="secondary" data-action="back">${icon('arrow-left')}Volver</button><button class="secondary" data-action="print">${icon('printer')}Imprimir</button>`)+`<article id="print-summary" class="summary-v4">${ui4.weekMode==='season'?renderSeason(state,ui4):ui4.weekMode==='individual'?renderIndividual(state,ui4):renderNutrition(state,ui4)}</article>`;
  return renderSummaryBase();
}
function closeDialog(node) { if(!canLeave())return;node.closest('dialog')?.close(); dialogTrigger?.isConnected && dialogTrigger.focus(); }
function selectDate(date) {
  if(date<'1900-01-01'||date>'2100-12-31'){notify('Fecha fuera de 1900–2100.',true);return;}
  exerciseOwner='session';selectedExerciseId=null;
  state.activeDate=date;state.selectedSessionId=state.sessions.find(t=>t.date===date)?.id??null;selectedPieceId=null;save();render();focusElement(`[data-date="${date}"]`);
}
function exportData() {
  refreshDirty();
  const drafts=dirty?$$('#view-panel form').map(f=>({form:f.id,fields:[...new FormData(f)].filter(([,v])=>typeof v==='string')})):[];
  const payload = {product:'Terreno',demo:true,notice:'Respaldo completo: incluye registros, notas y pautas FICTICIOS y puede incluir borradores no guardados.',exportedAt:new Date().toISOString(),state:clean(state),drafts};
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type:'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'terreno-demo-v6.json'; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500); notify('Respaldo JSON con registros y pautas FICTICIOS; puede incluir borradores no guardados.');
}
function movePiece(dx,dy) {
  const p = currentPiece(); if (!p) return;
  p.x = clamp(p.x+dx,3,97-(p.width??0)); p.y = clamp(p.y+dy,5,95-(p.height??0)); updatePiece(); save();
}
function updatePieceV2() {
  const p = currentPiece(); if (!p) return;
  $$('[data-piece]').forEach(g => { g.classList.toggle('is-selected',g.dataset.piece === p.id); g.setAttribute('aria-pressed',String(g.dataset.piece === p.id)); });
  const g = $(`[data-piece="${CSS.escape(p.id)}"]`); if (g) { g.setAttribute('transform', `translate(${p.x*9},${p.y*5.8})`); g.setAttribute('aria-label', `${p.kind === 'player' ? 'Jugador' : 'Cono'} ${p.label}, X ${Math.round(p.x)}, Y ${Math.round(p.y)}`); }
  if(!p.kind){g.querySelector('path').setAttribute('d',`M0 0L${(p.x2-p.x)*9} ${(p.y2-p.y)*5.8}`);const end=g.querySelector('circle');end.setAttribute('cx',(p.x2-p.x)*9);end.setAttribute('cy',(p.y2-p.y)*5.8);}
  for(const axis of ['x2','y2']) {
    if(!p.kind && !$(`#piece-${axis}`))$('.inspector-row').insertAdjacentHTML('beforeend',`<div><label for="piece-${axis}">${axis.toUpperCase()} destino (%)</label><input id="piece-${axis}" data-coordinate="${axis}" type="number" min="${axis==='x2'?3:5}" max="${axis==='x2'?97:95}" step="any"></div>`);
    if(p.kind && $(`#piece-${axis}`))$(`#piece-${axis}`).parentElement.remove();
  }
  for(const axis of ['x','y','x2','y2'])if($(`#piece-${axis}`))$(`#piece-${axis}`).value=p[axis];
  $('#piece-select').value = p.id;
}
function updatePiece(){
  const p=currentPiece();if(!p)return;const svg=$('#pitch');if(!svg)return;
  $$('[data-piece]',svg).forEach(g=>{g.classList.toggle('is-selected',g.dataset.piece===p.id);g.setAttribute('aria-pressed',String(g.dataset.piece===p.id));});
  const g=$(`[data-piece="${CSS.escape(p.id)}"]`,svg);
  if(g){const fragment=document.createElementNS('http://www.w3.org/2000/svg','svg');fragment.innerHTML=objectSVG(p,true,svg.dataset.marker);const parsed=fragment.firstElementChild;for(const a of [...parsed.attributes])g.setAttribute(a.name,a.value);g.replaceChildren(...parsed.childNodes);}
  const pane=$('#board-inspector');
  if(pane.dataset.selected!==p.id||Boolean($('#arrow-curve')?.checked)!==Boolean(p.curve)){
    pane.innerHTML=inspector(currentBoard(),p);pane.dataset.selected=p.id;icons();
  }
  for(const axis of ['x','y','x2','y2','cx','cy','width','height'])if($(`#piece-${axis}`))$(`#piece-${axis}`).value=p[axis];
  $('#piece-select').value=p.id;$('#piece-team').value=p.team;
}
function refreshExercise(){
  const t=currentExercise();if(!t)return;
  const title=$(`[data-exercise-title="${CSS.escape(t.id)}"]`);if(title){title.textContent=t.title;title.parentElement.querySelector('small').textContent=t.duration===null?'Tiempo pendiente':`${t.duration} min`;}
  const s=currentSession();if($('.session-volume'))$('.session-volume').innerHTML=sessionVolume(s);
  const choice=s?$(`[data-action="session"][data-id="${CSS.escape(s.id)}"] small`):null;if(choice)choice.textContent=`${s.tasks.length} ejercicios · ${volume(s)}`;
  const day=$(`[data-date="${state.activeDate}"] .day-load`);if(day)day.textContent=`${state.sessions.filter(a=>a.date===state.activeDate).reduce((n,a)=>n+minutes(a),0)} min`;
}
function commitV4(candidate,message,form=null,rerender=true){
  try{const normalized=clean(candidate);JSON.stringify(normalized);state=normalized;const saved=save(message);if(form&&saved)savedForm(form);if(rerender&&!dirty)render();return saved;}catch(error){notify(error.message,true);return false;}
}
function exportFrame(){
  const frame=currentBoard(),root=currentBoardRoot(),name=ui4.frameIndex<0?'Base':root.frames[ui4.frameIndex].title;
  const host=document.createElementNS('http://www.w3.org/2000/svg','svg');host.innerHTML=boardSVG(frame,pitchLines);const svg=host.firstElementChild;svg.setAttribute('xmlns','http://www.w3.org/2000/svg');const title=document.createElementNS('http://www.w3.org/2000/svg','title');title.textContent=`Representación táctica · ${name}`;svg.prepend(title);
  const blob=new Blob([new XMLSerializer().serializeToString(svg)],{type:'image/svg+xml;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`terreno-cuadro-${ui4.frameIndex<0?'base':ui4.frameIndex+1}.svg`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);notify(`SVG del cuadro ${name}, sin vídeo.`);
}
function v4Action(action,b){
  if(action==='v4-play'){if(playback.playing)playback.pause();else if(!motion.matches&&currentBoardRoot()?.frames.length&&canLeave())playback.play(currentBoardRoot().frames.map(f=>f.snapshot));return true;}
  if(!action.startsWith('v4-'))return false;
  playback.stop();
  if(action==='v4-export-svg'){exportFrame();return true;}
  if(action==='v4-print-frame'){if(!canLeave())return true;ui4.framePrint={title:ui4.frameIndex<0?'Cuadro base':currentBoardRoot().frames[ui4.frameIndex].title,board:snapshot(currentBoard())};previousView=view;view='summary';render();window.print();return true;}
  if(!canLeave())return true;
  try{
    const kinds={fixture:['fixtures','fixtureId'],phase:[null,'phaseId'],record:['records','recordId'],nutrition:['nutrition','nutritionId'],problem:['problems','problemId']};
    const match=action.match(/^v4-(edit|new|delete)-(fixture|phase|record|nutrition|problem)$/);
    if(match){const[,operation,kind]=match,[collection,field]=kinds[kind];if(operation!=='delete'){ui4[field]=operation==='new'?null:b.dataset.id;render();const selector={fixture:'#v4-fixtureTitle',phase:'#v4-phaseTitle',record:'#v4-recordPlayer',nutrition:'#v4-nutritionPlayer',problem:'#v4-problemText'}[kind];focusOpen(selector);return true;}if(!confirm('¿Eliminar este registro ficticio?'))return true;const candidate=structuredClone(state);if(kind==='phase')candidate.season.phases=candidate.season.phases.filter(p=>p.id!==b.dataset.id);else candidate[collection]=candidate[collection].filter(p=>p.id!==b.dataset.id);if(kind==='fixture'&&candidate.referenceMatchId===b.dataset.id)candidate.referenceMatchId=null;ui4[field]=null;commitV4(candidate,'Registro eliminado.');return true;}
    if(action==='v4-duplicate-week'){const destination=$('#v4-copy-destination').value;if(!destination)throw new Error('Selecciona un lunes de destino');if(!confirm('¿Duplicar solo la planificación? No se copiarán realizados, pautas ni partidos.'))return true;const candidate=duplicateWeek(state,destination,clean);selectedExerciseId=null;ui4.frameIndex=-1;commitV4(candidate,'Planificación duplicada.');return true;}
    if(action==='v4-copy-variant'){if(state.match.variants.length>=12)throw new Error('Límite: 12 variantes');if(!confirm('¿Copiar la variante con tableros independientes?'))return true;const original=currentMatch(),copy={id:uid(),title:`Variante ${state.match.variants.length+1}`,formation:original.formation,lineup:[...original.lineup],bench:[...original.bench],notCalled:[...original.notCalled],positionNotes:[...original.positionNotes],boards:Object.fromEntries(Object.entries(original.boards).map(([k,v])=>[k,cloneBoard(v)]))};const candidate=structuredClone(state);candidate.match.variants.push(copy);ui4.variantId=copy.id;commitV4(candidate,'Variante copiada.');return true;}
    if(action==='v4-delete-variant'){if(!ui4.variantId)return true;if(!confirm('¿Eliminar esta variante y sus versiones?'))return true;const candidate=structuredClone(state);candidate.match.variants=candidate.match.variants.filter(v=>v.id!==ui4.variantId);ui4.variantId=null;commitV4(candidate,'Variante eliminada.');return true;}
    const root=currentBoardRoot();
    if(action==='v4-step-next'||action==='v4-step-back'){if(!root?.frames.length)return true;ui4.frameIndex=Math.max(-1,Math.min(root.frames.length-1,ui4.frameIndex+(action==='v4-step-next'?1:-1)));selectedPieceId=null;render();return true;}
    if(action==='v4-add-frame'){if(root.frames.length>=8)throw new Error('Límite: 8 cuadros por tablero');root.frames.push({id:uid(),title:`Cuadro ${root.frames.length+1}`,snapshot:snapshot(currentBoard())});ui4.frameIndex=root.frames.length-1;selectedPieceId=null;save('Cuadro copiado con identidades de recurso estables.');render();return true;}
    if(action==='v4-delete-frame'){if(ui4.frameIndex<0)return true;if(!confirm('¿Eliminar el cuadro seleccionado?'))return true;root.frames.splice(ui4.frameIndex,1);ui4.frameIndex=Math.min(ui4.frameIndex,root.frames.length-1);save('Cuadro eliminado.');render();return true;}
    if(action==='v4-save-version'){if(root.versions.length>=12)throw new Error('Límite: 12 versiones');const title=$('#v4-versionTitle').value.trim();if(!title)throw new Error('Escribe el nombre de la versión');const copy=cloneBoard(root);delete copy.versions;root.versions.push({id:uid(),title,board:copy});save('Versión táctica guardada.');render();return true;}
    if(action==='v4-restore-version'){const version=root.versions.find(v=>v.id===$('#v4-version').value);if(!version)throw new Error('Selecciona una versión');if(!confirm('¿Cargar una copia de la versión? Se sustituye el tablero visible, no las versiones guardadas.'))return true;const copy=cloneBoard({...version.board,versions:[]}),versions=root.versions;Object.assign(root,copy,{versions});ui4.frameIndex=-1;save('Copia de versión cargada.');render();return true;}
  }catch(error){notify(error.message,true);}
  return true;
}
function linkedExerciseAction(action,b){
  if(!['copy-task','delete-exercise','delete-session','delete-task'].includes(action))return false;
  playback.stop();
  const exercise=currentExercise(),session=currentSession(),ids=action==='delete-session'?session.tasks.map(t=>t.id):[b.dataset.id??exercise?.id];
  const links=state.problems.filter(p=>ids.includes(p.exerciseId)).length,records=action==='delete-session'?state.records.filter(r=>r.sessionId===session.id).length:0;
  if(!confirm(`${action==='copy-task'?'¿Copiar ficha y tablero independientes?':'¿Eliminar este plan?'}${links&&action!=='copy-task'?` Se desvincularán ${links} problemas, conservando sus textos.`:''}${records?` Se desvincularán ${records} registros simulados sin borrarlos.`:''}`)||!canLeave())return true;
  const candidate=structuredClone(state),targetSession=candidate.sessions.find(t=>t.id===session?.id),tasks=exerciseOwner==='library'?candidate.library:targetSession?.tasks;
  if(action==='copy-task'){if(tasks.length>=30){notify('Límite: 30 ejercicios.',true);return true;}const map=new Map(),copy=cloneExercise(exercise,map);tasks.splice(tasks.findIndex(t=>t.id===exercise.id)+1,0,copy);candidate.problems.push(...candidate.problems.filter(p=>p.exerciseId===exercise.id).map(p=>({...p,id:uid(),exerciseId:copy.id})));selectedExerciseId=copy.id;}
  else if(action==='delete-session'){candidate.sessions=candidate.sessions.filter(t=>t.id!==session.id);candidate.selectedSessionId=candidate.sessions.find(t=>t.date===candidate.activeDate)?.id??null;candidate.records.forEach(r=>{if(r.sessionId===session.id)r.sessionId=null;});}
  else {if(exerciseOwner==='library'&&tasks.length===1){notify('Conserva un ejercicio en biblioteca.',true);return true;}const index=tasks.findIndex(t=>ids.includes(t.id));tasks.splice(index,1);selectedExerciseId=tasks[Math.min(index,tasks.length-1)]?.id??null;}
  if(action!=='copy-task')candidate.problems.forEach(p=>{if(ids.includes(p.exerciseId))p.exerciseId=null;});
  selectedPieceId=null;commitV4(candidate,action==='copy-task'?'Ejercicio copiado.':'Plan eliminado, referencias resueltas.');return true;
}
function exerciseTarget(id){const library=state.library.find(t=>t.id===id);if(library)return{owner:'library',exercise:library,session:null};for(const session of state.sessions){const exercise=session.tasks.find(t=>t.id===id);if(exercise)return{owner:'session',exercise,session};}return null;}
function openExerciseLink(id){
  const problem=state.problems.find(p=>p.id===id),target=exerciseTarget(problem?.exerciseId);
  if(!target){notify('El ejercicio vinculado ya no está disponible.',true);return;}
  if(!canLeave())return;
  analysisReturn={problemId:id,targetId:target.exercise.id,targetOwner:target.owner,activeDate:state.activeDate,sessionId:state.selectedSessionId,exerciseId:selectedExerciseId,owner:exerciseOwner,period,rivalId:selectedRivalId,ui:{...ui4,framePrint:null},scrollX:window.scrollX,scrollY:window.scrollY};
  playback.stop();section=view='week';boardKey=null;ui4.weekMode='microcycle';ui4.frameIndex=-1;ui4.framePrint=null;exerciseOwner=target.owner;selectedExerciseId=target.exercise.id;selectedPieceId=null;
  if(target.session){state.activeDate=target.session.date;state.selectedSessionId=target.session.id;}
  render();focusElement('#exercise-title');
}
function returnToAnalysis(){
  if(!analysisReturn||!canLeave())return;
  const origin=analysisReturn;analysisReturn=null;playback.stop();state.activeDate=origin.activeDate;state.selectedSessionId=state.sessions.find(s=>s.id===origin.sessionId&&s.date===origin.activeDate)?.id??null;exerciseOwner=origin.owner;selectedExerciseId=origin.exerciseId;period=origin.period;selectedRivalId=origin.rivalId;Object.assign(ui4,origin.ui);section=view='analysis';boardKey=null;selectedPieceId=null;render();
  const focus=$(`[data-action="open-exercise-link"][data-id="${CSS.escape(origin.problemId)}"]`)??$('#v4-problemText');focus?.focus({preventScroll:true});window.scrollTo(origin.scrollX,origin.scrollY);
}
document.addEventListener('click', event => {
  const tab = event.target.closest('[data-tab]');
  if (tab) { if (!changeView(tab.dataset.tab)) $(`#tab-${section}`).focus(); return; }
  const b = event.target.closest('[data-action]'); if (!b || b.disabled) return;
  const action = b.dataset.action;
  if(action!=='v4-play')playback.stop();
  if(action==='v6-stop'){playback.stop();return;}
  if(action==='v6-home'){
    playback.stop();if(!canLeave())return;
    if(view!=='home')homeReturn={view,section,boardKey,owner:exerciseOwner,exerciseId:selectedExerciseId,ui:{...ui4},period};
    view='home';render();focusElement('#view-panel h1');return;
  }
  if(action==='v6-continue'){
    playback.stop();if(!canLeave())return;
    if(homeReturn){({view,section,boardKey,period}=homeReturn);exerciseOwner=homeReturn.owner;selectedExerciseId=homeReturn.exerciseId;Object.assign(ui4,homeReturn.ui);}else{view=section='week';exerciseOwner='session';}
    render();focusElement('#view-panel h1');return;
  }
  if(action==='v6-goto'){changeView(b.dataset.destination,true);return;}
  if(action==='v6-open-session'||action==='v6-open-general'){
    playback.stop();if(!canLeave())return;const session=state.sessions.find(s=>s.id===b.dataset.id);if(!session)return notify('Sesión no disponible.',true);
    state.activeDate=session.date;state.selectedSessionId=session.id;exerciseOwner='session';selectedExerciseId=session.tasks[0]?.id??null;ui4.weekMode='microcycle';section='week';boardKey=null;view=action==='v6-open-general'?'board':'week';render();focusElement('#view-panel h1');return;
  }
  if(['library','v6-select-library','v6-new-exercise','v6-clear-filter','v6-copy-session'].includes(action)){
    playback.stop();
    if(action==='v6-clear-filter'){libraryUi.query=libraryUi.filter='';$('#v6-search').value='';$('#v6-objective').value='';$('#v6-results').innerHTML=libraryResults(state,libraryUi,selectedExerciseId);icons();return;}
    if(!canLeave())return;
    try{
      if(action==='v6-copy-session'){const result=copyToSession(state,selectedExerciseId,libraryUi.destination,clean);commitV4(result.candidate,'Copia independiente añadida a la sesión elegida.');return;}
      if(action==='v6-new-exercise'){const candidate=structuredClone(state),exercise=newExercise(state);candidate.library.push(exercise);clean(candidate);selectedExerciseId=exercise.id;commitV4(candidate,'Ejercicio de biblioteca creado.');}
      if(action==='v6-select-library'){if(!state.library.some(t=>t.id===b.dataset.id))return;selectedExerciseId=b.dataset.id;}
      section='week';view='library';exerciseOwner='library';boardKey=null;ui4.weekMode='microcycle';ui4.frameIndex=-1;selectedPieceId=null;render();focusElement(action==='library'?'#v6-search':'#exercise-title');
    }catch(error){notify(error.message,true);}return;
  }
  if(action.startsWith('v5-')){
    if(!canLeave())return;
    if(action==='v5-select-player'){selectRosterPlayer(b.dataset.id);return;}
    if(action==='v5-open-session'){const session=state.sessions.find(t=>t.id===b.dataset.id);if(session){state.activeDate=session.date;state.selectedSessionId=session.id;ui4.weekMode='microcycle';exerciseOwner='session';selectedExerciseId=session.tasks[0]?.id??null;changeView('week',true);}return;}
    if(action.startsWith('v5-delete-')&&!confirm('¿Eliminar este registro ficticio? Se rechaza si tiene dependencias.'))return;
    try{const candidate=rosterAction(action,b.dataset.id,state,rosterUi);if(candidate)commitV4(candidate,'Registro ficticio guardado.');else{render();const selector=action.includes('stat')?'#v5-fixtureId':action.includes('sanction')?'#v5-sanctionDate':action.includes('competition')?'#v5-competitionName':'#v5-seasonName';focusOpen(selector);}}catch(error){notify(error.message,true);}return;
  }
  if(action==='open-exercise-link')return openExerciseLink(b.dataset.id);
  if(action==='return-analysis')return returnToAnalysis();
  if(v4Action(action,b)||linkedExerciseAction(action,b))return;
  playback.stop();
  if (action === 'close-dialog') return closeDialog(b);
  if (action === 'export') return exportData();
  if (action === 'summary' || action === 'print' || action==='exercise-summary') {if(view!=='summary'){if(!canLeave())return;exerciseSummaryOnly=action==='exercise-summary';previousView=view;view='summary';render();}if(action==='print')window.print();return;}
  if(['select-exercise','edit-library','leave-library'].includes(action)){
    if(!canLeave())return;exerciseOwner=action==='edit-library'?'library':'session';selectedExerciseId=action==='leave-library'?currentSession()?.tasks[0]?.id??null:b.dataset.id;selectedPieceId=null;$('#library-dialog').close();render();focusElement('#exercise-title');return;
  }
  if(['task-up','task-down','copy-task','delete-exercise'].includes(action)){
    if((action==='copy-task'||action==='delete-exercise')&&!confirm(action==='copy-task'?'¿Copiar este ejercicio con ficha y pizarra independientes?':'¿Eliminar este ejercicio y su pizarra?'))return;
    if(!canLeave())return;const tasks=exerciseOwner==='library'?state.library:currentSession().tasks;const index=tasks.findIndex(t=>t.id===(b.dataset.id??selectedExerciseId));
    if(action==='copy-task'){if(tasks.length>=30)return notify('Límite: 30 ejercicios.',true);const copy=cloneExercise(tasks[index]);tasks.splice(index+1,0,copy);selectedExerciseId=copy.id;}
    else if(action==='delete-exercise'){if(exerciseOwner==='library'&&tasks.length===1)return notify('Conserva al menos un ejercicio en biblioteca.',true);tasks.splice(index,1);selectedExerciseId=tasks[Math.min(index,tasks.length-1)]?.id??null;}
    else {const next=index+(action==='task-up'?-1:1);if(next<0||next>=tasks.length)return;[tasks[index],tasks[next]]=[tasks[next],tasks[index]];}
    selectedPieceId=null;save();render();focusElement('#exercise-title');return;
  }
  if(action==='back'){if(view==='summary')return changeView(previousView,true,true);return changeView(section,true,true);}
  if(action==='open-board' || action==='match-board') {if(!canLeave())return;boardKey=action==='match-board'?b.dataset.board:null;view='board';selectedPieceId=null;render();focusElement('#view-panel h1');return;}
  if(action==='period' || action==='calendar-prev' || action==='calendar-next') {
    if(!canLeave())return;
    if(action==='period')period=b.dataset.period;
    else if(period==='week')state.activeDate=addDays(state.activeDate,action==='calendar-prev'?-7:7);
    else {const date=new Date(`${state.activeDate.slice(0,7)}-01T12:00:00Z`);date.setUTCMonth(date.getUTCMonth()+(action==='calendar-prev'?-1:1));state.activeDate=date.toISOString().slice(0,10);}
    selectDate(state.activeDate);return;
  }
  if(action==='template') {
    if(!canLeave())return;if(state.sessions.length>=200)return notify('Límite v4: 200 sesiones.',true);
    const config={connect:['Conectar y progresar',['rondo','possession','transition']],transition:['Transiciones y finalización',['transition','finish']],match:['Preparación de partido',['setpiece','game']]}[b.dataset.template];
    const s={id:uid(),day:(new Date(`${state.activeDate}T12:00:00Z`).getUTCDay()+6)%7,date:state.activeDate,title:config[0],objective:'Trabajo colectivo de demo.',tasks:config[1].map(taskFrom),board:upgradeBoard({...defaultBoard(),arrows:[],text:''}),called:state.players.map(p=>p.id),intensity:null,...planDefaults()};
    exerciseOwner='session';selectedExerciseId=null;
    state.sessions.push(s);state.selectedSessionId=s.id;save('Plantilla copiada.');render();focusElement('#session-title');return;
  }
  if(action==='new-rival' || action==='edit-rival') {
    if(!canLeave())return;
    if(action==='new-rival'){if(state.rivals.length>=30)return notify('Límite: 30 fichas.',true);const p={id:uid(),name:`Rival ficticio ${state.rivals.length+1}`,age:25,height:180,foot:'right',description:'',photo:null};state.rivals.push(p);selectedRivalId=p.id;save();}
    else selectedRivalId=b.dataset.id;
    render();focusElement('#person-name');return;
  }
  if(action==='delete-rival'){if(!confirm('¿Eliminar esta ficha ficticia?'))return;state.rivals=state.rivals.filter(p=>p.id!==selectedRivalId);selectedRivalId=null;dirty=false;save();render();return;}
  if(action==='remove-photo'){if(!confirm('¿Quitar la foto de esta ficha?'))return;const f=$('#person-form');const p=(f.dataset.kind==='rival'?state.rivals:state.players).find(p=>p.id===f.dataset.id);p.photo=null;save();const image=f.querySelector('.avatar');if(image)image.outerHTML=avatar(p);return;}
  if (action === 'goto-week') return changeView('week',true);
  if (action === 'day' || action === 'session') {
    if (!canLeave()) return;
    if (action === 'day') return selectDate(b.dataset.date);
    else {state.selectedSessionId = b.dataset.id;exerciseOwner='session';selectedExerciseId=null;}
    selectedPieceId = null; save(); render(); focusElement(`[data-action="session"][data-id="${CSS.escape(state.selectedSessionId)}"]`); return;
  }
  if (action === 'new-session') {
    if (state.sessions.length >= 200) return notify('Límite v4: 200 sesiones.',true);
    if (!canLeave()) return;
    $('#new-session-form').reset(); $('#new-session-day').textContent = state.activeDate;
    openDialog('#session-dialog'); $('#new-title').focus(); return;
  }
  if (action === 'library') {
    if (!currentSession()) return;
    if(!canLeave())return;
    $('#library-items').innerHTML = state.library.map(t=>`<section class="library-task"><div><h3>${esc(t.title)}</h3><p>${esc(t.type)} · ${t.duration??'Pendiente'} min</p></div><div class="exercise-actions"><button class="icon-button secondary" data-action="edit-library" data-id="${esc(t.id)}" title="Editar ficha de biblioteca" aria-label="Editar ${esc(t.title)}">${icon('pencil')}</button><button class="secondary" data-action="add-task" data-library="${esc(t.id)}" aria-label="Añadir ${esc(t.title)}">${icon('plus')}Añadir</button></div></section>`).join('');
    openDialog('#library-dialog'); return;
  }
  if (action === 'add-task') {
    const s = currentSession(); if (!s || s.tasks.length >= 30) return notify('Límite de demo: 30 tareas por sesión.',true);
    if (!canLeave()) return;
    const task=taskFrom(b.dataset.library);s.tasks.push(task);exerciseOwner='session';selectedExerciseId=task.id;selectedPieceId=null;$('#library-dialog').close();save('Ejercicio añadido.');render();focusElement('#exercise-title');return;
  }
  if (action === 'delete-session') {
    if (!window.confirm('¿Eliminar esta sesión y sus tareas y pizarra?')) return;
    const id = state.selectedSessionId; state.sessions = state.sessions.filter(s => s.id !== id); state.selectedSessionId = state.sessions.find(t => t.date === state.activeDate)?.id ?? null; dirty = false;
    save('Sesión eliminada.'); render(); focusElement('[data-action="new-session"]'); return;
  }
  if (action === 'delete-task') {
    if (!window.confirm('¿Eliminar esta tarea de la sesión?')) return;
    if (!canLeave()) return;
    currentSession().tasks = currentSession().tasks.filter(t => t.id !== b.dataset.id); save('Tarea eliminada.'); render(); focusElement('[data-action="library"]'); return;
  }
  if (action === 'reset') {
    if(storageBlocked)return notify('Guardado bloqueado: exporta antes de recuperar los datos. No se sobrescribirá la fuente.',true);
    if (!window.confirm('¿Restablecer todos los datos de esta demo? Se perderán los cambios guardados y de formulario.')) return;
    try{store.reset();syncStore();}catch{notify('Acceso bloqueado: no se ha restablecido.',true);return;}
    state = fresh();Object.assign(rosterUi,rosterDefaults(state)); storageBlocked = false; storageMessage = ''; dirty = false; view = section = 'week'; selectedPieceId = selectedExerciseId = null;exerciseOwner='session';needsInitialSave=false;ui4.variantId=null;ui4.frameIndex=-1;
    save('Demo restablecida.'); render(); focusElement('#tab-week'); return;
  }
  if (action === 'move') return movePiece(Number(b.dataset.dx),Number(b.dataset.dy));
  if (action === 'add-piece') {
    if(!canLeave())return;
    const board=currentBoard();const kind=$('#add-kind').value;if(!board)return;
    if(kind==='zone'){if(board.zones.length>=20)return notify('Límite: 20 zonas.',true);const zone={id:uid(),label:`Z${board.zones.length+1}`,x:30,y:30,width:20,height:20,team:'neutral'};board.zones.push(zone);selectedPieceId=zone.id;save();render();focusElement('#piece-width');return;}
    if(kind==='arrow'){if(board.arrows.length>=30)return notify('Límite: 30 flechas.',true);const arrow={id:uid(),x:40,y:40,x2:60,y2:60,cx:50,cy:30,curve:false,dashed:false,team:'neutral',movement:''};board.arrows.push(arrow);selectedPieceId=arrow.id;save();render();focusElement('#piece-x2');return;}
    if (board.pieces.length >= 40) return notify('Límite de demo: 40 piezas.',true);
    const labels = board.pieces.filter(p => p.kind === kind).map(p => p.label);
    let n = 1; while (labels.includes(kind === 'player' ? String(n) : `C${n}`)) n++;
    const p = { id:uid(), kind, label:kind === 'player' ? String(n) : `C${n}`, x:50,y:50,team:'neutral',role:'' };
    board.pieces.push(p); selectedPieceId = p.id; save('Pieza añadida.'); render(); focusElement('#piece-select'); return;
  }
  if (action === 'delete-piece') {
    if (!window.confirm('¿Eliminar la pieza seleccionada?')) return;
    if(!canLeave())return;
    const board=currentBoard();for(const key of ['pieces','arrows','zones'])board[key]=board[key].filter(p=>p.id!==selectedPieceId);selectedPieceId = null; save('Recurso eliminado.'); render(); focusElement('#piece-select'); return;
  }
  if (action === 'reset-board') {
    if (!window.confirm('¿Restablecer el tablero completo de este contexto, con sus cuadros y versiones?')) return;
    if(!canLeave())return;
    if(section==='match')currentMatch().boards[boardKey]=newBoard();else if(view==='week'||view==='library')currentExercise().board=newBoard();else currentSession().board=upgradeBoard({...defaultBoard(),arrows:[],text:''});ui4.frameIndex=-1;
    selectedPieceId = null; save('Pizarra restablecida.'); render(); focusElement('#piece-select');
  }
});
document.addEventListener('submit', async event => {
  playback.stop();
  event.preventDefault(); const form = event.target;
  if (!form.reportValidity()) return;
  const data = new FormData(form);
  if(form.id.startsWith('v4-')||form.id.startsWith('v5-')){try{const candidate=submitRoster(form,data,state,rosterUi,ui4,formCandidate,section);if(candidate)commitV4(candidate,'Datos ficticios guardados.',form);}catch(error){notify(error.message,true);}return;}
  if (form.id === 'new-session-form') {
    const title = data.get('title').trim(); if (!title) { $('#new-title').setCustomValidity('Escribe un nombre de sesión.'); $('#new-title').reportValidity(); return; }
    const s = { id:uid(), day:(new Date(`${state.activeDate}T12:00:00Z`).getUTCDay()+6)%7,date:state.activeDate, title, objective:data.get('objective').trim(), tasks:[], board:upgradeBoard({...defaultBoard(),arrows:[],text:''}),called:[],intensity:null,...planDefaults() };
    exerciseOwner='session';selectedExerciseId=null;
    state.sessions.push(s); state.selectedSessionId = s.id; $('#session-dialog').close(); view = 'week';dirty=false; save('Sesión creada.'); render(); focusElement('#session-title');
  } else if (form.id === 'session-edit') {
    const title = data.get('title').trim(); if (!title) { $('#session-title').setCustomValidity('Escribe un nombre de sesión.'); $('#session-title').reportValidity(); return; }
    if(!data.get('date')){notify('La sesión requiere una fecha.',true);return;}
    const s=currentSession();s.title=title;s.objective=data.get('objective');s.date=data.get('date');s.intensity=data.get('intensity')===''?null:Number(data.get('intensity'));s.called=data.getAll('called');state.activeDate=s.date;
    if(save('Sesión guardada.')){savedForm(form);if(!dirty){render();focusElement('#session-title');}else refreshExercise();}
  } else if(form.id==='exercise-form'){
    const t=currentExercise(),next={...t,title:data.get('title').trim(),duration:data.get('duration')===''?null:Number(data.get('duration'))};
    next.objectiveTags=data.getAll('objectiveTags');
    if(!next.title)return notify('Escribe un título de ejercicio.',true);
    for(const k of Object.keys(NUMBERS))next[k]=data.get(k)===''?null:Number(data.get(k));
    if(next.jokers!==null&&(next.participants===null||next.jokers>next.participants)){$('#exercise-error').textContent='Los comodines están incluidos en el total y no pueden superarlo; informa el total.';return;}
    for(const k of Object.keys(TEXTS))next[k]=data.get(k);
    const tasks=exerciseOwner==='library'?state.library:currentSession().tasks;tasks[tasks.findIndex(a=>a.id===t.id)]=next;
    if(save('Ejercicio guardado.')){savedForm(form);$('#exercise-error').textContent='';refreshExercise();}
  } else if (form.id === 'analysis-form') {
    for (const k of ['own','rival']) for (const f of Object.keys(PHASES)) state.analysis[k][f] = data.get(`${k}-${f}`);
    if(save('Análisis guardado.'))savedForm(form);
  } else if (form.id === 'match-form') {
    const lineup = Array.from({length:11},(_,i) => data.get(`slot-${i}`));
    if (!unique(lineup)) { $('#match-error').textContent = 'Hay jugadores repetidos en el once. Cada posición debe tener un jugador distinto.'; $('#match-error').tabIndex = -1; $('#match-error').focus(); return; }
    const candidate=structuredClone(state),target=ui4.variantId?candidate.match.variants.find(v=>v.id===ui4.variantId):candidate.match;Object.assign(target,{formation:data.get('formation'),lineup});
    if(commitV4(candidate,'Plan de partido guardado.',form,false))$('#match-error').textContent='';else $('#match-error').textContent='No se confirma guardado: revisa particiones, disponibilidad de almacenamiento y avisos.';
  } else if(form.id==='board-form') {
    currentBoard().text=data.get('text');if(save('Consigna guardada.'))savedForm(form);
  } else if(form.id==='person-form') {
    if(photoBusy)return;
    const rival=form.dataset.kind==='rival';const collection=rival?state.rivals:state.players;const p=collection.find(p=>p.id===form.dataset.id);
    const next={...p,name:data.get('name').trim()};if(!next.name)return notify('Nombre no válido.',true);
    if(rival)Object.assign(next,{age:Number(data.get('age')),height:Number(data.get('height')),foot:data.get('foot'),description:data.get('description')});
    else {next.dorsal=Number(data.get('dorsal'));if(state.players.some(a=>a.id!==p.id&&a.dorsal===next.dorsal))return notify('Dorsal repetido.',true);}
    const file=$('#person-photo').files[0];
    if(file){if(!$('#photo-fictional').checked)return notify('Confirma que la imagen es ficticia, sin personas reales.',true);photoBusy=true;$('#photo-status').textContent='Validando imagen local…';try{next.photo=await readPhoto(file);}catch(error){$('#photo-status').textContent=error.message;notify('Foto rechazada. Se conserva la anterior.',true);photoBusy=false;return;}finally{photoBusy=false;}}
    collection[collection.indexOf(p)]=next;
    if(save('Ficha guardada.')){savedForm(form);if(!dirty){render();focusElement('#person-name');}else {$('#photo-status').textContent='Ficha guardada. Hay otro formulario pendiente.';const image=form.querySelector('.avatar');if(image)image.outerHTML=avatar(next);}}else $('#photo-status').textContent='Ficha y foto solo en memoria; exporta antes de cerrar.';
  }
});
document.addEventListener('input', event => {
  playback.stop();
  if(event.target.id==='v6-search'){libraryUi.query=event.target.value;$('#v6-results').innerHTML=libraryResults(state,libraryUi,selectedExerciseId);icons();return;}
  if(event.target.id==='v5-search'){for(const b of $$('.roster-desktop-list [data-action="v5-select-player"]'))b.hidden=!b.textContent.toLocaleLowerCase('es').includes(event.target.value.toLocaleLowerCase('es'));return;}
  if (event.target.matches('input')) event.target.setCustomValidity('');
  if(event.target.closest('form'))refreshDirty();
});
document.addEventListener('change', event => {
  playback.stop();
  const node = event.target;
  if(node.id==='v6-objective'){libraryUi.filter=node.value;$('#v6-results').innerHTML=libraryResults(state,libraryUi,selectedExerciseId);icons();return;}
  if(node.id==='v6-destination'){libraryUi.destination=node.value;return;}
  if(node.closest('form'))refreshDirty();
  const rosterFilters={'v5-player':'playerId','v5-mode':'mode','v5-cut':'cut','v5-days':'days','v5-filterSeason':'seasonId','v5-filterCompetition':'competitionId','v5-ruleVersion':'ruleId'};
  if(rosterFilters[node.id]){const key=rosterFilters[node.id];if(!node.reportValidity()||!canLeave()){node.value=String(rosterUi[key]);return;}if(key==='playerId'){selectRosterPlayer(node.value);return;}rosterUi[key]=key==='days'?Number(node.value):node.value;if(key==='seasonId'){rosterUi.competitionId='';rosterUi.ruleId='';rosterUi.sanctionId=null;}if(key==='competitionId'){rosterUi.ruleId='';rosterUi.sanctionId=null;}render();return;}
  if(node.id==='v5-recordId'){const record=state.records.find(r=>r.id===node.value);$('#v5-minutes').value=record?.matchMinutes??'';refreshDirty();return;}
  if(node.id==='v5-sessionId'){$('#v5-planSeasonId').value=state.sessions.find(t=>t.id===node.value)?.seasonId??'';refreshDirty();return;}
  if(['v4-mode','v4-reference','v4-variant','v4-frame'].includes(node.id)){
    playback.stop();if(!canLeave()){node.value=node.id==='v4-mode'?ui4.weekMode:node.id==='v4-variant'?ui4.variantId??'':node.id==='v4-frame'?String(ui4.frameIndex):state.referenceMatchId??'';return;}
    if(node.id==='v4-mode'){ui4.weekMode=node.value;render();return;}
    if(node.id==='v4-variant'){ui4.variantId=node.value||null;ui4.frameIndex=-1;render();return;}
    if(node.id==='v4-frame'){ui4.frameIndex=Number(node.value);selectedPieceId=null;render();return;}
    const candidate=structuredClone(state);candidate.referenceMatchId=node.value||null;commitV4(candidate,'Referencia manual guardada.');return;
  }
  if(node.id==='calendar-date'){if(!node.reportValidity())return;if(!canLeave()){node.value=state.activeDate;return;}selectDate(node.value);return;}
  if(node.id==='player-edit'){if(!canLeave()){node.value=selectedPlayerId;return;}selectedPlayerId=node.value;render();focusElement('#person-name');return;}
  if (node.matches('[data-task-field]')) {
    const t = currentSession()?.tasks.find(a => a.id === node.dataset.id); if (!t) return;
    if (!node.reportValidity()) { node.value = t[node.dataset.taskField]; notify('No se aplicó el cambio: la duración debe ser un entero entre 1 y 180 minutos.',true); return; }
    t[node.dataset.taskField] = node.dataset.taskField === 'duration' ? Number(node.value) : node.value;
    save();
    if (node.dataset.taskField === 'duration') {
      $('.minutes-total').innerHTML = `${minutes(currentSession())} <span>min</span>`;
      const dayLoad = $(`[data-date="${state.activeDate}"] .day-load`);
      if(dayLoad)dayLoad.textContent = `${state.sessions.filter(a => a.date === state.activeDate).reduce((n,a) => n+minutes(a),0)} min`;
      $(`[data-action="session"][data-id="${CSS.escape(currentSession().id)}"] small`).textContent = `${currentSession().tasks.length} tareas · ${minutes(currentSession())} min`;
    }
  }
  if (node.id === 'piece-select') { selectedPieceId = node.value; updatePiece(); }
  if(['piece-team','piece-role','arrow-movement','arrow-curve','arrow-dashed'].includes(node.id)){
    const p=currentPiece();if(!p)return;
    if(node.id==='piece-team')p.team=node.value;else if(node.id==='piece-role')p.role=node.value;else if(node.id==='arrow-movement')p.movement=node.value;else p[node.id==='arrow-curve'?'curve':'dashed']=node.checked;
    if(node.id==='arrow-curve')$('#board-inspector').dataset.selected='';updatePiece();save();return;
  }
  if (node.matches('[data-coordinate]')) {
    if (!node.reportValidity()) return;
    const p = currentPiece(); if (p) {
      const k=node.dataset.coordinate,v=Number(node.value),candidate={...p,[k]:v};
      if(itemKind(p)==='zone'&&(candidate.x+candidate.width>97||candidate.y+candidate.height>95)){node.value=p[k];notify('La zona debe quedar dentro del campo.',true);return;}
      p[k]=v;updatePiece();save();
    }
  }
  if (node.closest('#match-form') && (node.id === 'formation' || node.name.startsWith('slot-'))) {
    const data = new FormData($('#match-form')); $('#formation-preview').innerHTML = miniPitch(data.get('formation'),Array.from({length:11},(_,i) => data.get(`slot-${i}`)));
  }
});
document.addEventListener('keydown', event => {
  if(!event.target.closest('[data-action="v4-play"]'))playback.stop();
  const tab = event.target.closest('[data-tab]');
  if (tab && ['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) {
    event.preventDefault(); const tabs = $$('[data-tab]'); const i = tabs.indexOf(tab);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length-1 : (i+(event.key === 'ArrowRight' ? 1 : -1)+tabs.length)%tabs.length;
    if (changeView(tabs[next].dataset.tab)) tabs[next].focus(); return;
  }
  const piece = event.target.closest('[data-piece]');
  if (piece) {
    const moves = { ArrowLeft:[-2,0], ArrowRight:[2,0], ArrowUp:[0,-2], ArrowDown:[0,2] };
    if (moves[event.key]) { event.preventDefault(); selectedPieceId = piece.dataset.piece; movePiece(...moves[event.key]); }
  if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); selectedPieceId = piece.dataset.piece; updatePiece(); }
  }
});
document.addEventListener('pointerdown', event => {
  const piece = event.target.closest('[data-piece]'); if (!piece || event.button !== 0) return;
  playback.stop();
  selectedPieceId = piece.dataset.piece; updatePiece();
  const svg = $('#pitch'); svg.setPointerCapture(event.pointerId); drag = { id:event.pointerId, svg }; piece.focus(); event.preventDefault();
});
document.addEventListener('pointermove', event => {
  if (!drag || drag.id !== event.pointerId) return;
  const point = new DOMPoint(event.clientX,event.clientY).matrixTransform(drag.svg.getScreenCTM().inverse());
  const p = currentPiece(); if (!p) return;
  p.x = clamp(Math.round(point.x/9),3,97-(p.width??0)); p.y = clamp(Math.round(point.y/5.8),5,95-(p.height??0)); updatePiece();
});
function endDrag(event) {
  if (drag && drag.id === event.pointerId) { drag = null; save(); }
}
document.addEventListener('pointerup',endDrag);
document.addEventListener('pointercancel',endDrag);
document.addEventListener('focusin', event => { const p = event.target.closest('[data-piece]'); if (p) { selectedPieceId = p.dataset.piece; updatePiece(); } });
window.addEventListener('beforeunload', event => { if (dirty) { event.preventDefault(); event.returnValue = ''; } });
window.addEventListener('beforeprint',()=>playback.stop());
window.addEventListener('storage', event => {
  if (!store.affected(event.key)) return;
  playback.stop();store.conflict();syncStore();
  storageUI();
});
for (const dialog of $$('dialog')) {dialog.addEventListener('close', () => { if (dialogTrigger?.isConnected) dialogTrigger.focus(); });dialog.addEventListener('cancel',event=>{if(!canLeave())event.preventDefault();});}
render();
document.addEventListener('visibilitychange',()=>{if(document.hidden)playback.stop();});
document.addEventListener('focusin',event=>{if(event.target.matches('input,select,textarea'))playback.stop();});
motion.addEventListener('change',()=>{playback.stop();const button=$('[data-action="v4-play"]');if(button)button.disabled=motion.matches||!currentBoardRoot()?.frames.length;});
if (!storageBlocked && needsInitialSave) {save();if(!storageBlocked && Object.values(migrationSources).some(raw=>raw!==null)){storageMessage='Migración a v6: fuentes anteriores intactas; objetivos sin clasificar. Semana original v1 conservada cuando aplica.';storageUI();}}
