// Profesionales y su vinculación con pacientes.
import { state } from '../state.js';
import { PP_TABLE, P_TABLE, sb } from '../supabase.js';
import { ICO_DEL, ICO_EDIT, ICO_EYE } from '../constants.js';
import { toast } from '../ui.js';
import { esc } from '../utils.js';
import { buildProfMultiList } from './comun.js';
import { actions } from '../events.js';

export async function loadProfesionales() {
  const { data, error } = await sb.from(P_TABLE).select('*').order('apellido');
  if (error) { toast(`Error cargando profesionales: ${error.message}`,'error'); return; }
  state.profesionales = data || [];
  document.getElementById('prof-count').textContent = `${state.profesionales.length} profesional${state.profesionales.length!==1?'es':''}`;
  buildProfMultiList();
}

let espFiltro = '';
const pacCounts = new Map();

/* Se llama al entrar a la vista o tras cambios: vuelve a consultar la cantidad de pacientes. */
export function renderProfesionales() {
  pacCounts.clear();
  drawProfesionales();
}

function drawProfesionales() {
  const grid = document.getElementById('prof-grid');
  const chips = document.getElementById('prof-esp-chips');
  const todos = state.profesionales;
  if (!todos.length) {
    chips.innerHTML = '';
    grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1;"><div class="empty-title">Sin profesionales</div><div class="empty-text">Agregá el primer profesional con el botón Nuevo.</div></div>';
    return;
  }
  /* Filtro por especialidad (se arma con las especialidades existentes) */
  const esps = new Map();
  todos.forEach(p => {
    const label = String(p.especialidad || '').trim(); if (!label) return;
    const k = label.toLowerCase(), cur = esps.get(k);
    if (cur) cur.n++; else esps.set(k, { label, n: 1 });
  });
  if (espFiltro && !esps.has(espFiltro)) espFiltro = '';
  const chip = (key, label, n) => `<button class="chip${espFiltro === key ? ' active' : ''}" data-click="filterProfEsp" data-click-args="${esc(JSON.stringify([key]))}">${esc(label)}<span class="chip-n">${n}</span></button>`;
  chips.innerHTML = esps.size > 1 ? chip('', 'Todas', todos.length) + [...esps].map(([k, v]) => chip(k, v.label, v.n)).join('') : '';
  chips.style.display = esps.size > 1 ? '' : 'none';

  const lista = espFiltro ? todos.filter(p => String(p.especialidad || '').trim().toLowerCase() === espFiltro) : todos;
  grid.innerHTML = lista.map(p => {
    const inits = ((p.apellido||'')[0]||'').toUpperCase()+((p.nombres||'')[0]||'').toUpperCase();
    const args = esc(JSON.stringify([p.id]));
    const fila = (lbl, v) => String(v || '').trim() ? `<div class="pc-row"><span class="pc-lbl">${lbl}</span><span class="pc-val">${esc(v)}</span></div>` : '';
    const n = pacCounts.get(p.id);
    return `<div class="prof-card">
      <div class="prof-card-top">
        <div class="prof-avatar">${esc(inits)}</div>
        <div class="prof-card-id">
          <span class="prof-link" data-click="openProfDet" data-click-args="${args}">${esc(p.apellido)}, ${esc(p.nombres)}</span>
          <div class="prof-card-esp">${esc(p.especialidad) || 'Sin especialidad'}</div>
        </div>
      </div>
      <div class="prof-card-rows">${fila('Matrícula', p.matricula)}${fila('Teléfono', p.telefono)}${fila('Mail', p.mail)}</div>
      <div class="prof-card-foot">
        <span class="pc-count" id="prof-pac-count-${p.id}">${n === undefined ? '…' : n + (n === 1 ? ' paciente' : ' pacientes')}</span>
        <div class="act-row">
          <button class="ic-btn ic-btn-blue" data-click="openProfDet" data-click-args="${args}" title="Ver"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICO_EYE}</svg></button>
          <button class="ic-btn ic-btn-green admin-only" data-click="openProfForm" data-click-args="${args}" title="Editar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICO_EDIT}</svg></button>
          <button class="ic-btn ic-btn-red admin-only" data-click="deleteProfesional" data-click-args="${args}" title="Eliminar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICO_DEL}</svg></button>
        </div>
      </div>
    </div>`;
  }).join('');
  // Cantidad de pacientes por profesional: se consulta una sola vez y luego se reutiliza
  lista.filter(p => !pacCounts.has(p.id)).forEach(p => loadProfPacCount(p.id));
}

actions.filterProfEsp = function(key) { espFiltro = key; drawProfesionales(); };

async function loadProfPacCount(profId) {
  const { count } = await sb.from(PP_TABLE).select('*',{count:'exact',head:true}).eq('profesional_id', profId);
  const n = count || 0;
  pacCounts.set(profId, n);
  const el = document.getElementById(`prof-pac-count-${profId}`);
  if (el) el.textContent = n + (n === 1 ? ' paciente' : ' pacientes');
}

actions.openProfForm = function(id=null) {
  if (!state.isAdmin) return;
  state.editProfId = id || null;
  ['pf-apellido','pf-nombres','pf-especialidad','pf-matricula','pf-telefono','pf-mail','pf-domicilio','pf-ciudad','pf-observaciones']
    .forEach(fid => { const e=document.getElementById(fid); if(e) e.value=''; });
  document.getElementById('prof-form-title').textContent = id ? 'Editar Profesional' : 'Nuevo Profesional';
  if (id) {
    const p = state.profesionales.find(x=>x.id===id);
    if (p) {
      document.getElementById('pf-apellido').value     = p.apellido||'';
      document.getElementById('pf-nombres').value      = p.nombres||'';
      document.getElementById('pf-especialidad').value = p.especialidad||'';
      document.getElementById('pf-matricula').value    = p.matricula||'';
      document.getElementById('pf-telefono').value     = p.telefono||'';
      document.getElementById('pf-mail').value         = p.mail||'';
      document.getElementById('pf-domicilio').value    = p.domicilio||'';
      document.getElementById('pf-ciudad').value       = p.ciudad||'';
      document.getElementById('pf-observaciones').value= p.observaciones||'';
    }
  }
  document.getElementById('prof-form-overlay').classList.add('open');
};

actions.closeProfForm = function() { document.getElementById('prof-form-overlay').classList.remove('open'); state.editProfId=null; };

actions.closeProfFormIfBg = function(e) { if(e.target===document.getElementById('prof-form-overlay')) actions.closeProfForm(); };

actions.saveProfesional = async function() {
  if (!state.isAdmin) return;
  const apellido = document.getElementById('pf-apellido').value.trim();
  const nombres  = document.getElementById('pf-nombres').value.trim();
  if (!apellido||!nombres) { toast('Apellido y Nombres son obligatorios.','error'); return; }
  const payload = {
    apellido, nombres,
    especialidad:  document.getElementById('pf-especialidad').value.trim()||null,
    matricula:     document.getElementById('pf-matricula').value.trim()||null,
    telefono:      document.getElementById('pf-telefono').value.trim()||null,
    mail:          document.getElementById('pf-mail').value.trim()||null,
    domicilio:     document.getElementById('pf-domicilio').value.trim()||null,
    ciudad:        document.getElementById('pf-ciudad').value.trim()||null,
    observaciones: document.getElementById('pf-observaciones').value.trim()||null,
  };
  const btn=document.getElementById('btn-prof-save'),txt=document.getElementById('btn-prof-save-txt');
  btn.disabled=true; txt.textContent='Guardando…';
  let error;
  if (state.editProfId) { ({error}=await sb.from(P_TABLE).update(payload).eq('id',state.editProfId)); }
  else { ({error}=await sb.from(P_TABLE).insert(payload)); }
  btn.disabled=false; txt.textContent='Guardar';
  if (error) { toast(`Error: ${error.message}`,'error'); return; }
  toast(state.editProfId?'Profesional actualizado.':'Profesional registrado.','success');
  actions.closeProfForm();
  await loadProfesionales();
  renderProfesionales();
};

actions.deleteProfesional = async function(id) {
  if (!state.isAdmin) return;
  if (!confirm('¿Eliminar este profesional? Se desvinculará de todos sus pacientes.')) return;
  await sb.from(PP_TABLE).delete().eq('profesional_id',id);
  const { error } = await sb.from(P_TABLE).delete().eq('id',id);
  if (error) { toast(`Error: ${error.message}`,'error'); return; }
  toast('Profesional eliminado.','info');
  await loadProfesionales();
  renderProfesionales();
};

actions.openProfDet = function(id) { location.href='profesional.html?id='+id; };

actions.closeProfDet=function(){ document.getElementById('prof-det-overlay')?.classList.remove('open'); };

actions.closeProfDetIfBg=function(e){ if(e.target===document.getElementById('prof-det-overlay')) actions.closeProfDet(); };
