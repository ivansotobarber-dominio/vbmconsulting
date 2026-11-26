import {ACADEMY_KEY,check,uid,demoAcademy,validateAcademy,validateDrafts,parseBackup,ledgerKey,dueDate,nominalTotal} from './academy-model-v7.mjs';

export class AcademyStore {
  constructor(storage){try{this.storage=storage??globalThis.localStorage;}catch{this.storage=null;}this.raw=null;this.persisted=null;this.blocked=false;this.pending=false;this.message='Demostración en memoria · aún sin guardado local';this.unreadableSource=null;}
  read(){
    try{this.raw=this.storage.getItem(ACADEMY_KEY);if(this.raw!==null){check(this.raw.length<=2000000,'Almacenamiento demasiado grande');this.state=validateAcademy(JSON.parse(this.raw));this.persisted=structuredClone(this.state);this.message='Guardado local de demostración';}else this.state=demoAcademy();}
    catch{this.state=demoAcademy();this.blocked=true;this.unreadableSource=this.raw;this.message='No se pudo leer Academia. Fuente conservada sin sobrescribir. Demostración temporal en memoria; exporta antes de restaurar.';}
    return this.state;
  }
  write(input){
    this.state=validateAcademy(input);this.pending=true;
    if(this.blocked)return {state:this.state,saved:false};
    try{
      check(this.storage.getItem(ACADEMY_KEY)===this.raw,'Conflicto: otra pestaña ha cambiado Academia');
      const next=validateAcademy({...this.state,revision:Math.max(this.state.revision,this.persisted?.revision??0)+1,updatedAt:new Date().toISOString()});
      const raw=JSON.stringify(next);check(raw.length<=2000000,'Almacenamiento demasiado grande');
      this.storage.setItem(ACADEMY_KEY,raw);
      check(this.storage.getItem(ACADEMY_KEY)===raw,'Conflicto de relectura: no se confirma el guardado');
      this.state=next;this.raw=raw;this.persisted=structuredClone(next);this.pending=false;this.message='Guardado local de demostración';return {state:next,saved:true};
    }catch(error){this.blocked=true;this.message=(error.name==='QuotaExceededError'?'Cuota local agotada':error.message||'Almacenamiento bloqueado')+'. Candidata y borradores en memoria exportable, no guardados.';return {state:this.state,saved:false};}
  }
  conflict(){this.blocked=true;this.message='Conflicto entre pestañas. No se sobrescribe la versión ajena. Exporta tu candidata y borradores antes de recargar.';}
  backup(drafts){return {format:'terreno.academy.backup',version:7,mode:'demonstration',storageStatus:this.blocked?'blocked':this.pending||this.raw===null?'memory':'saved',candidate:structuredClone(this.state),persisted:structuredClone(this.persisted),drafts:validateDrafts(drafts),unreadableSource:this.unreadableSource};}
  restore(raw){const b=parseBackup(raw);check(!this.blocked,'Almacenamiento bloqueado: exporta y recarga antes de restaurar; no se sobrescribe una fuente corrupta o ajena');const result=this.write(b.candidate);return {...result,drafts:b.drafts};}
}

const pick=(rows,id)=>{const r=rows.find(r=>r.id===id);check(r,'Registro no disponible');return r;};
const editable=['categories','coaches','teams','members','catalog','messages','plans'];
function upsert(rows,value){const i=rows.findIndex(r=>r.id===value.id);if(i<0)rows.push(value);else rows[i]=value;}
function history(action,amountCents,note){return {at:new Date().toISOString(),action,amountCents,note};}
function newFee(data){return {id:data.id??uid(),memberId:data.memberId,concept:data.concept.trim(),period:data.period,dueDate:dueDate(data.period,data.dueDay),amountCents:data.amountCents,status:'pendiente',history:[history('creada',data.amountCents,'Cuota ficticia creada manualmente')]};}
export function previewFees(state,planId,month){const plan=pick(state.plans,planId);check(plan.active,'Propuesta inactiva');const entries=plan.memberIds.map(memberId=>newFee({memberId,concept:plan.concept,period:month,dueDay:plan.dueDay,amountCents:plan.amountCents}));const pending=entries.filter(e=>!state.ledger.some(l=>ledgerKey(l)===ledgerKey(e)));return {entries:pending,skipped:entries.length-pending.length,dueDate:dueDate(month,plan.dueDay),totalCents:pending.reduce((n,l)=>n+l.amountCents,0)};}
export function academyCommand(input,action,data={}){
  const s=validateAcademy(input);
  if(action==='club')s.club.name=data.name;
  else if(action==='upsert'){
    check(editable.includes(data.entity),'Colección no editable');
    // Catalog price changes deliberately do not rewrite historical order snapshots.
    upsert(s[data.entity],structuredClone(data.value));
  }else if(action==='remove'){
    check([...editable,'memberships'].includes(data.entity),'Colección no eliminable');pick(s[data.entity],data.id);s[data.entity]=s[data.entity].filter(r=>r.id!==data.id);
  }else if(action==='assign'){
    if(!s.memberships.some(m=>m.memberId===data.memberId&&m.teamId===data.teamId))s.memberships.push({id:uid(),memberId:data.memberId,teamId:data.teamId});
  }else if(action==='application'){
    check(!s.applications.some(a=>a.status!=='cancelada'&&a.memberId===data.memberId&&a.teamId===data.teamId),'Ya existe solicitud activa para ese miembro y equipo');
    check(!s.memberships.some(m=>m.memberId===data.memberId&&m.teamId===data.teamId),'El miembro ya pertenece al equipo');
    s.applications.push({id:data.id??uid(),memberId:data.memberId,teamId:data.teamId,status:'solicitud'});
  }else if(action==='application-edit'){
    const a=pick(s.applications,data.id);check(['solicitud','revision'].includes(a.status),'Solo se corrigen solicitudes en curso');a.memberId=data.memberId;a.teamId=data.teamId;a.status='solicitud';
  }else if(action==='review'){
    const a=pick(s.applications,data.id);check(a.status==='solicitud','Primero se necesita una solicitud');a.status='revision';
  }else if(action==='enrol'){
    const a=pick(s.applications,data.id);check(['revision','inscrita'].includes(a.status),'Primero revisa manualmente la solicitud');
    a.status='inscrita';if(!s.memberships.some(m=>m.memberId===a.memberId&&m.teamId===a.teamId))s.memberships.push({id:uid(),memberId:a.memberId,teamId:a.teamId});
  }else if(action==='cancel-application'){
    const a=pick(s.applications,data.id);if(a.status==='inscrita')s.memberships=s.memberships.filter(m=>!(m.memberId===a.memberId&&m.teamId===a.teamId));a.status='cancelada';
  }else if(action==='order'){
    check(Array.isArray(data.cart)&&data.cart.length>0,'Carrito vacío');const lines=data.cart.map(l=>{const c=pick(s.catalog,l.itemId);check(c.active,'Artículo inactivo');return {itemId:c.id,title:c.title,kind:c.kind,priceCents:c.priceCents,quantity:l.quantity};});
    s.orders.push({id:data.id??uid(),createdAt:new Date().toISOString(),status:'demo',lines,totalCents:nominalTotal(lines)});
  }else if(action==='cancel-order')pick(s.orders,data.id).status='cancelada';
  else if(action==='fee')s.ledger.push(newFee(data));
  else if(action==='adjust-fee'){
    const l=pick(s.ledger,data.id);check(l.status==='pendiente','Solo se ajusta una cuota pendiente');check(typeof data.note==='string'&&data.note.trim(),'Indica motivo del ajuste');l.amountCents=data.amountCents;l.history.push(history('ajuste',data.amountCents,data.note.trim()));
  }else if(action==='record-demo'){
    const l=pick(s.ledger,data.id);check(l.status==='pendiente','Solo se registra una cuota pendiente');l.status='registro_demo';l.history.push(history('registro_demo',l.amountCents,'Registro manual simulado, no acredita pago real'));
  }else if(action==='void-fee'){
    const l=pick(s.ledger,data.id);check(l.status!=='anulada','La cuota ya está anulada');check(typeof data.note==='string'&&data.note.trim(),'Indica motivo de anulación');l.status='anulada';l.history.push(history('anulada',l.amountCents,data.note.trim()));
  }else if(action==='generate-fees')s.ledger.push(...previewFees(s,data.planId,data.period).entries);
  else throw new Error('Acción de Academia no disponible');
  return validateAcademy(s);
}
