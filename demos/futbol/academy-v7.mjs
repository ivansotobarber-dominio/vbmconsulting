import {uid,check,cents,centsInput,euros,nominalTotal,ledgerTotals,FORM_FIELDS,validateDrafts,parseBackup} from './academy-model-v7.mjs';
import {AcademyStore,academyCommand,previewFees} from './academy-controller-v7.mjs';

const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icon=name=>`<i data-lucide="${name}" aria-hidden="true"></i>`;
const button=(action,label,symbol='plus',attrs='')=>`<button type="button" data-action="academy-v7-${action}" title="${esc(label)}" ${attrs}>${icon(symbol)}<span>${esc(label)}</span></button>`;
const tool=(action,label,symbol,attrs='')=>`<button type="button" class="academy-v7-tool" data-action="academy-v7-${action}" title="${esc(label)}" aria-label="${esc(label)}" ${attrs}>${icon(symbol)}</button>`;
const attrs=(entity,id)=>`data-entity="${esc(entity)}" data-id="${esc(id)}"`;
const tabs=[['directory','Directorio'],['applications','Inscripciones'],['shop','Tienda y entradas'],['messages','Comunicación'],['fees','Cuotas']];
const names={club:'Club',categories:'Categorías',teams:'Equipos',coaches:'Entrenadores',members:'Miembros',memberships:'Pertenencia',catalog:'Catálogo',messages:'Borradores',ledger:'Cuota',plans:'Programación',applications:'Solicitud'};
const singular={members:'miembro',teams:'equipo',categories:'categoría',coaches:'entrenador'};
const statusLabel={solicitud:'Solicitud DEMO',revision:'En revisión DEMO',inscrita:'Inscripción local DEMO',cancelada:'Cancelada DEMO',demo:'Pedido / reserva DEMO',pendiente:'Pendiente DEMO',registro_demo:'Registro de pago DEMO',anulada:'Anulada DEMO'};
const empty=(label='Sin registros')=>`<p class="academy-v7-empty">${esc(label)}</p>`;
const rowTools=(entity,r)=>tool('edit',`Editar ${r.name??r.title??r.concept??names[entity]}`,'pencil',attrs(entity,r.id))+tool('remove','Eliminar registro local','trash-2',attrs(entity,r.id));
const table=(heads,rows)=>rows.length?`<div class="academy-v7-table" tabindex="0" role="region" aria-label="Tabla local de Academia"><table><thead><tr>${heads.map(h=>`<th scope="col">${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${row.map(c=>`<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`:empty();

export function mountAcademy(container,{notify=()=>{},icons=()=>{},onDirtyChange=()=>{},requestNavigate=()=>{}}={}){
  const store=new AcademyStore();let state=store.read(),destroyed=false,busy=false,notice='',noticeError=false,lastDirty=null;
  const ui={tab:'directory',directory:'members',editor:null,cart:[],month:'2026-11',query:''};
  const events=new AbortController();const urls=new Set();
  container.classList.add('academy-v7');
  const find=(entity,id)=>state[entity].find(r=>r.id===id);
  const label=(entity,id)=>find(entity,id)?.name??find(entity,id)?.title??'Sin asignar';
  const fields=()=>{if(ui.editor){const form=container.querySelector('#academy-v7-editor');if(form){for(const k of FORM_FIELDS[ui.editor.type]){const el=form.elements.namedItem(k);if(el)ui.editor.fields[k]=el.type==='checkbox'?String(el.checked):el.multiple?[...el.selectedOptions].map(o=>o.value).join(','):el.value;}}}return ui.editor?.fields;};
  const editorDirty=()=>{fields();return !!ui.editor&&(ui.editor.restored||JSON.stringify(ui.editor.fields)!==ui.editor.initial);};
  const hasPendingChanges=()=>!destroyed&&(editorDirty()||ui.cart.length>0||store.pending||busy);
  function dirty(){const value=hasPendingChanges();if(value!==lastDirty){lastDirty=value;onDirtyChange(value);}const n=container.querySelector('#academy-v7-status');if(n){n.textContent=(value?'Cambios pendientes · ':'')+store.message;n.classList.toggle('academy-v7-warning',store.blocked);}const marker=container.querySelector('#academy-v7-unsaved');if(marker)marker.hidden=!editorDirty();}
  function say(message,error=false){notice=message;noticeError=error;const node=container.querySelector('#academy-v7-notice');if(node){node.textContent=message;node.classList.toggle('academy-v7-error',error);}notify(message,error);}
  function canLeave(){if(busy){say('Espera a que termine la lectura local del respaldo.',true);return false;}return !hasPendingChanges()||window.confirm('Academia tiene cambios o candidata sin guardar. Exporta el JSON de Academia para conservarlos. ¿Salir y descartar esta versión en memoria?');}
  function closeEditor(){if(editorDirty()&&!window.confirm('¿Descartar los cambios de este formulario local?'))return false;ui.editor=null;return true;}
  function commit(action,data,success){const candidate=academyCommand(state,action,data);const result=store.write(candidate);state=result.state;say(result.saved?success+' · guardado local DEMO':store.message,!result.saved);return result.saved;}
  function draft(){fields();return validateDrafts({tab:ui.tab,editor:ui.editor?{type:ui.editor.type,id:ui.editor.id,fields:{...ui.editor.fields}}:null,cart:structuredClone(ui.cart)});}
  function draw(){
    if(destroyed)return;
    container.innerHTML=`<header class="academy-v7-header"><div><p class="academy-v7-eyebrow">Club ficticio · Adultos de 18 años o más</p><h1 tabindex="-1">Academia</h1><p>${esc(state.club.name)} <strong class="academy-v7-demo">DEMOSTRACIÓN LOCAL</strong></p></div><div class="academy-v7-tools">${tool('export','Exportar JSON completo de Academia','download')}${tool('import','Restaurar JSON de Academia','upload')}${tool('core','Ir a Planificación','calendar-days')}</div></header><p class="academy-v7-boundary">Sin admisión, cobros, reservas ni envíos reales. Importes EUR ficticios. No conectada a servicios externos.</p><p id="academy-v7-status" class="academy-v7-status" role="status"></p><p id="academy-v7-notice" class="${noticeError?'academy-v7-error':''}" role="status" aria-live="polite">${esc(notice)}</p><input type="file" id="academy-v7-import" accept="application/json,.json" hidden><nav class="academy-v7-tabs" role="tablist" aria-label="Áreas de Academia">${tabs.map(([key,title])=>`<button type="button" id="academy-v7-tab-${key}" role="tab" aria-controls="academy-v7-content" aria-selected="${key===ui.tab}" tabindex="${key===ui.tab?0:-1}" data-action="academy-v7-tab" data-tab="${key}">${title}</button>`).join('')}</nav><section id="academy-v7-content" role="tabpanel" aria-labelledby="academy-v7-tab-${ui.tab}">${ui.editor?renderEditor():''}${({directory:renderDirectory,applications:renderApplications,shop:renderShop,messages:renderMessages,fees:renderFees})[ui.tab]()}</section>`;
    icons();dirty();
  }
  function title(text,actions=''){return `<div class="academy-v7-section-heading"><h2>${esc(text)}</h2><div class="academy-v7-tools">${actions}</div></div>`;}
  function renderDirectory(){
    const entity=ui.directory;
    let rows=[],heads=[];
    if(entity==='club')return `<div class="academy-v7-subtabs">${directoryTabs()}</div>${title(state.club.name,button('edit','Editar club','pencil',attrs('club',state.club.id)))}<p>${state.categories.length} categorías adultas · ${state.teams.length} equipos · ${state.coaches.length} entrenadores ficticios · ${state.members.length} miembros ficticios</p>`;
    const query=ui.query.trim().toLocaleLowerCase('es');const filtered=state[entity].filter(r=>(r.name??'').toLocaleLowerCase('es').includes(query));
    if(entity==='members'){heads=['Miembro ficticio','Edad','Equipos','Acciones'];rows=filtered.map(r=>[esc(r.name),String(r.age),esc(state.memberships.filter(m=>m.memberId===r.id).map(m=>label('teams',m.teamId)).join(', ')||'Sin equipo'),rowTools(entity,r)]);}
    if(entity==='coaches'){heads=['Entrenador ficticio','Edad','Equipos','Acciones'];rows=filtered.map(r=>[esc(r.name),String(r.age),String(state.teams.filter(t=>t.coachId===r.id).length),rowTools(entity,r)]);}
    if(entity==='categories'){heads=['Categoría adulta','Modalidad','Equipos','Acciones'];rows=filtered.map(r=>[esc(r.name),esc(r.format),String(state.teams.filter(t=>t.categoryId===r.id).length),rowTools(entity,r)]);}
    if(entity==='teams'){heads=['Equipo','Categoría adulta','Entrenador','Miembros','Acciones'];rows=filtered.map(r=>[esc(r.name),esc(label('categories',r.categoryId)),esc(label('coaches',r.coachId)),String(state.memberships.filter(m=>m.teamId===r.id).length),rowTools(entity,r)]);}
    return `<div class="academy-v7-subtabs">${directoryTabs()}</div>${title(names[entity],button('new','Añadir '+singular[entity],'plus',`data-entity="${entity}"`))}<label class="academy-v7-search">Buscar por nombre<input id="academy-v7-search" type="search" maxlength="120" value="${esc(ui.query)}"></label><p>${filtered.length} de ${state[entity].length} registros</p>${table(heads,rows)}${['members','teams'].includes(entity)?renderMemberships():''}`;
  }
  function directoryTabs(){return ['club','members','teams','categories','coaches'].map(e=>`<button type="button" data-action="academy-v7-directory" data-entity="${e}" aria-pressed="${ui.directory===e}">${names[e]}</button>`).join('');}
  function options(entity,value,blank='Seleccionar'){return `<option value="">${blank}</option>`+state[entity].map(r=>`<option value="${esc(r.id)}" ${r.id===value?'selected':''}>${esc(r.name??r.title)}</option>`).join('');}
  function renderMemberships(){return `${title('Pertenencias locales',button('new','Asignar a equipo DEMO','user-plus','data-entity="memberships"'))}${table(['Miembro','Equipo','Acciones'],state.memberships.map(m=>[esc(label('members',m.memberId)),esc(label('teams',m.teamId)),tool('remove','Retirar pertenencia local','user-minus',attrs('memberships',m.id))]))}`;}
  function renderApplications(){return title('Inscripciones locales',button('new','Nueva solicitud','user-plus','data-entity="applications"'))+table(['Miembro ficticio','Equipo','Estado','Acciones'],state.applications.map(a=>[esc(label('members',a.memberId)),esc(label('teams',a.teamId)),esc(statusLabel[a.status]),`${['solicitud','revision'].includes(a.status)?tool('edit','Corregir solicitud','pencil',attrs('applications',a.id)):''}${a.status==='solicitud'?button('review','Pasar a revisión','clipboard-check',`data-id="${esc(a.id)}"`):''}${a.status==='revision'?button('enrol','Confirmar inscripción DEMO','user-check',`data-id="${esc(a.id)}"`):''}${a.status!=='cancelada'?tool('cancel-application','Cancelar inscripción DEMO','x',`data-id="${esc(a.id)}"`):''}`]));}
  function renderShop(){
    const lines=ui.cart.map(l=>{const c=find('catalog',l.itemId);return {...c,itemId:c.id,quantity:l.quantity};});
    return title('Catálogo ficticio',button('new','Añadir artículo o entrada','plus','data-entity="catalog"'))+table(['Artículo / entrada DEMO','Tipo','Precio EUR ficticio','Estado','Acciones'],state.catalog.map(c=>[esc(c.title),c.kind==='ticket'?'Entrada':'Producto',esc(euros(c.priceCents)),c.active?'Activo DEMO':'Inactivo',rowTools('catalog',c)+(c.active?tool('cart-add','Añadir al carrito DEMO','shopping-cart',`data-id="${esc(c.id)}"`):'')]))+title('Carrito DEMO')+table(['Concepto','Cantidad','Subtotal EUR ficticio','Acciones'],lines.map(l=>[esc(l.title),String(l.quantity),esc(euros(l.priceCents*l.quantity)),tool('cart-less','Reducir cantidad','minus',`data-id="${esc(l.id)}"`)+tool('cart-add','Aumentar cantidad','plus',`data-id="${esc(l.id)}"`)]))+(lines.length?`<div class="academy-v7-cart-total"><strong>Total nominal DEMO: ${esc(euros(nominalTotal(lines)))}</strong>${button('order','Registrar pedido / reserva DEMO','clipboard-check')}${tool('cart-clear','Vaciar carrito DEMO','x')}</div>`:'')+`<p class="academy-v7-muted">Sin checkout, pago, stock retenido, aforo garantizado ni acceso válido.</p>`+title('Pedidos y reservas locales')+table(['Registro DEMO','Detalle','Total nominal EUR ficticio','Estado','Acciones'],state.orders.map(o=>[esc(o.id.slice(0,8)),esc(o.lines.map(l=>`${l.quantity} × ${l.title} (${euros(l.priceCents)})`).join(', ')),esc(euros(o.totalCents)),esc(statusLabel[o.status]),o.status==='demo'?tool('cancel-order','Cancelar pedido / reserva DEMO','x',`data-id="${esc(o.id)}"`):'']));
  }
  function renderMessages(){return title('Borradores internos',button('new','Nuevo borrador','file-plus','data-entity="messages"'))+table(['Asunto','Ámbito ficticio','Contenido','Estado','Acciones'],state.messages.map(m=>[esc(m.title),m.teamId?esc(label('teams',m.teamId)):'Todo el club',`<span class="academy-v7-message">${esc(m.body)}</span>`,'Borrador local · no enviado',rowTools('messages',m)]));}
  function renderFees(){
    const {totals,counts}=ledgerTotals(state);
    return title('Cuotas ficticias',button('new','Nueva cuota','plus','data-entity="ledger"'))+`<dl class="academy-v7-ledger-summary">${['pendiente','registro_demo','anulada'].map(k=>`<div><dt>${statusLabel[k]} (${counts[k]} filas)</dt><dd>${esc(euros(totals[k]))}</dd></div>`).join('')}</dl><p class="academy-v7-muted">EUR ficticios. Ningún estado acredita dinero recibido o cobrado.</p>`+table(['Miembro / concepto','Mes / vencimiento','Importe EUR ficticio','Estado','Acciones y trazabilidad'],state.ledger.map(l=>[esc(label('members',l.memberId))+'<br>'+esc(l.concept),esc(l.period)+'<br>'+esc(l.dueDate),esc(euros(l.amountCents)),esc(statusLabel[l.status]),`${l.status==='pendiente'?tool('adjust','Ajustar cuota pendiente','pencil',`data-id="${esc(l.id)}"`)+button('record-demo','Registro de pago DEMO','clipboard-check',`data-id="${esc(l.id)}"`):''}${l.status!=='anulada'?tool('void-fee','Anular cuota con motivo','x',`data-id="${esc(l.id)}"`):''}<details><summary>Historial (${l.history.length})</summary>${l.history.map(h=>`<p>${esc(h.at)} · ${esc(h.action)} · ${esc(euros(h.amountCents))}<br>${esc(h.note)}</p>`).join('')}</details>`]))+title('Propuestas mensuales',button('new','Nueva programación','calendar-plus','data-entity="plans"'))+`<label class="academy-v7-month">Mes a simular<input id="academy-v7-month" type="month" min="1900-01" max="2099-12" value="${esc(ui.month)}"></label>`+table(['Concepto','Miembros ficticios','Importe / día previsto','Estado','Acciones'],state.plans.map(p=>[esc(p.concept),esc(p.memberIds.map(id=>label('members',id)).join(', ')),esc(euros(p.amountCents))+' / día '+p.dueDay,p.active?'Propuesta activa':'Inactiva',rowTools('plans',p)+(p.active?button('generate','Simular mes','calendar-check',`data-id="${esc(p.id)}"`):'')]))+`<p class="academy-v7-muted">Generación local solo por confirmación manual. No hay temporizador de cobro ni servicio remoto.</p>`;
  }
  function openEditor(type,id=null){
    if(!closeEditor())return;const r=type==='club'?state.club:id?find(type,id):null;const f={};
    for(const k of FORM_FIELDS[type])f[k]='';
    if(r){for(const k of Object.keys(f))f[k]=String(r[k]??'');if('price'in f)f.price=centsInput(r.priceCents);if('amount'in f)f.amount=centsInput(r.amountCents);if(type==='ledger')f.dueDay=String(Number(r.dueDate.slice(8)));if(type==='plans')f.memberIds=r.memberIds.join(',');}
    else {if('format'in f)f.format='f11';if('kind'in f)f.kind='product';if('active'in f)f.active='true';if('period'in f)f.period=ui.month;if('dueDay'in f)f.dueDay='1';}
    ui.editor={type,id:id??(type==='club'?state.club.id:uid()),fields:f,initial:JSON.stringify(f),restored:false};draw();container.querySelector('#academy-v7-editor input, #academy-v7-editor select')?.focus();
  }
  function renderEditor(){
    const {type,fields:f}=ui.editor;
    const textInput=(k,label,extra='')=>`<label for="academy-v7-field-${k}">${label}<input id="academy-v7-field-${k}" name="${k}" value="${esc(f[k])}" ${extra}></label>`;
    const select=(k,label,content,multiple=false)=>`<label for="academy-v7-field-${k}">${label}<select id="academy-v7-field-${k}" name="${k}" ${multiple?'multiple size="4"':''} ${k==='coachId'||k==='teamId'&&type==='messages'?'':'required'}>${content}</select></label>`;
    let html='';
    for(const k of FORM_FIELDS[type]){
      if(type==='ledger'&&(find('ledger',ui.editor.id)?!['amount','note'].includes(k):k==='note'))continue;
      if(['name','title','concept'].includes(k))html+=textInput(k,({name:'Nombre ficticio',title:'Título',concept:'Concepto DEMO'})[k],'required maxlength="120"');
      if(k==='age')html+=textInput(k,'Edad ficticia (18+)', 'type="number" min="18" max="120" step="1" required');
      if(k==='format')html+=select(k,'Modalidad adulta',['f11','f8','femenina'].map(v=>`<option value="${v}" ${f[k]===v?'selected':''}>${v==='femenina'?'Femenina adulta':v.toUpperCase()+' adultos'}</option>`).join(''));
      if(k==='kind')html+=select(k,'Tipo',['product','ticket'].map(v=>`<option value="${v}" ${f[k]===v?'selected':''}>${v==='product'?'Producto DEMO':'Entrada DEMO'}</option>`).join(''));
      if(['coachId','categoryId','teamId','memberId'].includes(k))html+=select(k,({coachId:'Entrenador ficticio',categoryId:'Categoría adulta',teamId:'Equipo',memberId:'Miembro ficticio'})[k],options(({coachId:'coaches',categoryId:'categories',teamId:'teams',memberId:'members'})[k],f[k],k==='teamId'&&type==='messages'?'Todo el club':'Sin asignar'));
      if(k==='memberIds')html+=select(k,'Miembros ficticios',state.members.map(m=>`<option value="${esc(m.id)}" ${f[k].split(',').includes(m.id)?'selected':''}>${esc(m.name)}</option>`).join(''),true);
      if(['notes','body','note'].includes(k))html+=`<label class="academy-v7-wide" for="academy-v7-field-${k}">${({notes:'Notas ficticias, no clínicas',body:'Borrador interno, sin envío',note:'Motivo del ajuste'})[k]}<textarea id="academy-v7-field-${k}" name="${k}" rows="3" maxlength="${k==='body'?6000:2000}" ${k==='notes'?'':'required'}>${esc(f[k])}</textarea></label>`;
      if(['price','amount'].includes(k))html+=textInput(k,'Importe EUR ficticio','inputmode="decimal" maxlength="10" required');
      if(k==='period')html+=textInput(k,'Mes de cuota','type="month" min="1900-01" max="2099-12" required');
      if(k==='dueDay')html+=textInput(k,'Día de vencimiento (se recorta al último día del mes)','type="number" min="1" max="31" step="1" required');
      if(k==='active')html+=`<label class="academy-v7-checkbox"><input type="checkbox" name="active" ${f[k]==='true'?'checked':''}>Activo en la demostración</label>`;
    }
    return `<section class="academy-v7-editor-section" aria-label="Edición local">${title(names[type])}<form id="academy-v7-editor" class="academy-v7-form">${html}<p id="academy-v7-unsaved" class="academy-v7-wide academy-v7-warning" role="status" hidden>Borrador con cambios sin guardar</p><div class="academy-v7-wide academy-v7-tools"><button type="submit">${icon('save')}Guardar local DEMO</button>${button('cancel-editor','Cancelar','x')}</div></form></section>`;
  }
  function submitEditor(){
    fields();const e=ui.editor,f=e.fields,type=e.type;const existing=type==='club'?state.club:find(type,e.id);let saved=false;
    if(type==='club')saved=commit('club',{name:f.name},'Club actualizado');
    else if(type==='memberships')saved=commit('assign',{memberId:f.memberId,teamId:f.teamId},'Pertenencia DEMO registrada una sola vez');
    else if(type==='applications')saved=commit(existing?'application-edit':'application',{id:e.id,memberId:f.memberId,teamId:f.teamId},'Solicitud local registrada');
    else if(type==='ledger')saved=existing?commit('adjust-fee',{id:e.id,amountCents:cents(f.amount),note:f.note},'Ajuste DEMO registrado'):commit('fee',{id:e.id,memberId:f.memberId,concept:f.concept,period:f.period,dueDay:Number(f.dueDay),amountCents:cents(f.amount)},'Cuota DEMO creada');
    else {
      let value={id:e.id};
      if(type==='categories')Object.assign(value,{name:f.name,format:f.format,adultOnly:true});
      if(type==='coaches'||type==='members')Object.assign(value,{name:f.name,age:Number(f.age),fictional:true},type==='members'?{notes:f.notes}:{});
      if(type==='teams')Object.assign(value,{name:f.name,categoryId:f.categoryId,coachId:f.coachId||null});
      if(type==='catalog')Object.assign(value,{title:f.title,kind:f.kind,priceCents:cents(f.price),active:f.active==='true'});
      if(type==='messages')Object.assign(value,{title:f.title,body:f.body,teamId:f.teamId||null,status:'borrador'});
      if(type==='plans')Object.assign(value,{concept:f.concept,amountCents:cents(f.amount),dueDay:Number(f.dueDay),memberIds:f.memberIds.split(',').filter(Boolean),active:f.active==='true'});
      saved=commit('upsert',{entity:type,value},names[type]+' actualizado');
    }
    if(saved)ui.editor=null;draw();
  }
  function download(){const blob=new Blob([JSON.stringify(store.backup(draft()),null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);urls.add(url);const a=document.createElement('a');a.href=url;a.download='terreno-academia-demo-v7.json';a.click();say('JSON completo de Academia descargado, con candidata y borradores. No incluye el espacio Planificación / core.');}
  async function importFile(file){
    if(!file)return;check(file.size<=4000000,'Respaldo demasiado grande (máximo 4 MB)');busy=true;dirty();
    try{const raw=await file.text();const b=parseBackup(raw);if(destroyed)return;
      if(!window.confirm('Restaurar SOLO Academia con datos declarados ficticios y adultos. Sustituye esta candidata y sus borradores. No incluye core ni acredita pagos. ¿Continuar?'))return;
      const result=store.restore(raw);state=result.state;ui.tab=b.drafts.tab;ui.cart=b.drafts.cart;ui.editor=b.drafts.editor?{...b.drafts.editor,initial:'',restored:true}:null;
      say(result.saved?'Respaldo de Academia restaurado localmente. Borradores recuperados siguen pendientes.':store.message,!result.saved);draw();
    }finally{busy=false;dirty();}
  }
  const on=(type,handler)=>container.addEventListener(type,handler,{signal:events.signal});
  on('submit',event=>{if(!event.target.id.startsWith('academy-v7-'))return;event.preventDefault();event.stopPropagation();try{if(!event.target.reportValidity())return;if(event.target.id==='academy-v7-editor')submitEditor();if(event.target.id==='academy-v7-assign'){const f=new FormData(event.target);if(!closeEditor())return;commit('assign',{memberId:f.get('memberId'),teamId:f.get('teamId')},'Pertenencia DEMO registrada una sola vez');draw();}}catch(error){say(error.message,true);dirty();}});
  on('input',event=>{event.stopPropagation();if(event.target.id==='academy-v7-search'){ui.query=event.target.value;const pos=event.target.selectionStart;draw();const n=container.querySelector('#academy-v7-search');n?.focus();n?.setSelectionRange(pos,pos);}else dirty();});
  on('change',event=>{
    event.stopPropagation();const input=event.target;
    if(input.id==='academy-v7-import'){
      const file=input.files[0];
      importFile(file).catch(e=>say(e.message,true)).finally(()=>{input.value='';});
      return;
    }
    if(input.id==='academy-v7-month')ui.month=input.value;
    dirty();
  });
  on('keydown',event=>{event.stopPropagation();if(event.target.matches('[role="tab"]')&&['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){event.preventDefault();const current=tabs.findIndex(([key])=>key===ui.tab);const next=event.key==='Home'?0:event.key==='End'?tabs.length-1:(current+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;container.querySelector('#academy-v7-tab-'+tabs[next][0])?.click();container.querySelector('#academy-v7-tab-'+ui.tab)?.focus();}});
  on('click',event=>{
    event.stopPropagation();const b=event.target.closest('[data-action^="academy-v7-"]');if(!b||!container.contains(b))return;
    const action=b.dataset.action.slice(11),id=b.dataset.id,entity=b.dataset.entity;
    try{
      if(action==='export'){download();return;}
      if(action==='import'){container.querySelector('#academy-v7-import').click();return;}
      if(action==='core'){requestNavigate('week');return;}
      if(action==='tab'){if(!closeEditor())return;ui.tab=b.dataset.tab;draw();return;}
      if(action==='directory'){if(!closeEditor())return;ui.directory=entity;ui.query='';draw();return;}
      if(action==='new'||action==='edit'){openEditor(entity,action==='edit'?id:null);return;}
      if(action==='cancel-editor'){if(closeEditor())draw();return;}
      if(action==='cart-add'){const c=find('catalog',id);check(c?.active,'Artículo no disponible');const old=ui.cart.find(l=>l.itemId===id);const candidate=structuredClone(ui.cart);if(old)candidate.find(l=>l.itemId===id).quantity++;else candidate.push({itemId:id,quantity:1});nominalTotal(candidate.map(l=>({...l,priceCents:find('catalog',l.itemId).priceCents})));ui.cart=candidate;fields();draw();return;}
      if(action==='cart-less'){fields();ui.cart=ui.cart.map(l=>l.itemId===id?{...l,quantity:l.quantity-1}:l).filter(l=>l.quantity>0);draw();return;}
      if(action==='cart-clear'){if(!window.confirm('¿Vaciar el carrito de demostración?'))return;fields();ui.cart=[];draw();return;}
      if(action==='order'){if(!closeEditor())return;commit('order',{cart:ui.cart},'Pedido / reserva DEMO registrado, no compra ni acceso real');ui.cart=[];draw();return;}
      if(action==='adjust'){openEditor('ledger',id);return;}
      if(!closeEditor())return;
      if(action==='remove'){if(!window.confirm('¿Eliminar este registro SOLO de la demostración local? Las relaciones existentes impedirán perder referencias.'))return;commit('remove',{entity,id},'Registro local eliminado');}
      if(['review','enrol','cancel-application','cancel-order'].includes(action)){
        if(['enrol','cancel-application','cancel-order'].includes(action)&&!window.confirm('¿Confirmar este cambio exclusivamente local de demostración?'))return;
        commit(action,{id},'Estado DEMO actualizado');
      }
      if(action==='record-demo'){if(!window.confirm('Crear registro de pago DEMO. NO acredita cobro ni dinero recibido. ¿Continuar?'))return;commit(action,{id},'Registro manual de demostración creado, sin pago real');}
      if(action==='void-fee'){const note=window.prompt('Motivo de anulación de la cuota DEMO:');if(note===null)return;commit(action,{id,note},'Cuota DEMO anulada, historial conservado');}
      if(action==='generate'){const p=previewFees(state,id,ui.month);if(!p.entries.length){say(`Sin filas nuevas: ${p.skipped} ya existen para ese miembro, concepto y mes.`);draw();return;}if(!window.confirm(`SIMULACIÓN LOCAL: ${p.entries.length} cuotas, ${euros(p.totalCents)} ficticios. Vencimiento ${p.dueDate}, ${p.skipped} duplicados omitidos. No se cobra. ¿Generar filas?`))return;commit('generate-fees',{planId:id,period:ui.month},`${p.entries.length} cuotas ficticias generadas`);}
      draw();
    }catch(error){say(error.message,true);dirty();}
  });
  window.addEventListener('storage',event=>{if(event.key===null||event.key==='terreno.academy.demo.v7'){store.conflict();say(store.message,true);dirty();}},{signal:events.signal});
  function destroy(){if(destroyed)return;destroyed=true;events.abort();for(const url of urls)URL.revokeObjectURL(url);urls.clear();onDirtyChange(false);container.replaceChildren();container.classList.remove('academy-v7');}
  draw();return {canLeave,hasPendingChanges,destroy};
}
