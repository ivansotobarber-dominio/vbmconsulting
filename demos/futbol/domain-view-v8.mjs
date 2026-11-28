const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const icon = name => `<i data-lucide="${name}" aria-hidden="true"></i>`;
const hidden = (name, value) => `<input type="hidden" name="${name}" value="${esc(value)}">`;
const button = (action, label, id = '', glyph = 'pencil', disabled = false) => `<button type="button" class="secondary" data-action="v8d-${action}" data-id="${esc(id)}" title="${esc(label)}" ${disabled ? 'disabled' : ''}>${icon(glyph)}${esc(label)}</button>`;
const submit = label => `<button type="submit" class="secondary">${icon('check')}${esc(label)}</button>`;
const emptyOwn = playerId => ({playerId, age: null, heightCm: null, characteristics: '', notes: '', career: [], links: []});
const emptyExtra = rivalId => ({rivalId, dorsal: null, position: '', notes: ''});
const ownProfile = (s, id) => s.domainV8.ownProfiles.find(p => p.playerId === id) ?? emptyOwn(id);
const rivalExtra = (s, id) => s.domainV8.rivalProfiles.find(p => p.rivalId === id) ?? emptyExtra(id);
const people = (s, kind) => kind === 'own' ? s.players : s.rivals;
const person = (s, u) => people(s, u.personKind).find(p => p.id === u.personId);
const field = (prefix, name, label, value = '', type = 'text', attrs = '') => `<div class="v8d-field"><label for="${esc(prefix + '-' + name)}">${esc(label)}</label><input id="${esc(prefix + '-' + name)}" name="${esc(name)}" type="${type}" value="${esc(value)}" ${attrs}></div>`;
const area = (prefix, name, label, value = '', max = 3000) => `<div class="v8d-field"><label for="${esc(prefix + '-' + name)}">${esc(label)}</label><textarea id="${esc(prefix + '-' + name)}" name="${esc(name)}" maxlength="${max}" rows="2">${esc(value)}</textarea></div>`;
const form = (id, action, content, canWrite) => `<form id="${esc(id)}" data-action="v8d-${action}"><fieldset ${canWrite ? '' : 'disabled'}>${content}</fieldset></form>`;
const context = u => hidden('personId', u.personId) + hidden('personKind', u.personKind);
const select = (id, name, label, choices, value, attrs = '') => `<div class="v8d-field"><label for="${esc(id)}">${esc(label)}</label><select id="${esc(id)}" name="${esc(name)}" ${attrs}>${choices.map(([key, title]) => `<option value="${esc(key)}" ${key === value ? 'selected' : ''}>${esc(title)}</option>`).join('')}</select></div>`;
const nextId = (rows, prefix) => { let i = 1; while (rows.some(r => r.id === `${prefix}${i}`)) i++; return `${prefix}${i}`; };

export function domainDefaultsUI8(state8) {
  return {tab: 'rivals', personKind: 'rival', personId: state8.rivals[0]?.id ?? null, rivalTeamId: null, planId: null};
}

function picker(s, u) {
  return `<div class="v8d-person-picker">${select('v8d-person-kind', 'personKind', 'Equipo', [['own', 'Plantilla'], ['rival', 'Rival activo']], u.personKind, 'data-action="v8d-person-kind"')}${select('v8d-person-id', 'personId', 'Ficha', [['', 'Seleccionar'], ...people(s, u.personKind).map(p => [p.id, `${p.dorsal ?? rivalExtra(s, p.id).dorsal ?? ''} ${p.name}`.trim()])], u.personId ?? '', 'data-action="v8d-person-select"')}</div>`;
}
function careerForm(row, u, writable) {
  const prefix = `v8d-career-${row?.id ?? 'new'}`;
  return form(prefix, 'career-save', context(u) + hidden('entryId', row?.id ?? '') + hidden('positionCount', row?.positions.length ?? 0) + `<div class="v8d-grid">${field(prefix, 'club', 'Club', row?.club, 'text', 'maxlength="120"')}${field(prefix, 'season', 'Temporada', row?.season, 'text', 'maxlength="80"')}${field(prefix, 'category', 'Categoría', row?.category, 'text', 'maxlength="80"')}</div><div class="v8d-positions">${Array.from({length: 8}, (_, i) => field(prefix, `position${i}`, `Posición ${i + 1}`, row?.positions[i], 'text', 'maxlength="80"')).join('')}</div><div class="v8d-actions">${submit(row ? 'Guardar etapa' : 'Añadir etapa')}${row ? button('career-remove', 'Eliminar etapa', row.id, 'trash-2', !writable) : ''}</div>`, writable);
}
function linkForm(row, u, writable) {
  const prefix = `v8d-link-${row?.id ?? 'new'}`;
  return form(prefix, 'link-save', context(u) + hidden('entryId', row?.id ?? '') + `<div class="v8d-grid">${field(prefix, 'title', 'Título', row?.title, 'text', 'maxlength="120"')}${select(prefix + '-kind', 'kind', 'Tipo', [['video', 'Vídeo'], ['report', 'Informe'], ['other', 'Otro']], row?.kind ?? 'video')}${field(prefix, 'url', 'Enlace HTTPS', row?.url, 'url', 'required maxlength="2048"')}</div><div class="v8d-actions">${submit(row ? 'Guardar enlace' : 'Añadir enlace')}${row ? button('link-remove', 'Eliminar enlace', row.id, 'trash-2', !writable) : ''}</div>`, writable);
}
function externalLink(row) {
  let safe = false;
  try { const u = new URL(row.url); safe = /^https:\/\//i.test(row.url) && u.protocol === 'https:' && !u.username && !u.password && !/[\u0000-\u0020\u007f<>"\\]/.test(row.url); } catch { /* Invalid input is never promoted to a link. */ }
  return safe ? `<a href="${esc(row.url)}" target="_blank" rel="noopener noreferrer">${icon('external-link')}${esc(row.title || row.url)}</a>` : `<span>${esc(row.title || row.url)}</span>`;
}
function profiles(s, u, writable) {
  const p = person(s, u);
  if (!p) return picker(s, u) + '<p class="v8d-empty">Sin ficha seleccionada.</p>';
  const own = u.personKind === 'own', x = own ? ownProfile(s, p.id) : rivalExtra(s, p.id);
  const fields = own ? field('v8d-profile', 'age', 'Edad adulta', x.age, 'number', 'min="18" max="120" step="1"') + field('v8d-profile', 'heightCm', 'Altura (cm)', x.heightCm, 'number', 'min="80" max="250" step="1"') : field('v8d-profile', 'dorsal', 'Dorsal', x.dorsal, 'number', 'min="1" max="99" step="1"') + field('v8d-profile', 'position', 'Posición', x.position, 'text', 'maxlength="80"');
  let html = picker(s, u) + `<h3 id="v8d-person-heading" tabindex="-1">${esc(p.name)}</h3>` + form('v8d-profile-form', 'profile-save', context(u) + `<div class="v8d-grid">${fields}</div>${own ? area('v8d-profile', 'characteristics', 'Características', x.characteristics) : ''}${area('v8d-profile', 'notes', 'Notas', x.notes)}${submit('Guardar ficha ampliada')}`, writable);
  if (!own) return html;
  html += `<section class="v8d-section"><h3>Trayectoria <span class="v8d-count">${x.career.length}/40</span></h3>${x.career.map(r => `<details class="v8d-row"><summary>${esc([r.season, r.club, r.category].filter(Boolean).join(' · ') || 'Etapa sin título')}</summary>${careerForm(r, u, writable)}</details>`).join('')}<details class="v8d-row"><summary>Nueva etapa</summary>${careerForm(null, u, writable)}</details></section>`;
  html += `<section class="v8d-section"><h3>Vídeos e informes <span class="v8d-count">${x.links.length}/30</span></h3>${x.links.map(r => `<div class="v8d-row">${externalLink(r)}<details><summary>Editar enlace</summary>${linkForm(r, u, writable)}</details></div>`).join('')}<details class="v8d-row"><summary>Nuevo enlace</summary>${linkForm(null, u, writable)}</details></section>`;
  return html;
}
function teamReadout(team, renderBoard) {
  return `<section class="v8d-section"><h3>${esc(team.name)}</h3><div class="v8d-board-preview">${renderBoard(team.board, {interactive: false, selectedId: null, label: team.name, print: false})}</div><ol class="v8d-eleven">${team.lineupSlots.map((id, i) => { const p = team.players.find(p => p.id === id), x = team.rivalProfiles.find(r => r.rivalId === id); return `<li><span>${i + 1}</span><span>${p ? esc(`${x?.dorsal ?? ''} ${p.name}`.trim()) : 'Sin asignar'}</span></li>`; }).join('')}</ol>${team.notes ? `<p class="v8d-prose">${esc(team.notes)}</p>` : ''}<details class="v8d-row"><summary>Fichas (${team.players.length})</summary>${team.players.map(p => { const x = team.rivalProfiles.find(r => r.rivalId === p.id); return `<div class="v8d-row"><strong>${esc(p.name)}</strong><p>${esc([x?.dorsal, x?.position, p.age + ' años', p.height + ' cm', ({right: 'Derecha', left: 'Izquierda', both: 'Ambas'})[p.foot]].filter(v => v != null && v !== '').join(' · '))}</p>${p.description ? `<p class="v8d-prose">${esc(p.description)}</p>` : ''}${x?.notes ? `<p class="v8d-prose">${esc(x.notes)}</p>` : ''}</div>`; }).join('')}</details></section>`;
}
function rivals(s, u, {renderBoard, canWrite}) {
  const selected = s.domainV8.rivalTeams.find(t => t.id === u.rivalTeamId);
  return `<div class="v8d-rivals-layout"><nav class="v8d-library" aria-label="Equipos rivales"><h3>Biblioteca <span class="v8d-count">${s.domainV8.rivalTeams.length}/20</span></h3>${button('team-select', 'Rival activo', '', 'users')}${s.domainV8.rivalTeams.map(t => `<button type="button" class="v8d-library-item" data-action="v8d-team-select" data-id="${esc(t.id)}" aria-pressed="${u.rivalTeamId === t.id}"><strong>${esc(t.name)}</strong><span>${t.players.length} fichas</span></button>`).join('')}</nav><div class="v8d-main">${selected ? teamReadout(selected, renderBoard) : `<h3 id="v8d-active-heading" tabindex="-1">Rival activo</h3><div class="v8d-board-preview">${renderBoard(s.domainV8.rivalBoard, {interactive: false, selectedId: null, label: 'Rival activo', print: false})}</div><div class="v8d-actions">${button('board', 'Editar pizarra', '', 'waypoints', !canWrite)}${button('profiles', 'Fichas del rival', '', 'contact')}</div><ul class="v8d-person-list">${s.rivals.map(p => `<li><button type="button" data-action="v8d-rival-select" data-id="${esc(p.id)}">${esc(rivalExtra(s, p.id).dorsal ?? '')} ${esc(p.name)}</button></li>`).join('')}</ul>`}<div class="v8d-actions">${selected ? button('team-load', 'Cargar copia como rival activo', selected.id, 'folder-open', !canWrite) + button('team-remove', 'Eliminar equipo guardado', selected.id, 'trash-2', !canWrite) : ''}${button('print-rival', 'Imprimir rival', selected?.id ?? '', 'printer')}</div>${form('v8d-team-save-form', 'team-save', (selected ? select('v8d-team-save-target', 'teamId', 'Destino del rival activo', [['', 'Nuevo equipo guardado'], [selected.id, 'Reemplazar equipo seleccionado']], '') : hidden('teamId', '')) + field('v8d-team-save', 'name', 'Nombre del equipo', selected?.name ?? '', 'text', 'required maxlength="120"') + area('v8d-team-save', 'notes', 'Observaciones', selected?.notes ?? '') + submit('Guardar rival activo en biblioteca'), canWrite)}${selected ? form('v8d-team-copy-form', 'team-copy', hidden('teamId', selected.id) + field('v8d-team-copy', 'name', 'Nombre de la copia', selected.name, 'text', 'required maxlength="120"') + submit('Crear copia independiente'), canWrite) : ''}</div></div>`;
}
function plans(s, u, writable) {
  const playerId = u.personKind === 'own' ? u.personId : null;
  const rows = s.domainV8.professionalPlans.filter(p => p.playerId === playerId);
  const p = rows.find(p => p.id === u.planId), prefix = 'v8d-plan';
  const editor = form('v8d-plan-form', 'plan-save', hidden('playerId', playerId) + hidden('planId', p?.id ?? '') + `<div class="v8d-grid">${select(prefix + '-kind', 'kind', 'Tipo de registro', [['nutrition', 'Nutrición'], ['prevention', 'Preventivo']], p?.kind ?? 'nutrition')}${field(prefix, 'author', 'Autor ficticio', p?.author, 'text', 'required maxlength="120"')}${field(prefix, 'professionalFunction', 'Función declarada', p?.professionalFunction, 'text', 'maxlength="80"')}${field(prefix, 'validFrom', 'Vigencia desde', p?.validFrom, 'date', 'min="1900-01-01" max="2100-12-31"')}${field(prefix, 'validTo', 'Vigencia hasta', p?.validTo, 'date', 'min="1900-01-01" max="2100-12-31"')}</div>${area(prefix, 'objective', 'Objetivo', p?.objective, 1000)}${area(prefix, 'content', 'Contenido aportado', p?.content)}${area(prefix, 'notes', 'Notas', p?.notes, 1000)}<div class="v8d-actions">${submit(p ? 'Guardar registro' : 'Añadir registro')}${p ? button('plan-remove', 'Eliminar registro', p.id, 'trash-2', !writable) : ''}</div>`, writable && Boolean(playerId));
  const history = p ? `<section class="v8d-section"><h3>Evolución <span class="v8d-count">${p.evolution.length}/100</span></h3>${p.evolution.map(r => `<div class="v8d-row"><strong>${esc(r.date)}</strong><p>${esc(r.author)}${r.professionalFunction ? ' · ' + esc(r.professionalFunction) : ''}</p><p class="v8d-prose">${esc(r.notes)}</p>${button('evolution-remove', 'Eliminar anotación', r.id, 'trash-2', !writable)}</div>`).join('')}${form('v8d-evolution-form', 'evolution-save', hidden('planId', p.id) + `<div class="v8d-grid">${field('v8d-evolution', 'date', 'Fecha', '', 'date', 'required min="1900-01-01" max="2100-12-31"')}${field('v8d-evolution', 'author', 'Autor ficticio', '', 'text', 'required maxlength="120"')}${field('v8d-evolution', 'professionalFunction', 'Función declarada', '', 'text', 'maxlength="80"')}</div>${area('v8d-evolution', 'notes', 'Anotación aportada', '')}${submit('Añadir anotación')}`, writable)}</section>` : '';
  return `${picker(s, {...u, personKind: 'own', personId: playerId})}<div class="v8d-heading"><h3>Registros manuales ficticios</h3>${button('plan-new', 'Nuevo registro', '', 'plus', !writable)}</div><nav class="v8d-plan-list" aria-label="Planes del jugador">${rows.map(r => `<button type="button" data-action="v8d-plan-select" data-id="${esc(r.id)}" aria-pressed="${r.id === u.planId}"><strong>${r.kind === 'nutrition' ? 'Nutrición' : 'Preventivo'}</strong><span>${esc(r.objective || r.author)}</span><span>${esc(r.validFrom ?? 'Sin fecha')} / ${esc(r.validTo ?? 'Sin fecha')}</span></button>`).join('')}</nav>${editor}${history}`;
}

export function renderDomain8(state8, ui, {renderBoard, canWrite}) {
  const writable = canWrite === true;
  return `<section class="v8d-root" aria-label="Rivales y perfiles"><div class="v8d-heading"><h2 tabindex="-1" id="v8d-heading">${({rivals: 'Rivales', profiles: 'Ficha ampliada', plans: 'Planes manuales'})[ui.tab]}</h2><span class="v8d-scope">Adultos ficticios</span></div><nav class="v8d-tabs" aria-label="Datos de equipo">${[['rivals', 'Rivales', 'users'], ['profiles', 'Fichas', 'contact'], ['plans', 'Planes', 'clipboard-list']].map(([key, label, glyph]) => `<button type="button" data-action="v8d-tab" data-id="${key}" aria-pressed="${ui.tab === key}">${icon(glyph)}${label}</button>`).join('')}</nav>${ui.tab === 'rivals' ? rivals(state8, ui, {renderBoard, canWrite: writable}) : ui.tab === 'profiles' ? profiles(state8, ui, writable) : plans(state8, ui, writable)}</section>`;
}

export function domainEvent8(state8, ui, event) {
  if (!event || !['action', 'submit'].includes(event.kind) || !event.action?.startsWith('v8d-')) return null;
  const u = {...ui}, v = event.values ?? {}, action = event.action.slice(4), value = k => typeof v[k] === 'string' ? v[k] : '', nullable = k => value(k) === '' ? null : Number(value(k));
  let command = null, request = null;
  const effect = () => ({ui: u, command, request});
  const selectedId = value('personId') || u.personId;
  const setProfile = extras => { command = {type: 'profile.upsert', id: selectedId, values: {personKind: u.personKind, base: {}, extras}}; };
  if (action === 'tab') {
    if (!['rivals', 'profiles', 'plans'].includes(event.id)) return null;
    u.tab = event.id;
    if (u.tab === 'plans') { u.personKind = 'own'; u.personId = state8.players.some(p => p.id === u.personId) ? u.personId : state8.players[0]?.id ?? null; u.planId = null; }
  } else if (action === 'person-kind') {
    const kind = value('personKind') || event.id;
    if (!['own', 'rival'].includes(kind)) return null;
    u.personKind = kind; u.personId = people(state8, kind)[0]?.id ?? null; u.planId = null;
  } else if (action === 'person-select' || action === 'rival-select') {
    if (action === 'rival-select') { u.tab = 'profiles'; u.personKind = 'rival'; }
    const id = Object.hasOwn(v, 'personId') ? value('personId') : event.id;
    if (id && !people(state8, u.personKind).some(p => p.id === id)) throw new Error('La ficha seleccionada ya no existe');
    u.personId = id || null; u.planId = null;
  } else if (action === 'profiles') { u.tab = 'profiles'; u.personKind = 'rival'; u.personId = state8.rivals[0]?.id ?? null; }
  else if (action === 'team-select') { if (event.id && !state8.domainV8.rivalTeams.some(t => t.id === event.id)) throw new Error('El equipo ya no existe'); u.rivalTeamId = event.id || null; }
  else if (action === 'board') request = {kind: 'board', target: 'rival'};
  else if (action === 'print-rival') request = {kind: 'print', request: {kind: 'analysis-rival', sessionId: null, playerId: null, variantId: null, includeProfessional: false, includeLegacy: true, source: 'saved', rivalTeamId: event.id || null}};
  else if (action === 'team-save') command = {type: 'rival-team.save', id: value('teamId') || null, values: {name: value('name'), notes: value('notes')}};
  else if (action === 'team-copy') command = {type: 'rival-team.copy', id: value('teamId') || event.id, values: {name: value('name')}};
  else if (action === 'team-load' || action === 'team-remove') { command = {type: action === 'team-load' ? 'rival-team.load' : 'rival-team.remove', id: event.id, values: {}}; if (action === 'team-remove') u.rivalTeamId = null; if (action === 'team-load') { u.rivalTeamId = null; u.personId = null; u.planId = null; } }
  else if (action === 'profile-save') {
    if (value('personKind') !== u.personKind || selectedId !== u.personId) throw new Error('El formulario pertenece a otra ficha');
    setProfile(u.personKind === 'own' ? {age: nullable('age'), heightCm: nullable('heightCm'), characteristics: value('characteristics'), notes: value('notes')} : {dorsal: nullable('dorsal'), position: value('position'), notes: value('notes')});
  } else if (['career-save', 'career-remove', 'link-save', 'link-remove'].includes(action)) {
    if (u.personKind !== 'own' || !state8.players.some(p => p.id === selectedId) || selectedId !== u.personId) throw new Error('Selecciona la ficha propia del formulario');
    const p = ownProfile(state8, selectedId), key = action.startsWith('career') ? 'career' : 'links', rows = structuredClone(p[key]), rowId = value('entryId') || event.id;
    if (action.endsWith('remove')) {
      if (!rows.some(r => r.id === rowId)) throw new Error('El elemento ya no existe');
      setProfile({[key]: rows.filter(r => r.id !== rowId)});
    } else {
      if (rowId && !rows.some(r => r.id === rowId)) throw new Error('El elemento editado ya no existe');
      const id = rowId || nextId(rows, `v8d-${key}-`);
      let row;
      if (key === 'career') {
        const positions = Array.from({length: 8}, (_, i) => value(`position${i}`));
        const count = Math.max(Number(value('positionCount') || 0), positions.reduce((n, p, i) => p !== '' ? i + 1 : n, 0));
        row = {id, club: value('club'), season: value('season'), category: value('category'), positions: positions.slice(0, count)};
      } else row = {id, title: value('title'), kind: value('kind'), url: value('url')};
      const i = rows.findIndex(r => r.id === id); if (i < 0) rows.push(row); else rows[i] = row;
      setProfile({[key]: rows});
    }
  } else if (action === 'plan-new') u.planId = null;
  else if (action === 'plan-select') {
    if (!state8.domainV8.professionalPlans.some(p => p.id === event.id && p.playerId === u.personId)) throw new Error('El plan pertenece a otra ficha');
    u.planId = event.id;
  } else if (action === 'plan-save') {
    if (u.personKind !== 'own' || value('playerId') !== u.personId) throw new Error('El registro pertenece a otra ficha');
    const id = value('planId') || null;
    if (id && !state8.domainV8.professionalPlans.some(p => p.id === id && p.playerId === u.personId && u.planId === id)) throw new Error('El plan editado ya no corresponde a esta ficha');
    command = {type: 'professional.upsert', id, values: {playerId: u.personId, kind: value('kind'), author: value('author'), professionalFunction: value('professionalFunction'), objective: value('objective'), validFrom: value('validFrom') || null, validTo: value('validTo') || null, content: value('content'), notes: value('notes')}};
  } else if (['plan-remove', 'evolution-save', 'evolution-remove'].includes(action)) {
    const parentId = action === 'plan-remove' ? event.id : value('planId') || u.planId;
    if (!state8.domainV8.professionalPlans.some(p => p.id === parentId && p.playerId === u.personId && u.personKind === 'own')) throw new Error('El plan padre pertenece a otra ficha');
    if (action === 'plan-remove') { command = {type: 'professional.remove', id: parentId, values: {}}; u.planId = null; }
    else command = {type: action === 'evolution-save' ? 'evolution.add' : 'evolution.remove', id: parentId, values: action === 'evolution-save' ? {date: value('date'), author: value('author'), professionalFunction: value('professionalFunction'), notes: value('notes')} : {id: event.id}};
  } else return null;
  return effect();
}
