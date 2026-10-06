// Renderizado de tablas, dashboard y paginación.
import { state } from '../state.js';
import { ICO_DEL, ICO_DOC, ICO_EDIT, ICO_EYE, ICO_FLASK, ICO_USERS, PER, TAGS } from '../constants.js';
import { esc } from '../utils.js';
import { applyFilters } from './pacientes.js';
import { actions } from '../events.js';

export function renderAll(){ applyFilters(); updateStats(); renderDash(); renderMain(); renderHistoria(); renderEstudios(); document.getElementById('badge-total').textContent=state.pacientes.length; }

function updateStats(){
  document.getElementById('s-total').textContent=state.pacientes.length;
  document.getElementById('s-historia').textContent=state.pacientes.filter(p=>p.historia_clinica).length;
  document.getElementById('s-estudios').textContent=state.pacientes.filter(p=>p.estudios_complementarios).length;
  document.getElementById('s-patologias').textContent=state.pacientes.filter(p=>p.patologia).length;
}

function tagC(id){ let n=0; if(id) for(let i=0;i<Math.min(id.length,8);i++) n+=id.charCodeAt(i); return TAGS[n%TAGS.length]; }

function initials(p){ return ((p.apellido||'')[0]||'').toUpperCase()+((p.nombres||'')[0]||'').toUpperCase(); }

function hl(text){ if(!text) return '—'; const t=String(text); if(!state.searchQuery) return esc(t); const re=new RegExp('('+state.searchQuery.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+')','gi'); return t.split(re).map((s,i)=>i%2?'<mark style="background:rgba(20,166,150,.3);color:var(--text);border-radius:2px;padding:0 1px">'+esc(s)+'</mark>':esc(s)).join(''); }

export function emptyRow(cols,ico,title,text){ return `<tr><td colspan="${cols}"><div class="empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round">${ico}</svg><div class="empty-title">${title}</div><div class="empty-text">${text}</div></div></td></tr>`; }

function patientCell(p){ return `<td><div style="display:flex;align-items:center;gap:10px;"><div style="width:30px;height:30px;border-radius:7px;flex-shrink:0;background:linear-gradient(135deg,var(--accent),var(--accent2));display:grid;place-items:center;font-size:11px;font-weight:600;color:#fff;">${esc(initials(p))}</div><div><div class="td-p">${hl(p.apellido)}, ${hl(p.nombres)}</div><div class="td-s">${esc(p.mail)||''}</div></div></div></td>`; }

function statusCell(p){
  const active = p.activo !== false;
  return `<td><div style="display:flex;align-items:center;gap:8px;">
    <label class="pac-switch" title="${active?'Deshabilitar paciente':'Habilitar paciente'}">
      <input type="checkbox" ${active?'checked':''} data-change="toggleActivo" data-change-args="${esc(JSON.stringify([p.id, "$checked", "$el"]))}">
      <span class="slider"></span>
    </label>
    <span class="status-badge ${active?'active':'inactive'}" id="status-badge-${p.id}">${active?'Activo':'Inactivo'}</span>
  </div></td>`;
}

function actionsCell(id){ return `<td><div class="act-row">
  <button class="ic-btn ic-btn-blue"  data-click="openDet" data-click-args="${esc(JSON.stringify([id]))}"          title="Ver ficha"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">${ICO_EYE}</svg></button>
  <button class="ic-btn" style="background:rgba(139,92,246,.12);color:#a78bfa;" data-click="openEntrada" data-click-args="${esc(JSON.stringify([id]))}" title="Nueva entrada del día"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" width="14" height="14"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></button>
  <button class="ic-btn ic-btn-amber" data-click="printPaciente" data-click-args="${esc(JSON.stringify([id]))}"    title="Imprimir ficha"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="6,9 6,2 18,2 18,9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg></button>
  <button class="ic-btn ic-btn-green" data-click="openForm" data-click-args="${esc(JSON.stringify([id]))}"         title="Editar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">${ICO_EDIT}</svg></button>
  ${state.isAdmin ? `<button class="ic-btn ic-btn-red" data-click="askDelete" data-click-args="${esc(JSON.stringify([id]))}" title="Eliminar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">${ICO_DEL}</svg></button>` : ''}
</div></td>`; }

export function renderDash(){ const list=state.filteredList.slice(0,6),tb=document.getElementById('dash-tbody'); if(!list.length){tb.innerHTML=emptyRow(6,ICO_USERS,'Sin pacientes','Registrá el primer paciente');return;} tb.innerHTML=list.map(p=>`<tr>${patientCell(p)}<td><span class="td-m">${esc(p.dni)||'—'}</span></td><td>${esc(p.patologia)?`<span class="tag ${tagC(p.id)}">${hl(p.patologia)}</span>`:'<span style="color:var(--text-muted)">—</span>'}</td><td>${esc(p.medico_tratante)?hl(p.medico_tratante):'<span style="color:var(--text-muted)">—</span>'}</td><td>${esc(p.ciudad)?hl(p.ciudad):'<span style="color:var(--text-muted)">—</span>'}</td>${actionsCell(p.id)}</tr>`).join(''); }

export function renderMain(){
  const total=state.filteredList.length,pages=Math.max(1,Math.ceil(total/PER));
  state.page=Math.min(state.page,pages);
  const slice=state.filteredList.slice((state.page-1)*PER,state.page*PER);
  document.getElementById('tbl-count').textContent=`${total} paciente${total!==1?'s':''}${state.searchQuery?' (búsqueda activa)':''}`;
  document.getElementById('pg-info').textContent=`${slice.length} de ${total}`;
  const banner=document.getElementById('result-banner');
  banner.innerHTML=state.searchQuery&&total>0?`<div class="result-banner"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>${total} resultado${total!==1?'s':''} para "<strong>${esc(state.searchQuery)}</strong>" — búsqueda en todos los campos</div>`:'';
  const tb=document.getElementById('main-tbody');
  if(!slice.length){tb.innerHTML=emptyRow(8,ICO_USERS,state.searchQuery?'Sin resultados':'Sin pacientes',state.searchQuery?`No hay coincidencias para "${esc(state.searchQuery)}"`:'Registrá el primer paciente');}
  else{tb.innerHTML=slice.map(p=>`<tr>${patientCell(p)}<td><span class="td-m">${hl(p.dni)||'—'}</span></td><td>${esc(p.telefonos)?hl(p.telefonos):'<span style="color:var(--text-muted)">—</span>'}</td><td>${esc(p.patologia)?`<span class="tag ${tagC(p.id)}">${hl(p.patologia)}</span>`:'<span style="color:var(--text-muted)">—</span>'}</td><td>${esc(p.medico_tratante)?hl(p.medico_tratante):'<span style="color:var(--text-muted)">—</span>'}</td><td>${esc(p.ciudad)?hl(p.ciudad):'<span style="color:var(--text-muted)">—</span>'}</td>${statusCell(p)}${actionsCell(p.id)}</tr>`).join('');}
  renderPagination(pages,total);
}

function renderPagination(pages,total){
  const c=document.getElementById('pg-btns'); if(!total){c.innerHTML='';return;}
  const arr=(d,n)=>`<button class="pg-btn" data-click="goPage" data-click-args="${esc(JSON.stringify([n]))}" ${(d==='p'&&state.page===1)||(d==='n'&&state.page===pages)?'disabled':''}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" width="12" height="12"><polyline points="${d==='p'?'15,18 9,12 15,6':'9,18 15,12 9,6'}"/></svg></button>`;
  let h=arr('p',state.page-1);
  for(let i=1;i<=pages;i++){ if(pages<=7||i===1||i===pages||Math.abs(i-state.page)<=1) h+=`<button class="pg-btn ${i===state.page?'active':''}" data-click="goPage" data-click-args="${esc(JSON.stringify([i]))}">${i}</button>`; else if(Math.abs(i-state.page)===2) h+=`<button class="pg-btn" disabled>…</button>`; }
  h+=arr('n',state.page+1); c.innerHTML=h;
}

actions.goPage=function(n){ const pages=Math.max(1,Math.ceil(state.filteredList.length/PER)); if(n<1||n>pages) return; state.page=n; renderMain(); };

export function renderHistoria(){ const list=state.pacientes.filter(p=>p.historia_clinica||p.epicrisis||p.diagnostico_medico),tb=document.getElementById('hist-tbody'); tb.innerHTML=!list.length?emptyRow(5,ICO_DOC,'Sin historias clínicas','Completá la historia clínica al editar un paciente'):list.map(p=>`<tr><td class="td-p">${esc(p.apellido)}, ${esc(p.nombres)}</td><td style="max-width:200px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:12px;">${esc(p.historia_clinica)||'—'}</td><td style="max-width:160px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:12px;">${esc(p.epicrisis)||'—'}</td><td style="max-width:160px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:12px;">${esc(p.diagnostico_medico)||'—'}</td><td><button class="ic-btn ic-btn-blue" data-click="openDet" data-click-args="${esc(JSON.stringify([p.id]))}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">${ICO_EYE}</svg></button></td></tr>`).join(''); }

export function renderEstudios(){ const list=state.pacientes.filter(p=>p.estudios_complementarios||p.observaciones),tb=document.getElementById('est-tbody'); tb.innerHTML=!list.length?emptyRow(4,ICO_FLASK,'Sin estudios cargados','Cargá estudios al editar un paciente'):list.map(p=>`<tr><td class="td-p">${esc(p.apellido)}, ${esc(p.nombres)}</td><td style="max-width:260px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:12px;">${esc(p.estudios_complementarios)||'—'}</td><td style="max-width:200px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:12px;">${esc(p.observaciones)||'—'}</td><td><button class="ic-btn ic-btn-blue" data-click="openDet" data-click-args="${esc(JSON.stringify([p.id]))}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">${ICO_EYE}</svg></button></td></tr>`).join(''); }
