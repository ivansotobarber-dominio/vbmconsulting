import {KINDS,TEAMS} from './model-v3.mjs';
const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icon=name=>`<i data-lucide="${name}" aria-hidden="true"></i>`;
export const teamColor=team=>({neutral:'#ffffff',A:'#f18b6d',B:'#8fc9ef',wildcard:'#ffe99b'}[team]);
export const boardItems=b=>[...b.pieces,...b.arrows,...b.zones];
export const itemKind=p=>p.kind??(Object.hasOwn(p,'width')?'zone':'arrow');
export const itemName=p=>`${KINDS[p.kind]??(itemKind(p)==='zone'?'Zona':'Flecha')} ${p.label??''}`;
let serial=0;
export function objectSVG(p,selected,marker,interactive=true){
  const kind=itemKind(p),color=teamColor(p.team),arrow=kind==='arrow',zone=kind==='zone';
  const common=`stroke="#173f2d" stroke-width="2"`;
  const shapes={
    player:`<circle r="18" fill="${color}" ${common}/><text text-anchor="middle" dominant-baseline="central" font-size="15" fill="#173f2d">${esc(p.label)}</text>`,
    cone:`<path d="M0 -16L16 14H-16Z" fill="${p.team==='neutral'?'#f18b6d':color}" stroke="#ffe3d8" stroke-width="2"/>`,
    ladder:'<path d="M-15 -22V22M15 -22V22M-15 -16H15M-15 -5H15M-15 6H15M-15 17H15" stroke="#ffe99b" stroke-width="4"/>',
    goal:'<path d="M-24 15V-15H24V15M-24 5H24M-12 -15V15M0 -15V15M12 -15V15" stroke="white" stroke-width="3" fill="none"/>',
    ball:'<circle r="14" fill="white" stroke="#173f2d" stroke-width="2"/><path d="M0 -7L7 -2L4 7H-4L-7 -2Z" fill="#202923"/>',
    obstacle:`<rect x="-22" y="-9" width="44" height="18" fill="${p.team==='neutral'?'#f18b6d':color}" stroke="white" stroke-width="2"/>`,
    staff:`<circle cy="-14" r="8" fill="${color}" ${common}/><path d="M-14 18V1Q0 -8 14 1V18Z" fill="${color}" ${common}/><rect x="3" y="0" width="13" height="18" fill="#e8ede9" ${common}/>`,
    step:'<path d="M-23 4H23V15H-23ZM-18 4V-5H18V4" fill="#8fc9ef" stroke="#ffffff" stroke-width="2"/>',
    hurdle:'<path d="M-22 18V-16H22V18M-22 -5H22" fill="none" stroke="#f18b6d" stroke-width="5"/>',
    hoop:'<ellipse rx="23" ry="15" fill="none" stroke="#ffe99b" stroke-width="5"/>',
    bosu:'<path d="M-24 10A24 24 0 0 1 24 10Z" fill="#8fc9ef" stroke="white" stroke-width="2"/><path d="M-28 12H28" stroke="#173f2d" stroke-width="4"/>',
    marker:'<ellipse rx="18" ry="7" fill="#ffe99b" stroke="white" stroke-width="2"/>',
    pole:'<path d="M0 -25V22M-9 22H9" stroke="#ffe99b" stroke-width="5"/>',
    medicineball:'<circle r="18" fill="#8fc9ef" stroke="#173f2d" stroke-width="3"/><path d="M-18 0H18M0 -18Q-12 0 0 18" fill="none" stroke="#173f2d" stroke-width="2"/>',
    wall:'<path d="M-24 18V-17H24V18M-12 -17V18M0 -17V18M12 -17V18" fill="#e8ede9" stroke="#173f2d" stroke-width="3"/>',
  };
  const dx=arrow?(p.x2-p.x)*9:0,dy=arrow?(p.y2-p.y)*5.8:0;
  const arrowPath=arrow?`M0 0${p.curve?`Q${(p.cx-p.x)*9} ${(p.cy-p.y)*5.8} `:'L'}${dx} ${dy}`:'';
  const body=zone?`<rect width="${p.width*9}" height="${p.height*5.8}" fill="${color}" fill-opacity=".15" stroke="${color}" stroke-width="3" stroke-dasharray="9 5"/><text x="${p.width*4.5}" y="${p.height*2.9}" text-anchor="middle" fill="white" font-size="15">${esc(p.label)}</text>`:arrow?`<path d="${arrowPath}" fill="none" stroke="${p.team==='neutral'?'#ffe99b':color}" stroke-width="5" ${p.dashed?'stroke-dasharray="12 8"':''} marker-end="url(#${marker})"/><circle cx="${dx}" cy="${dy}" r="8" fill="#ffe99b"/>${p.curve&&selected?`<circle cx="${(p.cx-p.x)*9}" cy="${(p.cy-p.y)*5.8}" r="7" fill="none" stroke="#ffe99b" stroke-width="2"/>`:''}<circle r="9" fill="#ffe99b"/>`:shapes[kind];
  return `<g class="piece${selected?' is-selected':''}" ${interactive?`data-piece="${esc(p.id)}" tabindex="0" role="button" aria-label="${esc(itemName(p))}, X ${p.x}, Y ${p.y}" aria-pressed="${selected}"`:''} transform="translate(${p.x*9},${p.y*5.8})">${body}${interactive?'<circle class="hit-area" r="34" fill="transparent"/><circle class="selection-ring" r="23"/>':''}</g>`;
}
export function boardSVG(board,pitchLines,selectedId=null,interactive=false){
  const marker=`board-direction-${++serial}`;
  return `<svg ${interactive?'id="pitch"':''} class="${interactive?'pitch':'mini-pitch'}" viewBox="0 0 900 580" role="${interactive?'group':'img'}" aria-label="Pizarra contextual" data-marker="${marker}"><defs><marker id="${marker}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10Z" fill="context-stroke"/></marker></defs>${pitchLines()}<g ${interactive?'id="pieces"':''}>${[...board.zones,...board.arrows,...board.pieces].map(p=>objectSVG(p,p.id===selectedId,marker,interactive)).join('')}</g></svg>`;
}
export function inspector(board,p){
  const kind=p?itemKind(p):'',coords=p?['x','y',...(kind==='arrow'?['x2','y2',...(p.curve?['cx','cy']:[])]:kind==='zone'?['width','height']:[])]:['x','y'];
  const labels={x:'X origen (%)',y:'Y origen (%)',x2:'X destino (%)',y2:'Y destino (%)',cx:'X curva (%)',cy:'Y curva (%)',width:'Ancho (%)',height:'Alto (%)'};
  return `<h3>Disposición</h3><label for="piece-select">Recurso seleccionado</label><select id="piece-select" ${!p?'disabled':''}>${boardItems(board).map(a=>`<option value="${esc(a.id)}" ${a.id===p?.id?'selected':''}>${esc(itemName(a))}</option>`).join('')}</select><div class="inspector-row">${coords.map(axis=>`<div><label for="piece-${axis}">${labels[axis]}</label><input id="piece-${axis}" data-coordinate="${axis}" type="number" min="${['width','height'].includes(axis)?2:axis.startsWith('x')||axis==='cx'?3:5}" max="${axis==='width'?94:axis==='height'?90:axis.startsWith('x')||axis==='cx'?97:95}" step="any" value="${p?.[axis]??''}" ${!p?'disabled':''}></div>`).join('')}</div><label for="piece-team">Color de equipo</label><select id="piece-team" ${!p?'disabled':''}>${Object.entries(TEAMS).map(([k,v])=>`<option value="${k}" ${p?.team===k?'selected':''}>${v}</option>`).join('')}</select>${kind==='arrow'?`<label class="photo-confirm"><input id="arrow-curve" type="checkbox" ${p.curve?'checked':''}>Curva</label><label class="photo-confirm"><input id="arrow-dashed" type="checkbox" ${p.dashed?'checked':''}>Trazo discontinuo</label>`:''}<div class="direction-controls">${[['up',0,-2,'arriba'],['left',-2,0,'izquierda'],['down',0,2,'abajo'],['right',2,0,'derecha']].map(([k,x,y,label])=>`<button type="button" class="${k}" data-action="move" data-dx="${x}" data-dy="${y}" title="Mover ${label}" aria-label="Mover ${label}" ${!p?'disabled':''}>${icon(`arrow-${k}`)}</button>`).join('')}</div><label for="add-kind">Recurso</label><select id="add-kind">${Object.entries(KINDS).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}<option value="arrow">Flecha</option><option value="zone">Zona</option></select><button type="button" class="secondary" data-action="add-piece">${icon('plus')}Añadir recurso</button><button type="button" class="text-button danger" data-action="delete-piece" ${!p?'disabled':''}>${icon('trash-2')}Eliminar recurso</button>`;
}
export function boardEditor(board,pitchLines,selectedId){
  const p=boardItems(board).find(p=>p.id===selectedId);
  return `<div class="board-layout"><section>${boardSVG(board,pitchLines,selectedId,true)}<div class="board-bottom"><p>${Object.entries(KINDS).filter(([k])=>board.pieces.some(p=>p.kind===k)).map(([k,v])=>`${v}: ${board.pieces.filter(p=>p.kind===k).length}`).join(' · ')} · Flechas: ${board.arrows.length} · Zonas: ${board.zones.length}</p><button type="button" class="text-button" data-action="reset-board">${icon('rotate-ccw')}Restablecer pizarra</button></div><form id="board-form"><label for="board-text">Consigna de esta pizarra</label><textarea id="board-text" name="text" maxlength="3000">${esc(board.text)}</textarea><button class="secondary" type="submit">${icon('check')}Guardar consigna</button></form></section><aside id="board-inspector" class="board-inspector" data-selected="${esc(p?.id??'')}">${inspector(board,p)}</aside></div>`;
}
