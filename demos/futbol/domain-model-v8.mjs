const fail = message => { throw new Error(message || 'Datos de dominio fuera del contrato v8'); };
const text = (v, max = 3000, min = 0) => typeof v === 'string' && v.length >= min && v.length <= max ? v : fail('Texto de dominio fuera de limites');
const id = v => text(v, 80, 1);
const one = (v, choices) => choices.includes(v) ? v : fail('Opcion de dominio no admitida');
const integer = (v, min, max) => Number.isInteger(v) && v >= min && v <= max ? v : fail('Numero de dominio fuera de limites');
const optional = (v, min, max) => v === null ? null : integer(v, min, max);
const unique = values => new Set(values).size === values.length ? values : fail('Identidad o referencia duplicada');
const list = (v, max, parse) => Array.isArray(v) && v.length <= max ? Array.from(v, parse) : fail('Coleccion de dominio fuera de limites');
const ANALYSIS = ['strengths', 'weaknesses', 'notes', 'attack', 'loss', 'defend', 'recover'];
const FORMATIONS = ['4-3-3', '4-4-2', '3-5-2'];

function shape(v, keys) {
  if (!v || typeof v !== 'object' || Array.isArray(v) || ![Object.prototype, null].includes(Object.getPrototypeOf(v)) || Object.keys(v).length !== keys.length || keys.some(k => !Object.hasOwn(v, k))) fail('Campos de dominio incompletos o desconocidos');
  return v;
}
function date(v) {
  text(v, 10, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || v < '1900-01-01' || v > '2100-12-31' || new Date(v + 'T12:00:00Z').toISOString().slice(0, 10) !== v) fail('Fecha de dominio no valida');
  return v;
}
function url(v) {
  text(v, 2048, 1);
  if (!/^https:\/\//i.test(v) || /[\u0000-\u0020\u007f<>"\\]/.test(v)) fail('Solo enlaces HTTPS absolutos sin credenciales');
  let parsed;
  try { parsed = new URL(v); } catch { fail('Enlace HTTPS no valido'); }
  if (parsed.protocol !== 'https:' || !parsed.hostname || parsed.username || parsed.password || /%(?:0[0-9a-f]|1[0-9a-f]|7f)/i.test(v)) fail('Enlace HTTPS no valido');
  return v;
}
function slots(v, players) {
  if (!Array.isArray(v) || v.length !== 11) fail('Se requieren once puestos, con null para los vacios');
  const ids = new Set(players.map(p => p.id));
  const result = Array.from(v, p => p === null ? null : ids.has(id(p)) ? p : fail('Puesto sin ficha rival'));
  unique(result.filter(p => p !== null));
  return result;
}
function rivalExtra(v, players) {
  shape(v, ['rivalId', 'dorsal', 'position', 'notes']);
  if (!players.some(p => p.id === id(v.rivalId))) fail('Extension sin ficha rival');
  return {rivalId: v.rivalId, dorsal: optional(v.dorsal, 1, 99), position: text(v.position, 80), notes: text(v.notes)};
}
function rivalExtras(v, players) {
  const result = list(v, 30, p => rivalExtra(p, players));
  unique(result.map(p => p.rivalId));
  return result;
}
function career(v) {
  shape(v, ['id', 'club', 'season', 'category', 'positions']);
  return {id: id(v.id), club: text(v.club, 120), season: text(v.season, 80), category: text(v.category, 80), positions: list(v.positions, 8, p => text(p, 80))};
}
function link(v) {
  shape(v, ['id', 'title', 'url', 'kind']);
  return {id: id(v.id), title: text(v.title, 120), url: url(v.url), kind: one(v.kind, ['video', 'report', 'other'])};
}
function ownProfile(v, core) {
  shape(v, ['playerId', 'age', 'heightCm', 'characteristics', 'notes', 'career', 'links']);
  if (!core.players.some(p => p.id === id(v.playerId))) fail('Perfil sin jugador de plantilla');
  const result = {playerId: v.playerId, age: optional(v.age, 18, 120), heightCm: optional(v.heightCm, 80, 250), characteristics: text(v.characteristics), notes: text(v.notes), career: list(v.career, 40, career), links: list(v.links, 30, link)};
  unique(result.career.map(r => r.id)); unique(result.links.map(r => r.id));
  return result;
}
function evolution(v) {
  shape(v, ['id', 'date', 'author', 'professionalFunction', 'notes']);
  return {id: id(v.id), date: date(v.date), author: text(v.author, 120, 1), professionalFunction: text(v.professionalFunction, 80), notes: text(v.notes)};
}
function plan(v, core) {
  shape(v, ['id', 'playerId', 'kind', 'author', 'professionalFunction', 'objective', 'validFrom', 'validTo', 'content', 'notes', 'evolution']);
  if (!core.players.some(p => p.id === id(v.playerId))) fail('Plan sin jugador de plantilla');
  const result = {id: id(v.id), playerId: v.playerId, kind: one(v.kind, ['nutrition', 'prevention']), author: text(v.author, 120, 1), professionalFunction: text(v.professionalFunction, 80), objective: text(v.objective, 1000), validFrom: v.validFrom === null ? null : date(v.validFrom), validTo: v.validTo === null ? null : date(v.validTo), content: text(v.content), notes: text(v.notes, 1000), evolution: list(v.evolution, 100, evolution)};
  if (result.validFrom && result.validTo && result.validTo < result.validFrom) fail('Vigencia de plan invertida');
  unique(result.evolution.map(r => r.id));
  return result;
}
function rivalPlayer(v, parsePhoto) {
  shape(v, ['id', 'name', 'age', 'height', 'foot', 'description', 'photo']);
  const photo = parsePhoto(v.photo);
  if (photo !== v.photo) fail('La foto no conserva el contrato raster');
  return {id: id(v.id), name: text(v.name, 80, 1), age: integer(v.age, 18, 80), height: integer(v.height, 130, 230), foot: one(v.foot, ['right', 'left', 'both']), description: text(v.description, 1000), photo};
}
function rivalTeam(v, {parseBoard, parsePhoto}) {
  shape(v, ['id', 'name', 'players', 'rivalProfiles', 'lineupSlots', 'formation', 'analysis', 'abpAttack', 'abpDefend', 'board', 'notes']);
  const players = list(v.players, 30, p => rivalPlayer(p, parsePhoto));
  unique(players.map(p => p.id)); shape(v.analysis, ANALYSIS);
  return {id: id(v.id), name: text(v.name, 120, 1), players, rivalProfiles: rivalExtras(v.rivalProfiles, players), lineupSlots: slots(v.lineupSlots, players), formation: one(v.formation, FORMATIONS), analysis: Object.fromEntries(ANALYSIS.map(k => [k, text(v.analysis[k])])), abpAttack: text(v.abpAttack), abpDefend: text(v.abpDefend), board: parseBoard(structuredClone(v.board)), notes: text(v.notes)};
}

export function domainDefaults8(core7, {newBoard}) {
  const initial = core7.analysisV7.rivalLineup;
  if (!Array.isArray(initial) || initial.length > 11) fail('Once legacy no valido');
  return {ownProfiles: [], rivalProfiles: [], rivalTeams: [], rivalLineupSlots: Array.from({length: 11}, (_, i) => initial[i] ?? null), rivalBoard: newBoard(), professionalPlans: []};
}

export function parseDomain8(raw, core, {parseBoard, parsePhoto}) {
  shape(raw, ['ownProfiles', 'rivalProfiles', 'rivalTeams', 'rivalLineupSlots', 'rivalBoard', 'professionalPlans']);
  const result = {ownProfiles: list(raw.ownProfiles, core.players.length, p => ownProfile(p, core)), rivalProfiles: rivalExtras(raw.rivalProfiles, core.rivals), rivalTeams: list(raw.rivalTeams, 20, t => rivalTeam(t, {parseBoard, parsePhoto})), rivalLineupSlots: slots(raw.rivalLineupSlots, core.rivals), rivalBoard: parseBoard(structuredClone(raw.rivalBoard)), professionalPlans: list(raw.professionalPlans, 100, p => plan(p, core))};
  unique(result.ownProfiles.map(p => p.playerId)); unique(result.rivalTeams.map(t => t.id)); unique(result.professionalPlans.map(p => p.id));
  return result;
}

function copyTeam(source, {uid, cloneBoard}, targetId = null) {
  const map = new Map();
  for (const p of source.players) map.set(p.id, uid());
  return {...structuredClone(source), id: targetId ?? uid(), players: source.players.map(p => ({...structuredClone(p), id: map.get(p.id)})), rivalProfiles: source.rivalProfiles.map(p => ({...p, rivalId: map.get(p.rivalId)})), lineupSlots: source.lineupSlots.map(p => p === null ? null : map.get(p)), board: cloneBoard(source.board, map)};
}

function activeTeam(state, name, notes) {
  const d = state.domainV8;
  return {id: '', name, players: state.rivals, rivalProfiles: d.rivalProfiles, lineupSlots: d.rivalLineupSlots, formation: state.analysisV7.rivalFormation, analysis: state.analysis.rival, abpAttack: state.analysisV7.rivalABPAttack, abpDefend: state.analysisV7.rivalABPDefend, board: d.rivalBoard, notes};
}

function partial(v, allowed) {
  if (!v || typeof v !== 'object' || Array.isArray(v) || ![Object.prototype, null].includes(Object.getPrototypeOf(v)) || Object.keys(v).some(k => !allowed.includes(k))) fail('Campo de comando no permitido');
  return v;
}
const ownDefaults = playerId => ({playerId, age: null, heightCm: null, characteristics: '', notes: '', career: [], links: []});
const extraDefaults = rivalId => ({rivalId, dorsal: null, position: '', notes: ''});
function upsert(collection, key, value) {
  const index = collection.findIndex(p => p[key] === value[key]);
  if (index < 0) collection.push(value); else collection[index] = value;
}
function removePlayerPiece(board, personId) {
  board.pieces = board.pieces.filter(p => !(p.kind === 'player' && p.id === personId));
  for (const f of board.frames ?? []) removePlayerPiece(f.snapshot, personId);
  for (const v of board.versions ?? []) removePlayerPiece(v.board, personId);
}

export function applyDomainCommand8(state8, command, {uid, cloneBoard, parse}) {
  shape(command, ['type', 'id', 'values']);
  if (command.id !== null) id(command.id);
  const s = structuredClone(state8), d = s.domainV8, v = command.values;
  const helpers = {uid: () => id(uid()), cloneBoard};
  if (command.type === 'profile.upsert') {
    shape(v, ['personKind', 'base', 'extras']);
    one(v.personKind, ['own', 'rival']);
    const own = v.personKind === 'own';
    partial(v.base, own ? ['name', 'dorsal', 'photo', 'position', 'foot', 'availability', 'availabilityDate'] : ['name', 'age', 'height', 'foot', 'description', 'photo']);
    partial(v.extras, own ? ['age', 'heightCm', 'characteristics', 'notes', 'career', 'links'] : ['dorsal', 'position', 'notes']);
    const people = own ? s.players : s.rivals;
    let person = people.find(p => p.id === command.id);
    if (!person) {
      if (own || command.id !== null) fail('La ficha ya no existe');
      person = {id: helpers.uid()}; people.push(person);
    }
    Object.assign(person, structuredClone(v.base));
    const collection = own ? d.ownProfiles : d.rivalProfiles, key = own ? 'playerId' : 'rivalId';
    const previous = collection.find(p => p[key] === person.id) ?? (own ? ownDefaults(person.id) : extraDefaults(person.id));
    upsert(collection, key, {...previous, ...structuredClone(v.extras), [key]: person.id});
  } else if (command.type === 'rival.remove') {
    shape(v, []);
    if (!s.rivals.some(p => p.id === command.id)) fail('La ficha rival ya no existe');
    s.rivals = s.rivals.filter(p => p.id !== command.id);
    d.rivalProfiles = d.rivalProfiles.filter(p => p.rivalId !== command.id);
    d.rivalLineupSlots = d.rivalLineupSlots.map(p => p === command.id ? null : p);
    s.analysisV7.rivalLineup = d.rivalLineupSlots.filter(p => p !== null);
    removePlayerPiece(d.rivalBoard, command.id);
  } else if (command.type === 'rival-lineup.save') {
    if (command.id !== null) fail('El once activo no admite ID de equipo guardado');
    partial(v, ['formation', 'lineupSlots', 'analysis', 'abpAttack', 'abpDefend']);
    if (!Object.keys(v).length) fail('No hay campos del analisis para guardar');
    if (Object.hasOwn(v, 'lineupSlots')) {
      d.rivalLineupSlots = slots(v.lineupSlots, s.rivals);
      s.analysisV7.rivalLineup = d.rivalLineupSlots.filter(p => p !== null);
    }
    if (Object.hasOwn(v, 'formation')) s.analysisV7.rivalFormation = one(v.formation, FORMATIONS);
    if (Object.hasOwn(v, 'analysis')) { partial(v.analysis, ANALYSIS); Object.assign(s.analysis.rival, v.analysis); }
    if (Object.hasOwn(v, 'abpAttack')) s.analysisV7.rivalABPAttack = text(v.abpAttack);
    if (Object.hasOwn(v, 'abpDefend')) s.analysisV7.rivalABPDefend = text(v.abpDefend);
  } else if (command.type === 'rival-team.save') {
    shape(v, ['name', 'notes']);
    if (command.id !== null && !d.rivalTeams.some(t => t.id === command.id)) fail('El equipo guardado ya no existe');
    const team = copyTeam(activeTeam(s, v.name, v.notes), helpers, command.id);
    upsert(d.rivalTeams, 'id', team);
  } else if (['rival-team.copy', 'rival-team.load', 'rival-team.remove'].includes(command.type)) {
    shape(v, command.type === 'rival-team.copy' ? ['name'] : []);
    const source = d.rivalTeams.find(t => t.id === command.id);
    if (!source) fail('El equipo guardado ya no existe');
    if (command.type === 'rival-team.remove') d.rivalTeams = d.rivalTeams.filter(t => t.id !== command.id);
    else {
      const copy = copyTeam(source, helpers);
      if (command.type === 'rival-team.copy') { copy.name = v.name; d.rivalTeams.push(copy); }
      else {
        s.rivals = copy.players; s.analysis.rival = copy.analysis;
        Object.assign(s.analysisV7, {rivalFormation: copy.formation, rivalLineup: copy.lineupSlots.filter(p => p !== null), rivalABPAttack: copy.abpAttack, rivalABPDefend: copy.abpDefend});
        Object.assign(d, {rivalProfiles: copy.rivalProfiles, rivalLineupSlots: copy.lineupSlots, rivalBoard: copy.board});
      }
    }
  } else if (command.type === 'professional.upsert') {
    const keys = ['playerId', 'kind', 'author', 'professionalFunction', 'objective', 'validFrom', 'validTo', 'content', 'notes'];
    let previous = d.professionalPlans.find(p => p.id === command.id);
    if (command.id === null) { shape(v, keys); previous = {id: helpers.uid(), evolution: []}; }
    else { partial(v, keys); if (!previous) fail('El plan ya no existe'); }
    upsert(d.professionalPlans, 'id', {...previous, ...structuredClone(v)});
  } else if (['professional.remove', 'evolution.add', 'evolution.remove'].includes(command.type)) {
    const parent = d.professionalPlans.find(p => p.id === command.id);
    if (!parent) fail('El plan padre ya no existe');
    if (command.type === 'professional.remove') { shape(v, []); d.professionalPlans = d.professionalPlans.filter(p => p.id !== command.id); }
    else if (command.type === 'evolution.add') {
      shape(v, ['date', 'author', 'professionalFunction', 'notes', ...(Object.hasOwn(v, 'id') ? ['id'] : [])]);
      parent.evolution.push({...structuredClone(v), id: Object.hasOwn(v, 'id') ? id(v.id) : helpers.uid()});
    } else {
      shape(v, ['id']);
      if (!parent.evolution.some(r => r.id === v.id)) fail('La evolucion no pertenece a este plan');
      parent.evolution = parent.evolution.filter(r => r.id !== v.id);
    }
  } else fail('Comando de dominio no admitido');
  return parse(s);
}
