import {PHASES, BOARDS} from './model.mjs';
import {NUMBERS, TEXTS} from './model-v3.mjs';
import {LOADS, MOVEMENTS} from './model-v4.mjs';
import {AVAILABILITY, NUTRITION_TYPES} from './model-v5.mjs';
import {OBJECTIVES} from './model-v6.mjs';
import {TEAMS} from './model-v7.mjs';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
const present = value => value !== null && value !== undefined && (typeof value !== 'string' || value.trim() !== '');
const number = value => new Intl.NumberFormat('es-ES', {maximumFractionDigits:2}).format(value);
const foot = value => ({right:'Derecha', left:'Izquierda', both:'Ambas'})[value];
const prose = (label, value) => present(value) ? `<div class="v8p-text"><h4>${esc(label)}</h4><p>${esc(value)}</p></div>` : '';
const facts = entries => {
  const rows = entries.filter(([,value]) => present(value));
  return rows.length ? `<dl class="v8p-facts">${rows.map(([label,value]) => `<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl>` : '';
};
const known = value => typeof value === 'number' && Number.isFinite(value);
function duration(tasks) {
  const values = tasks.map(t => t.duration).filter(known);
  const total = values.reduce((a,b) => a+b, 0);
  const coverage = `${values.length}/${tasks.length} tareas con tiempo`;
  if (!tasks.length) return 'Sin tareas';
  if (!values.length) return `Tiempo pendiente · ${coverage}`;
  return `${number(total)} min${values.length !== tasks.length ? ' conocidos, total parcial' : ' en total'} · ${coverage}`;
}
const hasItems = board => ['pieces','arrows','zones'].some(key => board[key]?.length);
const hasBoard = board => board && (hasItems(board) || present(board.text) || board.frames?.length || board.versions?.length);
const selected = (list, id, label) => {
  const item = list.find(value => value.id === id);
  if (!item) throw new Error(`${label} no disponible en el snapshot de impresion`);
  return item;
};

function legend(board) {
  const labels = [
    ...(board.pieces ?? []).map(p => `${p.label} (${TEAMS[p.team] ?? p.team}${p.role === 'keeper' ? ', portero' : p.role === 'wildcard' ? ', comodin' : ''})`),
    ...(board.arrows ?? []).map((p,i) => `${i+1}: ${MOVEMENTS[p.movement] || 'Movimiento'}${p.curve ? ', curva' : ''}${p.dashed ? ', discontinua' : ''}`),
    ...(board.zones ?? []).map(p => p.label).filter(present),
  ];
  return labels.length ? `<p class="v8p-legend">${esc(labels.join(' · '))}</p>` : '';
}

function createBoards(renderBoard, renderLineup, warnings) {
  function figure(board, label, force = false, showLegend = true) {
    if (!board || (!force && !hasItems(board))) return '';
    const svg = renderBoard(board, {interactive:false, selectedId:null, label, print:true});
    if (typeof svg !== 'string' || !svg.trim()) throw new Error('El renderer del core no devolvio la pizarra');
    return `<figure class="v8p-figure"><figcaption>${esc(label)}</figcaption>${svg}</figure>${showLegend ? legend(board) : ''}`;
  }
  function sequence(board, label, {base = true, legacyText = true} = {}) {
    if (!hasBoard(board)) return '';
    let html = `${base ? figure(board,label) : ''}${legacyText ? prose('Notas de pizarra',board.text) : ''}`;
    for (const [i,frame] of (board.frames ?? []).entries()) {
      html += `<section class="v8p-board-step">${figure(frame.snapshot,`${label} · Fase ${i+1}: ${frame.title}`,true)}${prose('Notas de fase',frame.snapshot.text)}</section>`;
    }
    for (const version of board.versions ?? []) {
      html += `<section class="v8p-board-version"><h4>${esc(label)} · Version ${esc(version.title)}</h4>${figure(version.board,version.title,true)}${prose('Notas de version',version.board.text)}`;
      for (const [i,frame] of (version.board.frames ?? []).entries()) html += `<section class="v8p-board-step">${figure(frame.snapshot,`${version.title} · Fase ${i+1}: ${frame.title}`,true)}${prose('Notas de fase',frame.snapshot.text)}</section>`;
      html += '</section>';
    }
    if (board.fieldMode !== 'full' && hasItems(board)) {
      const width = board.fieldMode === 'half' ? 50 : 75;
      const outside = [...board.pieces,...board.arrows,...board.zones].some(p => p.x > width || p.x2 > width || p.cx > width || (p.width !== undefined && p.x+p.width > width));
      if (outside) warnings.push(`${label}: el encuadre guardado deja recursos fuera de vista; no se han borrado ni reescalado.`);
    }
    return html;
  }
  function lineup(formation, lineupSlots, players, label) {
    if (typeof renderLineup !== 'function') return '';
    const svg = renderLineup({formation,lineupSlots,players,label});
    if (typeof svg !== 'string' || !svg.trim()) throw new Error('El renderer del core no devolvio el once');
    return `<figure class="v8p-figure"><figcaption>${esc(label)}</figcaption>${svg}</figure>`;
  }
  return {figure, sequence, lineup};
}

function taskHTML(task, index, previous, boards) {
  const numeric = Object.entries(NUMBERS).filter(([key]) => task[key] !== null && task[key] !== undefined).map(([key,[label]]) => [label, `${number(task[key])}${key === 'length' || key === 'width' ? ' m' : key === 'workMinutes' ? ' min' : key === 'restSeconds' ? ' s' : ''}`]);
  const tagText = task.objectiveTags?.length ? task.objectiveTags.map(key => OBJECTIVES[key]).join(' · ') : '';
  const cumulative = duration(previous.concat(task));
  const metadataRows = [['Duracion',known(task.duration) ? `${number(task.duration)} min` : 'Pendiente'],...numeric,['Tipo',task.type]].filter(([,value]) => present(value));
  const metadata = facts(metadataRows);
  const detail = Object.entries(TEXTS).filter(([key]) => !['type','part','objective'].includes(key)).map(([key,[label]]) => prose(label,task[key])).join('');
  const tail = detail + prose('Carga prevista manual',task.plannedLoad ? LOADS[task.plannedLoad] : '') + prose('Objetivo fisico previsto',task.physicalObjective) + prose('Objetivo tactico previsto',task.tacticalObjective) + boards.sequence(task.board,task.title,{base:false});
  const textSize = Object.keys(TEXTS).filter(key => !['type','part'].includes(key)).reduce((n,key) => n + String(task[key] ?? '').length,0) + String(task.physicalObjective ?? '').length + String(task.tacticalObjective ?? '').length + String(task.board.text ?? '').length + tagText.length + legend(task.board).length;
  // Reflow brief copy into unused space beside the same-size board; never truncate it.
  const brief = hasItems(task.board) && metadataRows.length <= 4 && textSize <= 400 && !task.board.frames?.length && !task.board.versions?.length;
  const visual = hasItems(task.board) ? `<div class="v8p-task-visual">${boards.figure(task.board,'Pizarra de tarea',false,!brief)}</div>` : '';
  return `<section class="v8p-task${brief ? ' v8p-task-brief' : ''}" data-v8p-task="${esc(task.id)}"><div class="v8p-task-heading"><h3><span class="v8p-task-number">${index+1}</span>${esc(task.title)}</h3><p class="v8p-cumulative">Acumulado: ${esc(cumulative)}</p></div><div class="v8p-task-top${visual ? ' v8p-with-board' : ''}"><div>${metadata}${prose('Objetivo',task.objective)}${prose('Objetivos de trabajo',tagText)}${brief ? tail + legend(task.board) : ''}</div>${visual}</div>${brief ? '' : tail}</section>`;
}

function sessionHTML(state, request, boards) {
  const session = selected(state.sessions,request.sessionId,'Sesion');
  const people = session.called.map(id => state.players.find(p => p.id === id)).filter(Boolean);
  let html = facts([['Fecha',session.date],['Tiempo',duration(session.tasks)],['Convocados',people.length || null],['Temporada',state.seasons?.find(s => s.id === session.seasonId)?.name]]) + prose('Participantes convocados',people.map(p => `${p.dorsal}. ${p.name}`).join(' · ')) + prose('Objetivo de sesion',session.objective) + prose('Objetivo fisico previsto',session.physicalObjective) + prose('Objetivo tactico previsto',session.tacticalObjective) + prose('Carga prevista manual',session.plannedLoad ? LOADS[session.plannedLoad] : '');
  if (request.includeLegacy && session.intensity !== null) html += facts([['Intensidad prevista anterior',session.intensity]]);
  let start = 0;
  // Only contiguous phases are grouped: A/B/A must remain A/B/A.
  while (start < session.tasks.length) {
    const part = session.tasks[start].part;
    let end = start+1;
    while (end < session.tasks.length && session.tasks[end].part === part) end++;
    html += `<section class="v8p-phase"><h2>${esc(present(part) ? part : 'Tareas')} <span>${esc(duration(session.tasks.slice(start,end)))}</span></h2>${session.tasks.slice(start,end).map((task,j) => taskHTML(task,start+j,session.tasks.slice(0,start+j),boards)).join('')}</section>`;
    start = end;
  }
  if (!session.tasks.length) html += '<p class="v8p-status">Sesion sin tareas registradas.</p>';
  if (hasBoard(session.board)) html += `<section class="v8p-section"><h2>Pizarra general de sesion</h2>${boards.sequence(session.board,'Pizarra general de sesion')}</section>`;
  return {title:session.title,html};
}

function lineupHTML(slots, people) {
  return `<ol class="v8p-lineup">${slots.map((id,i) => {
    const player = id === null ? null : people.find(p => p.id === id);
    return `<li value="${i+1}" data-v8p-slot="${i+1}">${player ? `${present(player.dorsal) ? esc(player.dorsal)+'. ' : ''}${esc(player.name)}` : 'Sin asignar'}</li>`;
  }).join('')}</ol>`;
}

function profileHTML(player, extra, own) {
  const photo = typeof player.photo === 'string' && player.photo.startsWith('data:image/png;base64,') ? `<img class="v8p-photo" src="${esc(player.photo)}" width="64" height="64" alt="${esc(player.name)}">` : '';
  const career = own && extra?.career?.length ? `<h4>Trayectoria</h4><table class="v8p-table"><thead><tr><th>Club</th><th>Temporada</th><th>Categoria</th><th>Posiciones</th></tr></thead><tbody>${extra.career.map(row => `<tr>${[row.club,row.season,row.category,row.positions.join(', ')].map(v => `<td>${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table>` : '';
  const links = own && extra?.links?.length ? `<h4>Videos e informes</h4><ul class="v8p-links">${extra.links.map(link => `<li><a href="${esc(link.url)}" target="_blank" rel="noopener noreferrer">${esc(link.title || link.url)}</a><span>${esc(link.url)}</span></li>`).join('')}</ul>` : '';
  return `<section class="v8p-profile"><h3>${esc(player.name)}</h3>${photo}${facts([['Dorsal',own ? player.dorsal : extra?.dorsal],['Edad',own ? extra?.age : player.age],['Altura',present(own ? extra?.heightCm : player.height) ? `${own ? extra.heightCm : player.height} cm` : null],['Posicion',own ? player.position : extra?.position],['Pierna',foot(player.foot)],['Disponibilidad',own && player.availability ? AVAILABILITY[player.availability] : ''],['Fecha de disponibilidad',own ? player.availabilityDate : null]])}${prose('Caracteristicas',own ? extra?.characteristics : player.description)}${prose('Notas',extra?.notes)}${career}${links}</section>`;
}

function analysisHTML(state, request, boards) {
  const own = request.kind === 'analysis-own', side = own ? 'own' : 'rival';
  const savedRival = !own && request.rivalTeamId !== null ? selected(state.domainV8.rivalTeams,request.rivalTeamId,'Snapshot rival') : null;
  const title = own ? 'Analisis del equipo propio' : savedRival ? `Analisis rival · ${savedRival.name}` : 'Analisis del rival activo';
  const analysis = savedRival ? savedRival.analysis : state.analysis[side], v7 = state.analysisV7;
  const rivalPlayers = savedRival ? savedRival.players : state.rivals;
  const rivalProfiles = savedRival ? savedRival.rivalProfiles : state.domainV8.rivalProfiles;
  const players = own ? state.players : rivalPlayers.map(p => ({...p,dorsal:rivalProfiles.find(x => x.rivalId === p.id)?.dorsal}));
  const lineup = own ? state.match.lineup : savedRival ? savedRival.lineupSlots : state.domainV8.rivalLineupSlots;
  const formation = own ? state.match.formation : savedRival ? savedRival.formation : v7.rivalFormation;
  let html = facts([['Fecha de contexto',state.activeDate],['Formacion',formation]]) + `<section class="v8p-section"><h2>Once ${own ? 'propio' : 'rival'}</h2>${boards.lineup(formation,lineup,players,own ? 'Once propio' : 'Once rival')}${lineupHTML(lineup,players)}</section>`;
  if (!own) html += boards.sequence(savedRival ? savedRival.board : state.domainV8.rivalBoard,'Pizarra del rival');
  if (own && hasBoard(state.match.boards.buildup)) html += boards.sequence(state.match.boards.buildup,BOARDS.buildup);
  html += Object.entries(PHASES).map(([key,label]) => prose(label,analysis[key])).join('');
  html += prose('ABP ofensivo',savedRival ? savedRival.abpAttack : v7[side+'ABPAttack']) + prose('ABP defensivo',savedRival ? savedRival.abpDefend : v7[side+'ABPDefend']) + prose('Fortalezas',analysis.strengths) + prose('Debilidades',analysis.weaknesses) + prose('Notas',analysis.notes) + prose('Notas del equipo rival',savedRival?.notes);
  const problems = savedRival ? [] : state.problems.filter(p => p.side === side);
  for (const problem of problems) {
    const exercise = [...state.library,...state.sessions.flatMap(s => s.tasks)].find(t => t.id === problem.exerciseId);
    html += `<section class="v8p-section"><h3>${esc(PHASES[problem.phase])}</h3>${prose('Problema',problem.problem)}${prose('Respuesta individual',problem.individual)}${prose('Respuesta colectiva',problem.collective)}${prose('Mejora',problem.improvement)}${prose('Ejercicio vinculado',exercise?.title)}</section>`;
  }
  if (!own && rivalPlayers.length) html += `<section class="v8p-section"><h2>Fichas del rival${savedRival ? ' seleccionado' : ' activo'}</h2>${rivalPlayers.map(p => profileHTML(p,rivalProfiles.find(e => e.rivalId === p.id),false)).join('')}</section>`;
  return {title,html};
}

function matchHTML(state, request, boards) {
  const variantId = request.variantId;
  const match = variantId === null ? state.match : selected(state.match.variants,variantId,'Variante');
  const title = variantId === null ? 'Plan de partido' : `Plan de partido · ${match.title}`;
  let html = facts([['Fecha de contexto',state.activeDate],['Formacion',match.formation]]) + `<section class="v8p-section"><h2>Once inicial</h2>${boards.lineup(match.formation,match.lineup,state.players,'Once inicial')}${lineupHTML(match.lineup,state.players)}</section>`;
  for (const [key,label] of Object.entries(BOARDS)) {
    const extra = state.matchV8.legacyNotes.find(n => n.variantId === variantId && n.boardKey === key);
    const board = match.boards[key];
    if (hasBoard(board) || present(extra?.title) || present(extra?.notes)) html += `<section class="v8p-section v8p-match-board"><h2>${esc(extra?.title || label)}</h2>${boards.sequence(board,extra?.title || label,{legacyText:request.includeLegacy})}${prose('Notas de situacion',extra?.notes)}</section>`;
    for (const item of state.matchV8.boards.filter(b => b.variantId === variantId && b.groupKey === key)) html += `<section class="v8p-section v8p-match-board"><h2>${esc(item.title)}</h2>${prose('Grupo',label)}${boards.sequence(item.board,item.title)}${prose('Notas de situacion',item.notes)}</section>`;
  }
  const observation = state.matchV8.observations.find(o => o.variantId === variantId);
  html += prose('Observacion final',observation?.text);
  if (request.includeLegacy) {
    const names = ids => ids.map(id => state.players.find(p => p.id === id)?.name).filter(present).join(' · ');
    const legacy = prose('Banquillo',names(match.bench)) + prose('No convocados',names(match.notCalled)) + match.positionNotes.map((note,i) => prose(`Posicion ${i+1}`,note)).join('') + (variantId === null ? prose('Con balon',state.match.attacking) + prose('Sin balon',state.match.defending) + prose('Balon parado',state.match.setPieces) : '');
    if (legacy) html += `<section class="v8p-section v8p-legacy"><h2>Datos anteriores conservados</h2>${legacy}</section>`;
  }
  return {title,html};
}

function professionalHTML(state, playerId) {
  const plans = state.domainV8.professionalPlans.filter(p => p.playerId === playerId);
  let html = plans.map(plan => `<section class="v8p-section"><h3>Registro manual · ${plan.kind === 'nutrition' ? 'Nutricion' : 'Prevencion'}</h3>${facts([['Autor',plan.author],['Funcion declarada',plan.professionalFunction],['Desde',plan.validFrom],['Hasta',plan.validTo]])}${prose('Objetivo',plan.objective)}${prose('Contenido registrado',plan.content)}${prose('Notas',plan.notes)}${plan.evolution.map(e => `<section class="v8p-evolution"><h4>Evolucion · ${esc(e.date)}</h4>${facts([['Autor',e.author],['Funcion declarada',e.professionalFunction]])}${prose('Registro',e.notes)}</section>`).join('')}</section>`).join('');
  return html;
}

function playerHTML(state, request) {
  const own = state.players.find(p => p.id === request.playerId), rival = state.rivals.find(p => p.id === request.playerId);
  if (own && rival) throw new Error('Identificador de persona ambiguo; el core debe resolver el scope');
  const player = own || rival;
  if (!player) throw new Error('Jugador no disponible en el snapshot de impresion');
  const extra = own ? state.domainV8.ownProfiles.find(p => p.playerId === player.id) : state.domainV8.rivalProfiles.find(p => p.rivalId === player.id);
  let html = profileHTML(player,extra,Boolean(own));
  if (own && request.includeProfessional) {
    let records = professionalHTML(state,player.id);
    if (request.includeLegacy) {
      records += state.nutrition.filter(n => n.playerId === player.id).map(n => `<section class="v8p-section"><h3>Registro profesional anterior</h3>${facts([['Fecha',n.date],['Profesional declarado',n.professional],['Tipo',NUTRITION_TYPES[n.type]],['Estado',n.status],['Calidad registrada',n.quality]])}${prose('Contenido registrado',n.text)}${prose('Notas',n.notes)}</section>`).join('');
      records += state.records.filter(r => r.playerId === player.id).map(r => `<section class="v8p-section"><h3>Registro anterior · ${esc(r.date)}</h3>${facts([['Minutos entrenamiento',r.trainingMinutes],['Minutos partido',r.matchMinutes],['Esfuerzo registrado',r.effort],['Escala',r.scale],['Origen',r.origin],['Fatiga registrada',r.fatigueScore],['Recuperacion registrada',r.recoveryScore],['Bienestar registrado',r.wellbeingScore],['Escala de bienestar',r.scoreScale]])}${['fatigue','recovery','rest','discomfort','availability'].map((key,i) => prose(['Fatiga','Recuperacion','Descanso','Molestias','Disponibilidad'][i],r[key])).join('')}</section>`).join('');
    }
    if (records) html += `<section class="v8p-professional"><h2>Registros profesionales sinteticos</h2><p>Contenido manual DEMO. Autoria y funcion son metadatos, no acreditacion ni permisos sanitarios.</p>${records}</section>`;
  }
  return {title:`Ficha ${own ? 'propia' : 'rival'} · ${player.name}`,html};
}

export function renderPrintV8(state8, request, {renderBoard, renderLineup}) {
  if (state8?.schemaVersion !== 8 || !state8.domainV8 || !state8.matchV8) throw new Error('Impresion requiere snapshot validado schema8');
  const keys = ['kind','sessionId','playerId','variantId','includeProfessional','includeLegacy','source','rivalTeamId'];
  if (!request || Object.keys(request).some(key => !keys.includes(key))) throw new Error('PrintRequest fuera de contrato');
  const req = {includeProfessional:false, includeLegacy:true, rivalTeamId:null, ...request};
  if (!['session','analysis-own','analysis-rival','match','player'].includes(req.kind) || !['saved','candidate'].includes(req.source) || typeof req.includeProfessional !== 'boolean' || typeof req.includeLegacy !== 'boolean') throw new Error('PrintRequest invalido');
  if (typeof renderBoard !== 'function') throw new Error('Falta el renderer de confianza del core');
  if (req.kind === 'match' && req.variantId !== null && typeof req.variantId !== 'string') throw new Error('La variante debe ser explicita');
  const warnings = [];
  if (req.source === 'candidate') warnings.push('BORRADOR: candidata sin confirmar como guardada.');
  const boards = createBoards(renderBoard,renderLineup,warnings);
  const doc = req.kind === 'session' ? sessionHTML(state8,req,boards) : req.kind.startsWith('analysis-') ? analysisHTML(state8,req,boards) : req.kind === 'match' ? matchHTML(state8,req,boards) : playerHTML(state8,req);
  const notice = [...new Set(warnings)].map(w => `<p class="v8p-warning">${esc(w)}</p>`).join('');
  return {title:doc.title, html:`<article class="v8p-document" data-v8p-kind="${req.kind}" data-v8p-source="${req.source}"><header class="v8p-header"><p class="v8p-brand">Terreno · Adultos ficticios</p><h1>${esc(doc.title)}</h1>${notice}</header>${doc.html}</article>`, warnings:[...new Set(warnings)]};
}

export async function preparePrintV8(rootElement) {
  if (!rootElement || typeof rootElement.querySelectorAll !== 'function') throw new Error('Falta la raiz de impresion');
  const doc = rootElement.ownerDocument;
  if (doc?.fonts?.ready) await doc.fonts.ready;
  await Promise.all([...rootElement.querySelectorAll('img')].map(async image => {
    const src = image.getAttribute('src') || '';
    if (!src.startsWith('data:image/png;base64,')) throw new Error('Imagen de impresion fuera del contrato raster local');
    if (typeof image.decode === 'function') await image.decode();
    if (!image.complete || !image.naturalWidth) throw new Error('No se ha podido preparar una imagen de impresion');
  }));
}
