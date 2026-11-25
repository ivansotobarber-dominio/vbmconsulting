export const KEY = 'terreno.demo.v2';
export const V1KEY = 'terreno.demo.v1';
export const ANCHOR = '2026-11-23';
export const KINDS = {player:'Jugador',cone:'Cono',ladder:'Escalera',goal:'Miniportería',ball:'Balón',obstacle:'Obstáculo'};
export const PHASES = {attack:'Ataque con balón',defend:'Defensa sin balón',recover:'Transición tras recuperación',loss:'Transición tras pérdida'};
export const BOARDS = {buildup:'Salida de balón',attackCorner:'ABP ofensivo · Córner',attackWide:'ABP ofensivo · Falta lateral',attackFront:'ABP ofensivo · Falta frontal',defendCorner:'ABP defensivo · Córner',defendWide:'ABP defensivo · Falta lateral',defendFront:'ABP defensivo · Falta frontal',press:'Presión alta rival',beaten:'Primera línea superada'};
export const uid = () => crypto.randomUUID();
export const addDays = (iso,n) => {const d=new Date(`${iso}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
export const monday = iso => addDays(iso,-((new Date(`${iso}T12:00:00Z`).getUTCDay()+6)%7));
const fail = () => {throw new Error('Datos fuera del contrato de demo');};
const str = (x,max,min=0) => typeof x==='string' && x.length<=max && x.length>=min ? x : fail();
const num = (x,min,max,integer=false) => Number.isFinite(x) && x>=min && x<=max && (!integer || Number.isInteger(x)) ? x : fail();
const list = (x,max,parse) => Array.isArray(x) && x.length<=max ? x.map(parse) : fail();
const one = (x,values) => values.includes(x) ? x : fail();
const id = x => str(x,80,1);
const unique = xs => {if(new Set(xs).size!==xs.length)fail();return xs;};
const iso = x => {str(x,10,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(x)||x<'1900-01-01'||x>'2100-12-31'||new Date(`${x}T12:00:00Z`).toISOString().slice(0,10)!==x)fail();return x;};
const time = x => {str(x,40,1);if(!Number.isFinite(Date.parse(x)))fail();return x;};
const coord = (x,axis) => num(x,axis==='x'?3:5,axis==='x'?97:95);
const fields = (x,keys,max=3000) => Object.fromEntries(keys.map(k=>[k,str(x?.[k],max)]));
function photo(x) {
  if(x===null)return null;
  str(x,90000,1);
  if(!/^data:image\/png;base64,[A-Za-z0-9+/]+=*$/.test(x))fail();
  const bytes=Uint8Array.from(atob(x.slice(22)),c=>c.charCodeAt(0));
  if(bytes.length<33 || bytes[0]!==137 || String.fromCharCode(...bytes.slice(1,4))!=='PNG' || String.fromCharCode(...bytes.slice(12,16))!=='IHDR')fail();
  const data=new DataView(bytes.buffer);num(data.getUint32(16),1,128,true);num(data.getUint32(20),1,128,true);
  return x;
}
const parsePiece = (p,legacy=false) => ({id:id(p.id),kind:one(p.kind,legacy?['player','cone']:Object.keys(KINDS)),label:str(p.label,12,1),x:coord(p.x,'x'),y:coord(p.y,'y')});
export const emptyBoard = () => ({pieces:[],arrows:[],text:''});
function parseBoard(b) {
  const pieces=list(b.pieces,40,p=>parsePiece(p));
  const arrows=list(b.arrows,30,a=>({id:id(a.id),x:coord(a.x,'x'),y:coord(a.y,'y'),x2:coord(a.x2,'x'),y2:coord(a.y2,'y')}));
  unique([...pieces,...arrows].map(p=>p.id));
  return {pieces,arrows,text:str(b.text,3000)};
}
function parseTask(t,library) {
  const value={id:id(t.id),libraryId:one(t.libraryId,library.map(a=>a.id)),title:str(t.title,80,1),duration:num(t.duration,1,180,true),objective:str(t.objective,500)};
  if(!library.some(l=>l.id===t.libraryId && l.title===t.title))fail();return value;
}
export function parseV1(s,library,formations,players) {
  if(s?.schemaVersion!==1)fail();
  const sessions=list(s.sessions,50,t=>({id:id(t.id),day:num(t.day,0,6,true),title:str(t.title,80,1),objective:str(t.objective,500),tasks:list(t.tasks,30,a=>parseTask(a,library)),board:{pieces:list(t.board.pieces,40,p=>parsePiece(p,true))}}));
  if(sessions.some(s=>!s.title.trim()))fail();
  unique(sessions.flatMap(t=>[t.id,...t.tasks.map(a=>a.id),...t.board.pieces.map(p=>p.id)]));
  const activeDay=num(s.activeDay,0,6,true);
  if(s.selectedSessionId!==null && !sessions.some(t=>t.id===s.selectedSessionId&&t.day===activeDay))fail();
  const lineup=unique(list(s.match.lineup,11,x=>one(x,players.map(p=>p.id))));if(lineup.length!==11)fail();
  return {schemaVersion:1,updatedAt:time(s.updatedAt),activeDay,selectedSessionId:s.selectedSessionId,sessions,analysis:Object.fromEntries(['own','rival'].map(k=>[k,fields(s.analysis[k],['strengths','weaknesses','notes'])])),match:{formation:one(s.match.formation,Object.keys(formations)),lineup,...fields(s.match,['attacking','defending','setPieces'])}};
}
export function migrate(v1,players) {
  return {schemaVersion:2,revision:0,updatedAt:v1.updatedAt,activeDate:addDays(ANCHOR,v1.activeDay),selectedSessionId:v1.selectedSessionId,
    sessions:v1.sessions.map(s=>({...s,date:addDays(ANCHOR,s.day),called:[],intensity:null,board:{...s.board,arrows:[],text:''}})),
    players:players.map((p,i)=>({...p,dorsal:i+1,photo:null})),
    analysis:Object.fromEntries(['own','rival'].map(k=>[k,{...v1.analysis[k],...Object.fromEntries(Object.keys(PHASES).map(f=>[f,'']))}])),
    rivals:[],match:{...v1.match,boards:Object.fromEntries(Object.keys(BOARDS).map(k=>[k,emptyBoard()]))}};
}
export function parseV2(s,library,formations) {
  if(s?.schemaVersion!==2)fail();
  const players=list(s.players,18,p=>({id:id(p.id),name:str(p.name,80,1),dorsal:num(p.dorsal,1,99,true),photo:photo(p.photo)}));
  if(players.length!==18)fail();unique(players.map(p=>p.id));unique(players.map(p=>p.dorsal));
  const sessions=list(s.sessions,50,t=>({id:id(t.id),day:num(t.day,0,6,true),date:iso(t.date),title:str(t.title,80,1),objective:str(t.objective,500),tasks:list(t.tasks,30,a=>parseTask(a,library)),board:parseBoard(t.board),called:unique(list(t.called,18,x=>one(x,players.map(p=>p.id)))),intensity:t.intensity===null?null:num(t.intensity,1,10,true)}));
  unique(sessions.map(t=>t.id));
  for(const t of sessions){if(!t.title.trim())fail();unique(t.tasks.map(a=>a.id));}
  const activeDate=iso(s.activeDate);
  if(s.selectedSessionId!==null && !sessions.some(t=>t.id===s.selectedSessionId && t.date===activeDate))fail();
  const lineup=unique(list(s.match.lineup,11,x=>one(x,players.map(p=>p.id))));if(lineup.length!==11)fail();
  const rivals=list(s.rivals,30,p=>({id:id(p.id),name:str(p.name,80,1),age:num(p.age,18,80,true),height:num(p.height,130,230,true),foot:one(p.foot,['right','left','both']),description:str(p.description,1000),photo:photo(p.photo)}));unique(rivals.map(p=>p.id));
  return {schemaVersion:2,revision:num(s.revision,0,Number.MAX_SAFE_INTEGER,true),updatedAt:time(s.updatedAt),activeDate,selectedSessionId:s.selectedSessionId,sessions,players,
    analysis:Object.fromEntries(['own','rival'].map(k=>[k,fields(s.analysis[k],['strengths','weaknesses','notes',...Object.keys(PHASES)])])),rivals,
    match:{formation:one(s.match.formation,Object.keys(formations)),lineup,...fields(s.match,['attacking','defending','setPieces']),boards:Object.fromEntries(Object.keys(BOARDS).map(k=>[k,parseBoard(s.match.boards[k])]))}};
}
export async function readPhoto(file) {
  if(!file || !['image/png','image/jpeg','image/webp'].includes(file.type) || file.size>2097152 || !file.size)throw new Error('Solo raster ficticio PNG, JPEG o WebP, máximo 2 MB.');
  const image=await createImageBitmap(file);
  try {
    if(image.width>4096 || image.height>4096 || !image.width || !image.height)throw new Error('Dimensiones máximas: 4096 × 4096.');
    const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(128*Math.min(1,image.width/image.height)));canvas.height=Math.max(1,Math.round(128*Math.min(1,image.height/image.width)));
    canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);return photo(canvas.toDataURL('image/png'));
  } finally {image.close();}
}
