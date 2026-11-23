const KEY = 'terreno.demo.v1';
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
const minutes = session => session.tasks.reduce((sum, task) => sum + task.duration, 0);
const textValid = (v, max, min = 0) => typeof v === 'string' && v.length >= min && v.length <= max;
const unique = list => new Set(list).size === list.length;
const taskFrom = id => { const task = LIBRARY.find(t => t.id === id); return { id: uid(), libraryId: id, title: task.title, duration: task.duration, objective: task.objective }; };
const defaultBoard = () => ({ pieces: [
  ...FORMATIONS['4-3-3'].map(([x,y], i) => ({ id: uid(), kind: 'player', label: String(i + 1), x, y })),
  ...[[46,16],[58,16],[46,83],[58,83]].map(([x,y], i) => ({ id: uid(), kind: 'cone', label: `C${i + 1}`, x, y })),
] });
function seed() {
  const first = { id: uid(), day: 0, title: 'Conectar y progresar', objective: 'Encontrar al tercer jugador y progresar con amplitud.', tasks: ['rondo', 'possession', 'transition'].map(taskFrom), board: defaultBoard() };
  return { schemaVersion: 1, updatedAt: new Date().toISOString(), activeDay: 0, selectedSessionId: first.id, sessions: [first,
    { id: uid(), day: 2, title: 'Transiciones y finalización', objective: 'Dar continuidad al ataque tras recuperar.', tasks: ['transition', 'finish'].map(taskFrom), board: defaultBoard() },
    { id: uid(), day: 4, title: 'Ajustes del plan de partido', objective: 'Coordinar la estrategia y las distancias entre líneas.', tasks: ['setpiece', 'game'].map(taskFrom), board: defaultBoard() }],
    analysis: { own: { strengths: 'Amplitud en la salida y apoyos cercanos al poseedor.', weaknesses: 'Distancias largas después de perder el balón.', notes: 'Mantener un apoyo por detrás de la jugada.' }, rival: { strengths: 'Presión alta y llegada por fuera.', weaknesses: 'Espacio a la espalda de la primera línea.', notes: 'Alternar el pase corto con la salida al lado débil.' } },
    match: { formation: '4-3-3', lineup: PLAYERS.slice(0, 11).map(p => p.id), attacking: 'Abrir el campo y buscar al tercer jugador.', defending: 'Cerrar el carril central y bascular juntos.', setPieces: 'Primer movimiento al primer palo; llegada al segundo.' },
  };
}
function validate(s) {
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
function clean(s) {
  return { schemaVersion: 1, updatedAt: s.updatedAt, activeDay: s.activeDay, selectedSessionId: s.selectedSessionId,
    sessions: s.sessions.map(t => ({ id: t.id, day: t.day, title: t.title, objective: t.objective,
      tasks: t.tasks.map(a => ({ id:a.id, libraryId:a.libraryId, title:a.title, duration:a.duration, objective:a.objective })),
      board: { pieces: t.board.pieces.map(p => ({ id:p.id, kind:p.kind, label:p.label, x:p.x, y:p.y })) } })),
    analysis: Object.fromEntries(['own','rival'].map(k => [k, Object.fromEntries(['strengths','weaknesses','notes'].map(f => [f,s.analysis[k][f]]))])),
    match: { formation:s.match.formation, lineup:[...s.match.lineup], attacking:s.match.attacking, defending:s.match.defending, setPieces:s.match.setPieces } };
}
let storageBlocked = false;
let storageMessage = '';
function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return seed();
    const parsed = JSON.parse(raw);
    if (!validate(parsed)) throw new Error('Esquema no válido');
    return clean(parsed);
  } catch {
    storageBlocked = true;
    storageMessage = 'No se pudo recuperar el guardado local. Demo en memoria, sin sobrescribir el contenido anterior. Puedes exportar los cambios o restablecer la demo.';
    return seed();
  }
}
let state = load();
let view = 'week';
let dirty = false;
let selectedPieceId = null;
let drag = null;
let noticeTimer;
let dialogTrigger;
const currentSession = () => state.sessions.find(s => s.id === state.selectedSessionId);
const currentPiece = () => currentSession()?.board.pieces.find(p => p.id === selectedPieceId);
function icons() { window.lucide?.createIcons({ attrs: { 'aria-hidden': 'true' } }); }
function notify(message, error = false) {
  const node = $('#notice'); node.textContent = message; node.classList.toggle('error', error); node.hidden = false;
  clearTimeout(noticeTimer); noticeTimer = setTimeout(() => { node.hidden = true; }, 4500);
}
function storageUI() {
  $('#storage-warning').hidden = !storageMessage;
  $('#storage-warning').textContent = storageMessage;
  $('#save-status').textContent = storageBlocked ? 'Sin guardar · solo en memoria' : `Guardado local · ${new Date(state.updatedAt).toLocaleTimeString('es-ES', { hour:'2-digit', minute:'2-digit' })}`;
}
function save(message) {
  if (!validate(state)) { notify('No se guardó: datos no válidos.', true); return false; }
  state.updatedAt = new Date().toISOString();
  if (!storageBlocked) {
    try { localStorage.setItem(KEY, JSON.stringify(clean(state))); }
    catch { storageBlocked = true; storageMessage = 'El navegador no permite guardar los cambios. Se conservan solo en esta pestaña; exporta JSON antes de cerrarla. Restablecer no soluciona un bloqueo del navegador.'; }
  }
  storageUI();
  if (message) notify(storageBlocked ? `${message} Solo en memoria; no guardado local.` : message, storageBlocked);
  return !storageBlocked;
}
function canLeave() {
  if (!dirty) return true;
  if (!window.confirm('Hay cambios de formulario sin guardar. ¿Descartarlos y continuar?')) return false;
  dirty = false; return true;
}
function focusElement(selector) { requestAnimationFrame(() => $(selector)?.focus()); }
function changeView(next, focus = false) {
  if (!canLeave()) return false;
  view = next; selectedPieceId = null; render();
  if (focus) focusElement('#view-panel h1');
  return true;
}
function heading(title, subtitle, actions = '') {
  return `<div class="view-heading"><div><p class="eyebrow">Microciclo 01 · 23—29 nov 2026</p><h1 tabindex="-1">${title}</h1><p>${subtitle}</p></div>${actions ? `<div class="heading-actions">${actions}</div>` : ''}</div>`;
}
function render() {
  document.body.dataset.view = view;
  $$('[data-tab]').forEach(tab => { const active = tab.dataset.tab === view; tab.setAttribute('aria-selected', String(active)); tab.tabIndex = active ? 0 : -1; });
  $('#view-panel').setAttribute('aria-labelledby', `tab-${view}`);
  $('#view-panel').innerHTML = ({ week: renderWeek, board: renderBoard, analysis: renderAnalysis, match: renderMatch, summary: renderSummary })[view]();
  dirty = false; icons(); storageUI();
}
function renderWeek() {
  const s = currentSession();
  const daySessions = state.sessions.filter(t => t.day === state.activeDay);
  return heading('Semana de trabajo', 'Equipo demo · Preparación colectiva', `<button class="primary" data-action="new-session">${icon('plus')}Nueva sesión</button>`) +
    `<div class="week-strip" aria-label="Días del microciclo">${DAYS.map((day,i) => { const sessions = state.sessions.filter(t => t.day === i); return `<button class="day" data-action="day" data-day="${i}" aria-label="${day} ${23+i}, ${sessions.length} sesiones" aria-pressed="${state.activeDay === i}"><span class="day-name">${SHORT[i]}</span><span class="day-number">${23+i}</span><span class="day-load">${sessions.length ? `${sessions.reduce((sum,t) => sum+minutes(t),0)} min` : 'Libre'}</span></button>`; }).join('')}</div>` +
    `<div class="week-layout"><aside class="session-sidebar"><div class="section-heading"><h2>${DAYS[state.activeDay]}</h2><span class="count">${daySessions.length} ses.</span></div><div class="session-choices">${daySessions.length ? daySessions.map(t => `<button class="session-choice" data-action="session" data-id="${esc(t.id)}" aria-pressed="${s?.id === t.id}"><strong>${esc(t.title)}</strong><small>${t.tasks.length} tareas · ${minutes(t)} min</small></button>`).join('') : '<p class="sidebar-empty">Sin sesiones programadas.</p>'}</div><button class="text-button sidebar-add" data-action="new-session">${icon('plus')}Añadir sesión</button></aside><section class="session-workspace">${s ? sessionEditor(s) : `<div class="empty-state">${icon('calendar-plus')}<h2>Un día por preparar</h2><p>${DAYS[state.activeDay]}, ${23+state.activeDay} de noviembre</p><button class="primary" data-action="new-session">${icon('plus')}Crear sesión</button></div>`}</section></div>`;
}
function sessionEditor(s) {
  return `<form id="session-edit" class="session-form"><div><label for="session-title">Sesión</label><input id="session-title" name="title" value="${esc(s.title)}" maxlength="80" required></div><div class="minutes-total">${minutes(s)} <span>min</span></div><div class="objective-field"><label for="session-objective">Objetivo colectivo</label><textarea id="session-objective" name="objective" maxlength="500" rows="2">${esc(s.objective)}</textarea></div><div class="form-actions"><button type="button" class="text-button danger" data-action="delete-session">${icon('trash-2')}Eliminar sesión</button><button class="secondary" type="submit">${icon('check')}Guardar sesión</button></div></form><div class="section-heading"><h2>Tareas <span class="count">/ ${s.tasks.length}</span></h2><button class="secondary" data-action="library">${icon('plus')}Añadir tarea</button></div>${s.tasks.length ? `<ol class="task-list">${s.tasks.map((t,i) => `<li class="task-item" data-task="${esc(t.id)}"><span class="task-number">${String(i+1).padStart(2,'0')}</span><div class="task-main"><h3>${esc(t.title)}</h3><small>${esc(LIBRARY.find(l => l.id === t.libraryId).category)}</small><label for="objective-${t.id}">Objetivo de la tarea</label><textarea id="objective-${t.id}" class="task-objective" data-task-field="objective" data-id="${t.id}" maxlength="500" rows="2">${esc(t.objective)}</textarea></div><div class="duration-field"><label for="duration-${t.id}">Minutos</label><input id="duration-${t.id}" type="number" min="1" max="180" step="1" value="${t.duration}" data-task-field="duration" data-id="${t.id}"></div><button class="icon-button danger" data-action="delete-task" data-id="${t.id}" title="Eliminar ${esc(t.title)}" aria-label="Eliminar ${esc(t.title)}">${icon('trash-2')}</button></li>`).join('')}</ol>` : '<div class="empty-state"><h3>Sesión sin tareas</h3><button class="secondary" data-action="library">Abrir biblioteca</button></div>'}`;
}
function pitchLines() {
  return `<rect width="900" height="580" fill="#287b53"/>${[0,2,4,6,8].map(i => `<rect x="${i*100}" y="0" width="100" height="580" fill="#ffffff" opacity=".025"/>`).join('')}<g class="pitch-lines" stroke="#e3f0e6" stroke-width="2" fill="none"><rect x="30" y="30" width="840" height="520"/><path d="M450 30V550"/><circle cx="450" cy="290" r="72"/><circle cx="450" cy="290" r="3" fill="#e3f0e6"/><path d="M30 150H165V430H30 M870 150H735V430H870 M30 230H78V350H30 M870 230H822V350H870"/><path d="M165 230Q210 290 165 350 M735 230Q690 290 735 350"/><circle cx="122" cy="290" r="3" fill="#e3f0e6"/><circle cx="778" cy="290" r="3" fill="#e3f0e6"/><path d="M15 258H30 M15 258V322H30 M885 258H870 M885 258V322H870"/></g>`;
}
function pieceSVG(p) {
  const label = p.kind === 'player' ? `Jugador ${p.label}` : `Cono ${p.label}`;
  return `<g class="piece${selectedPieceId === p.id ? ' is-selected' : ''}" data-piece="${esc(p.id)}" transform="translate(${p.x*9},${p.y*5.8})" tabindex="0" role="button" aria-label="${esc(label)}, X ${Math.round(p.x)}, Y ${Math.round(p.y)}" aria-pressed="${selectedPieceId === p.id}"><circle class="hit-area" r="34" fill="transparent"/><circle class="selection-ring" r="23"/>${p.kind === 'player' ? `<circle r="18" fill="#fff" stroke="#173f2d" stroke-width="2"/><text text-anchor="middle" dominant-baseline="central" font-size="15" fill="#173f2d">${esc(p.label)}</text>` : '<path d="M0 -16L16 14H-16Z" fill="#f18b6d" stroke="#ffe3d8" stroke-width="2"/><path d="M-10 4H10" stroke="#fff" stroke-width="3"/>'}</g>`;
}
function renderBoard() {
  const s = currentSession();
  if (!s) return heading('Pizarra', 'Sin sesión seleccionada') + '<div class="empty-state"><h2>Selecciona una sesión</h2><button class="primary" data-action="goto-week">Ir a Semana</button></div>';
  if (!s.board.pieces.some(p => p.id === selectedPieceId)) selectedPieceId = s.board.pieces[0]?.id ?? null;
  const p = currentPiece();
  return heading('Pizarra de la sesión', `${DAYS[s.day]} · ${esc(s.title)}`, `<button class="secondary" data-action="goto-week">${icon('arrow-left')}Sesión</button>`) + `<div class="board-layout"><section><svg id="pitch" class="pitch" viewBox="0 0 900 580" role="group" aria-label="Campo de fútbol, pizarra de la sesión">${pitchLines()}<g id="pieces">${s.board.pieces.map(pieceSVG).join('')}</g></svg><div class="board-bottom"><p>${s.board.pieces.filter(p => p.kind === 'player').length} jugadores · ${s.board.pieces.filter(p => p.kind === 'cone').length} conos</p><button class="text-button" data-action="reset-board">${icon('rotate-ccw')}Restablecer pizarra</button></div></section><aside class="board-inspector"><h2>Disposición</h2><label for="piece-select">Pieza seleccionada</label><select id="piece-select" ${!p ? 'disabled' : ''}>${s.board.pieces.map(a => `<option value="${a.id}" ${a.id === selectedPieceId ? 'selected' : ''}>${a.kind === 'player' ? 'Jugador' : 'Cono'} ${esc(a.label)}</option>`).join('')}</select><div class="inspector-row"><div><label for="piece-x">Posición X (%)</label><input id="piece-x" type="number" min="3" max="97" step="1" value="${p ? Math.round(p.x) : ''}" ${!p ? 'disabled' : ''}></div><div><label for="piece-y">Posición Y (%)</label><input id="piece-y" type="number" min="5" max="95" step="1" value="${p ? Math.round(p.y) : ''}" ${!p ? 'disabled' : ''}></div></div><div class="direction-controls" aria-label="Mover pieza"><button class="up" data-action="move" data-dx="0" data-dy="-2" aria-label="Mover arriba" title="Mover arriba" ${!p ? 'disabled' : ''}>${icon('arrow-up')}</button><button class="left" data-action="move" data-dx="-2" data-dy="0" aria-label="Mover izquierda" title="Mover izquierda" ${!p ? 'disabled' : ''}>${icon('arrow-left')}</button><button class="down" data-action="move" data-dx="0" data-dy="2" aria-label="Mover abajo" title="Mover abajo" ${!p ? 'disabled' : ''}>${icon('arrow-down')}</button><button class="right" data-action="move" data-dx="2" data-dy="0" aria-label="Mover derecha" title="Mover derecha" ${!p ? 'disabled' : ''}>${icon('arrow-right')}</button></div><button class="secondary" data-action="add-player">${icon('user-plus')}Añadir jugador</button><button class="secondary" data-action="add-cone">${icon('triangle')}Añadir cono</button><button class="text-button danger" data-action="delete-piece" ${!p ? 'disabled' : ''}>${icon('trash-2')}Eliminar pieza</button></aside></div>`;
}
function renderAnalysis() {
  return heading('Lectura del juego', 'Análisis propio y del rival') + `<form id="analysis-form"><div class="analysis-grid">${[['own','Equipo propio'],['rival','Rival de demo']].map(([k,title]) => `<section class="analysis-column"><h2>${title}</h2>${[['strengths','Fortalezas'],['weaknesses','Debilidades'],['notes','Notas de preparación']].map(([f,label]) => `<label for="${k}-${f}">${label}</label><textarea id="${k}-${f}" name="${k}-${f}" maxlength="3000" rows="3">${esc(state.analysis[k][f])}</textarea>`).join('')}</section>`).join('')}</div><div class="form-footer"><button class="primary" type="submit">${icon('check')}Guardar análisis</button></div></form>`;
}
function miniPitch(formation, lineup) {
  return `<svg class="mini-pitch" viewBox="0 0 900 580" role="img" aria-label="Alineación ${formation}">${pitchLines()}${FORMATIONS[formation].map(([x,y],i) => `<g transform="translate(${x*9},${y*5.8})"><circle r="19" fill="#fff"/><text text-anchor="middle" dominant-baseline="central" fill="#173f2d" font-size="16" font-family="Arial" font-weight="700">${esc(lineup[i]?.slice(1) ?? i+1)}</text></g>`).join('')}</svg>`;
}
function renderMatch() {
  return heading('Plan de partido', 'Partido de demo · Domingo 29 · 12:00') + `<form id="match-form"><div class="match-layout"><section class="match-lineup"><div class="formation-row"><label for="formation">Formación</label><select id="formation" name="formation">${Object.keys(FORMATIONS).map(f => `<option ${state.match.formation === f ? 'selected' : ''}>${f}</option>`).join('')}</select></div><div id="formation-preview">${miniPitch(state.match.formation,state.match.lineup)}</div><h2>Once inicial</h2><div class="lineup-list">${state.match.lineup.map((id,i) => `<div class="lineup-slot"><label for="slot-${i}">${i === 0 ? 'POR' : String(i+1).padStart(2,'0')}</label><select id="slot-${i}" name="slot-${i}" aria-label="${i === 0 ? 'Portero' : `Posición ${i+1}`}">${PLAYERS.map(p => `<option value="${p.id}" ${p.id === id ? 'selected' : ''}>${p.name}</option>`).join('')}</select></div>`).join('')}</div></section><section class="match-consignes"><h2>Consignas colectivas</h2>${[['attacking','Con balón'],['defending','Sin balón'],['setPieces','Balón parado']].map(([k,label]) => `<label for="match-${k}">${label}</label><textarea id="match-${k}" name="${k}" rows="4" maxlength="3000">${esc(state.match[k])}</textarea>`).join('')}</section></div><div class="form-footer"><p id="match-error" class="form-error" role="alert"></p><button class="primary" type="submit">${icon('check')}Guardar partido</button></div></form>`;
}
function summaryText(label,value) { return `<p class="summary-label">${label}</p><p>${value ? esc(value) : 'Sin completar'}</p>`; }
function renderSummary() {
  return heading('Resumen de preparación', 'Semana, análisis y plan de partido', `<button class="secondary" data-action="export">${icon('download')}JSON</button><button class="primary" data-action="print">${icon('printer')}Imprimir</button>`) + `<article id="print-summary"><div class="summary-top"><div><p class="eyebrow">Terreno · Demo local · Sin datos reales</p><h2>Equipo demo / Microciclo 01</h2></div><p>23—29 noviembre 2026<br>${state.sessions.length} sesiones · ${state.sessions.reduce((n,s) => n+minutes(s),0)} minutos</p></div><section class="summary-section"><h2>Semana de trabajo</h2>${DAYS.map((day,i) => { const sessions = state.sessions.filter(t => t.day === i); return sessions.map(s => `<div class="summary-session"><h3>${day} ${23+i} · ${esc(s.title)} · ${minutes(s)} min</h3><p>${esc(s.objective)}</p><ul>${s.tasks.map(t => `<li><strong>${esc(t.title)} · ${t.duration} min</strong><br>${esc(t.objective)}</li>`).join('')}</ul></div>`).join(''); }).join('') || '<p>Sin sesiones.</p>'}</section><section class="summary-section"><h2>Análisis</h2><div class="summary-columns">${[['own','Equipo propio'],['rival','Rival de demo']].map(([k,title]) => `<div><h3>${title}</h3>${summaryText('Fortalezas',state.analysis[k].strengths)}${summaryText('Debilidades',state.analysis[k].weaknesses)}${summaryText('Notas',state.analysis[k].notes)}</div>`).join('')}</div></section><section class="summary-section"><h2>Plan de partido · ${state.match.formation}</h2><p class="summary-lineup">${state.match.lineup.map((id,i) => `${i+1}. ${PLAYERS.find(p => p.id === id).name}`).join(' · ')}</p><div class="summary-columns"><div>${summaryText('Con balón',state.match.attacking)}${summaryText('Sin balón',state.match.defending)}</div><div>${summaryText('Balón parado',state.match.setPieces)}</div></div></section></article>`;
}
function openDialog(id) { dialogTrigger = document.activeElement; $(id).showModal(); icons(); }
function closeDialog(node) { node.closest('dialog')?.close(); dialogTrigger?.isConnected && dialogTrigger.focus(); }
function exportData() {
  const discardDraft = dirty;
  if (!canLeave()) return;
  if (discardDraft) render();
  const payload = { product: 'Terreno', demo: true, exportedAt: new Date().toISOString(), state: clean(state) };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type:'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'terreno-demo-semana.json'; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500); notify('JSON preparado para descargar.');
}
function movePiece(dx,dy) {
  const p = currentPiece(); if (!p) return;
  p.x = clamp(p.x+dx,3,97); p.y = clamp(p.y+dy,5,95); updatePiece(); save();
}
function updatePiece() {
  const p = currentPiece(); if (!p) return;
  $$('[data-piece]').forEach(g => { g.classList.toggle('is-selected',g.dataset.piece === p.id); g.setAttribute('aria-pressed',String(g.dataset.piece === p.id)); });
  const g = $(`[data-piece="${CSS.escape(p.id)}"]`); if (g) { g.setAttribute('transform', `translate(${p.x*9},${p.y*5.8})`); g.setAttribute('aria-label', `${p.kind === 'player' ? 'Jugador' : 'Cono'} ${p.label}, X ${Math.round(p.x)}, Y ${Math.round(p.y)}`); }
  $('#piece-x').value = Math.round(p.x); $('#piece-y').value = Math.round(p.y); $('#piece-select').value = p.id;
}
document.addEventListener('click', event => {
  const tab = event.target.closest('[data-tab]');
  if (tab) { if (!changeView(tab.dataset.tab)) $(`#tab-${view}`).focus(); return; }
  const b = event.target.closest('[data-action]'); if (!b || b.disabled) return;
  const action = b.dataset.action;
  if (action === 'close-dialog') return closeDialog(b);
  if (action === 'export') return exportData();
  if (action === 'print') { if (changeView('summary')) window.print(); return; }
  if (action === 'goto-week') return changeView('week',true);
  if (action === 'day' || action === 'session') {
    if (!canLeave()) return;
    if (action === 'day') { state.activeDay = Number(b.dataset.day); state.selectedSessionId = state.sessions.find(t => t.day === state.activeDay)?.id ?? null; }
    else state.selectedSessionId = b.dataset.id;
    selectedPieceId = null; save(); render(); focusElement(action === 'day' ? `[data-day="${state.activeDay}"]` : `[data-action="session"][data-id="${CSS.escape(state.selectedSessionId)}"]`); return;
  }
  if (action === 'new-session') {
    if (state.sessions.length >= 50) return notify('Límite de demo: 50 sesiones.',true);
    if (!canLeave()) return;
    $('#new-session-form').reset(); $('#new-session-day').textContent = `${DAYS[state.activeDay]}, ${23+state.activeDay} de noviembre`;
    openDialog('#session-dialog'); $('#new-title').focus(); return;
  }
  if (action === 'library') {
    if (!currentSession()) return;
    $('#library-items').innerHTML = LIBRARY.map(t => `<section class="library-task"><div><h3>${t.title}</h3><p>${t.category} · ${t.duration} min</p></div><button class="secondary" data-action="add-task" data-library="${t.id}" aria-label="Añadir ${t.title}">${icon('plus')}Añadir</button></section>`).join('');
    openDialog('#library-dialog'); return;
  }
  if (action === 'add-task') {
    const s = currentSession(); if (!s || s.tasks.length >= 30) return notify('Límite de demo: 30 tareas por sesión.',true);
    if (!canLeave()) return;
    s.tasks.push(taskFrom(b.dataset.library)); $('#library-dialog').close(); save('Tarea añadida.'); render(); focusElement('[data-action="library"]'); return;
  }
  if (action === 'delete-session') {
    if (!window.confirm('¿Eliminar esta sesión y sus tareas y pizarra?')) return;
    const id = state.selectedSessionId; state.sessions = state.sessions.filter(s => s.id !== id); state.selectedSessionId = state.sessions.find(t => t.day === state.activeDay)?.id ?? null; dirty = false;
    save('Sesión eliminada.'); render(); focusElement('[data-action="new-session"]'); return;
  }
  if (action === 'delete-task') {
    if (!window.confirm('¿Eliminar esta tarea de la sesión?')) return;
    if (!canLeave()) return;
    currentSession().tasks = currentSession().tasks.filter(t => t.id !== b.dataset.id); save('Tarea eliminada.'); render(); focusElement('[data-action="library"]'); return;
  }
  if (action === 'reset') {
    if (!window.confirm('¿Restablecer todos los datos de esta demo? Se perderán los cambios guardados y de formulario.')) return;
    state = seed(); storageBlocked = false; storageMessage = ''; dirty = false; view = 'week'; selectedPieceId = null;
    save('Demo restablecida.'); render(); focusElement('#tab-week'); return;
  }
  if (action === 'move') return movePiece(Number(b.dataset.dx),Number(b.dataset.dy));
  if (action === 'add-player' || action === 'add-cone') {
    const s = currentSession(); if (!s || s.board.pieces.length >= 40) return notify('Límite de demo: 40 piezas.',true);
    const kind = action === 'add-player' ? 'player' : 'cone';
    const labels = s.board.pieces.filter(p => p.kind === kind).map(p => p.label);
    let n = 1; while (labels.includes(kind === 'player' ? String(n) : `C${n}`)) n++;
    const p = { id:uid(), kind, label:kind === 'player' ? String(n) : `C${n}`, x:50,y:50 };
    s.board.pieces.push(p); selectedPieceId = p.id; save('Pieza añadida.'); render(); focusElement('#piece-select'); return;
  }
  if (action === 'delete-piece') {
    if (!window.confirm('¿Eliminar la pieza seleccionada?')) return;
    currentSession().board.pieces = currentSession().board.pieces.filter(p => p.id !== selectedPieceId); selectedPieceId = null; save('Pieza eliminada.'); render(); focusElement('#piece-select'); return;
  }
  if (action === 'reset-board') {
    if (!window.confirm('¿Restablecer la pizarra de esta sesión?')) return;
    currentSession().board = defaultBoard(); selectedPieceId = null; save('Pizarra restablecida.'); render(); focusElement('#piece-select');
  }
});
document.addEventListener('submit', event => {
  event.preventDefault(); const form = event.target;
  if (!form.reportValidity()) return;
  const data = new FormData(form);
  if (form.id === 'new-session-form') {
    const title = data.get('title').trim(); if (!title) { $('#new-title').setCustomValidity('Escribe un nombre de sesión.'); $('#new-title').reportValidity(); return; }
    const s = { id:uid(), day:state.activeDay, title, objective:data.get('objective').trim(), tasks:[], board:defaultBoard() };
    state.sessions.push(s); state.selectedSessionId = s.id; $('#session-dialog').close(); view = 'week'; save('Sesión creada.'); render(); focusElement('#session-title');
  } else if (form.id === 'session-edit') {
    const title = data.get('title').trim(); if (!title) { $('#session-title').setCustomValidity('Escribe un nombre de sesión.'); $('#session-title').reportValidity(); return; }
    currentSession().title = title; currentSession().objective = data.get('objective').trim(); dirty = false;
    save('Sesión guardada.'); render(); focusElement('#session-title');
  } else if (form.id === 'analysis-form') {
    for (const k of ['own','rival']) for (const f of ['strengths','weaknesses','notes']) state.analysis[k][f] = data.get(`${k}-${f}`).trim();
    dirty = false; save('Análisis guardado.');
  } else if (form.id === 'match-form') {
    const lineup = Array.from({length:11},(_,i) => data.get(`slot-${i}`));
    if (!unique(lineup)) { $('#match-error').textContent = 'Hay jugadores repetidos en el once. Cada posición debe tener un jugador distinto.'; $('#match-error').tabIndex = -1; $('#match-error').focus(); return; }
    state.match = { formation:data.get('formation'), lineup, attacking:data.get('attacking').trim(), defending:data.get('defending').trim(), setPieces:data.get('setPieces').trim() };
    $('#match-error').textContent = ''; dirty = false; save('Plan de partido guardado.');
  }
});
document.addEventListener('input', event => {
  if (event.target.matches('input')) event.target.setCustomValidity('');
  if (event.target.closest('#session-edit,#analysis-form,#match-form')) dirty = true;
});
document.addEventListener('change', event => {
  const node = event.target;
  if (node.matches('[data-task-field]')) {
    const t = currentSession()?.tasks.find(a => a.id === node.dataset.id); if (!t) return;
    if (!node.reportValidity()) { node.value = t[node.dataset.taskField]; notify('No se aplicó el cambio: la duración debe ser un entero entre 1 y 180 minutos.',true); return; }
    t[node.dataset.taskField] = node.dataset.taskField === 'duration' ? Number(node.value) : node.value;
    save();
    if (node.dataset.taskField === 'duration') {
      $('.minutes-total').innerHTML = `${minutes(currentSession())} <span>min</span>`;
      const dayLoad = $(`[data-day="${state.activeDay}"] .day-load`);
      dayLoad.textContent = `${state.sessions.filter(a => a.day === state.activeDay).reduce((n,a) => n+minutes(a),0)} min`;
      $(`[data-action="session"][data-id="${CSS.escape(currentSession().id)}"] small`).textContent = `${currentSession().tasks.length} tareas · ${minutes(currentSession())} min`;
    }
  }
  if (node.id === 'piece-select') { selectedPieceId = node.value; updatePiece(); }
  if (node.id === 'piece-x' || node.id === 'piece-y') {
    if (!node.reportValidity()) return;
    const p = currentPiece(); if (p) { p[node.id === 'piece-x' ? 'x':'y'] = Number(node.value); updatePiece(); save(); }
  }
  if (node.closest('#match-form') && (node.id === 'formation' || node.name.startsWith('slot-'))) {
    const data = new FormData($('#match-form')); $('#formation-preview').innerHTML = miniPitch(data.get('formation'),Array.from({length:11},(_,i) => data.get(`slot-${i}`))); dirty = true;
  }
});
document.addEventListener('keydown', event => {
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
  selectedPieceId = piece.dataset.piece; updatePiece();
  const svg = $('#pitch'); svg.setPointerCapture(event.pointerId); drag = { id:event.pointerId, svg }; piece.focus(); event.preventDefault();
});
document.addEventListener('pointermove', event => {
  if (!drag || drag.id !== event.pointerId) return;
  const point = new DOMPoint(event.clientX,event.clientY).matrixTransform(drag.svg.getScreenCTM().inverse());
  const p = currentPiece(); if (!p) return;
  p.x = clamp(Math.round(point.x/9),3,97); p.y = clamp(Math.round(point.y/5.8),5,95); updatePiece();
});
function endDrag(event) {
  if (drag && drag.id === event.pointerId) { drag = null; save(); }
}
document.addEventListener('pointerup',endDrag);
document.addEventListener('pointercancel',endDrag);
document.addEventListener('focusin', event => { const p = event.target.closest('[data-piece]'); if (p) { selectedPieceId = p.dataset.piece; updatePiece(); } });
window.addEventListener('beforeunload', event => { if (dirty) { event.preventDefault(); event.returnValue = ''; } });
window.addEventListener('storage', event => {
  if (event.key !== KEY) return;
  storageBlocked = true;
  storageMessage = 'Otra pestaña ha cambiado la demo. Esta pestaña conserva su versión solo en memoria y no sobrescribirá la nueva. Exporta esta versión o recarga para recuperar la guardada.';
  storageUI();
});
for (const dialog of $$('dialog')) dialog.addEventListener('close', () => { if (dialogTrigger?.isConnected) dialogTrigger.focus(); });
render();
if (!storageBlocked) save();
