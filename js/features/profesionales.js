// Profesionales y su vinculación con pacientes.
import { state } from '../state.js';
import { PP_TABLE, P_TABLE, sb } from '../supabase.js';
import { ICO_DEL, ICO_EDIT, ICO_EYE } from '../constants.js';
import { toast } from '../ui.js';
import { esc } from '../utils.js';
import { emptyRow } from './render.js';

export async function loadProfesionales() {
  const { data, error } = await sb.from(P_TABLE).select('*').order('apellido');
  if (error) { toast(`Error cargando profesionales: ${error.message}`,'error'); return; }
  state.profesionales = data || [];
  document.getElementById('prof-count').textContent = `${state.profesionales.length} profesional${state.profesionales.length!==1?'es':''}`;
  buildProfMultiList();
}

export function renderProfesionales() {
  const tb = document.getElementById('prof-tbody');
  if (!state.profesionales.length) {
    tb.innerHTML = emptyRow(6,
      `<path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>`,
      'Sin profesionales', 'Agregá el primer profesional médico');
    return;
  }
  tb.innerHTML = state.profesionales.map(p => {
    const inits = ((p.apellido||'')[0]||'').toUpperCase()+((p.nombres||'')[0]||'').toUpperCase();
    return `<tr>
      <td><div style="display:flex;align-items:center;gap:10px;">
        <div class="prof-avatar">${esc(inits)}</div>
        <div>
          <div class="td-p">
            <span class="prof-link" onclick="openProfDet('${p.id}')">${esc(p.apellido)}, ${esc(p.nombres)}</span>
          </div>
          <div class="td-s">${esc(p.mail)||''}</div>
        </div>
      </div></td>
      <td>${esc(p.especialidad)||'<span style="color:var(--text-muted)">—</span>'}</td>
      <td><span class="td-m">${esc(p.matricula)||'—'}</span></td>
      <td>${esc(p.telefono)||'<span style="color:var(--text-muted)">—</span>'}</td>
      <td><span id="prof-pac-count-${p.id}" class="td-m">…</span></td>
      <td><div class="act-row">
        <button class="ic-btn ic-btn-blue" onclick="openProfDet('${p.id}')" title="Ver"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">${ICO_EYE}</svg></button>
        <button class="ic-btn ic-btn-green admin-only" onclick="openProfForm('${p.id}')" title="Editar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">${ICO_EDIT}</svg></button>
        <button class="ic-btn ic-btn-red admin-only" onclick="deleteProfesional('${p.id}')" title="Eliminar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">${ICO_DEL}</svg></button>
      </div></td>
    </tr>`;
  }).join('');
  // Load patient counts asynchronously
  state.profesionales.forEach(p => loadProfPacCount(p.id));
}

async function loadProfPacCount(profId) {
  const { count } = await sb.from(PP_TABLE).select('*',{count:'exact',head:true}).eq('profesional_id', profId);
  const el = document.getElementById(`prof-pac-count-${profId}`);
  if (el) el.textContent = `${count||0} pac.`;
}

window.openProfForm = function(id=null) {
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

window.closeProfForm = function() { document.getElementById('prof-form-overlay').classList.remove('open'); state.editProfId=null; };

window.closeProfFormIfBg = function(e) { if(e.target===document.getElementById('prof-form-overlay')) window.closeProfForm(); };

window.saveProfesional = async function() {
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
  window.closeProfForm();
  await loadProfesionales();
  renderProfesionales();
};

window.deleteProfesional = async function(id) {
  if (!state.isAdmin) return;
  if (!confirm('¿Eliminar este profesional? Se desvinculará de todos sus pacientes.')) return;
  await sb.from(PP_TABLE).delete().eq('profesional_id',id);
  const { error } = await sb.from(P_TABLE).delete().eq('id',id);
  if (error) { toast(`Error: ${error.message}`,'error'); return; }
  toast('Profesional eliminado.','info');
  await loadProfesionales();
  renderProfesionales();
};

window.openProfDet = function(id) { location.href='profesional.html?id='+id; };

window.closeProfDet=function(){ document.getElementById('prof-det-overlay')?.classList.remove('open'); };

window.closeProfDetIfBg=function(e){ if(e.target===document.getElementById('prof-det-overlay')) window.closeProfDet(); };

export function buildProfMultiList(filter='') {
  const list = document.getElementById('prof-multi-list');
  if (!list) return;
  const q = filter.toLowerCase();
  const items = state.profesionales.filter(p =>
    !q || `${p.apellido} ${p.nombres} ${p.especialidad||''}`.toLowerCase().includes(q)
  );
  if (!items.length) {
    list.innerHTML='<div style="padding:10px;font-size:12px;color:var(--text-muted)">Sin resultados.</div>';
    return;
  }
  list.innerHTML = items.map(p => {
    const sel = state.selectedProfIds.includes(p.id);
    return `<label class="prof-multi-item ${sel?'selected':''}" id="pmi-${p.id}">
      <input type="checkbox" ${sel?'checked':''} onchange="toggleProfSel('${p.id}',this.checked)">
      <div>
        <div style="font-weight:500;color:var(--text)">${esc(p.apellido)}, ${esc(p.nombres)}</div>
        ${esc(p.especialidad)?`<div style="font-size:11px;color:var(--text-muted)">${esc(p.especialidad)}</div>`:''}
      </div>
    </label>`;
  }).join('');
}

window.filterProfMulti = function(val) { buildProfMultiList(val); };

window.toggleProfSel = function(profId, checked) {
  if (checked && !state.selectedProfIds.includes(profId)) state.selectedProfIds.push(profId);
  else if (!checked) state.selectedProfIds = state.selectedProfIds.filter(x=>x!==profId);
  // Update item style
  const item = document.getElementById(`pmi-${profId}`);
  if (item) item.classList.toggle('selected', checked);
  renderProfTags();
};

export function renderProfTags() {
  const cont = document.getElementById('prof-selected-tags');
  if (!cont) return;
  cont.innerHTML = state.selectedProfIds.map(id => {
    const p = state.profesionales.find(x=>x.id===id);
    if (!p) return '';
    const label = `${p.apellido}, ${p.nombres}${p.especialidad?' · '+p.especialidad:''}`;
    return `<span class="prof-tag" title="${esc(label)}">
      <span class="prof-tag-txt">${esc(label)}</span>
      <button onclick="toggleProfSel('${id}',false);const cb=document.querySelector('#pmi-${id} input');if(cb){cb.checked=false;}" title="Quitar">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
      </button>
    </span>`;
  }).join('');
}

// Load profs assigned to a patient (for edit form)
export async function loadPatientProfs(pacienteId) {
  const { data } = await sb.from(PP_TABLE).select('profesional_id').eq('paciente_id', pacienteId);
  state.selectedProfIds = (data||[]).map(r=>r.profesional_id);
  buildProfMultiList();
  renderProfTags();
}

// Save profesional links for a patient
export async function saveProfLinks(pacienteId) {
  // Get current links
  const { data: existing } = await sb.from(PP_TABLE).select('profesional_id').eq('paciente_id', pacienteId);
  const existingIds = (existing||[]).map(r=>r.profesional_id);
  // Insert new
  const toAdd = state.selectedProfIds.filter(id => !existingIds.includes(id));
  if (toAdd.length) await sb.from(PP_TABLE).insert(toAdd.map(pid=>({paciente_id:pacienteId,profesional_id:pid})));
  // Remove old
  const toRemove = existingIds.filter(id => !state.selectedProfIds.includes(id));
  for (const pid of toRemove) await sb.from(PP_TABLE).delete().eq('paciente_id',pacienteId).eq('profesional_id',pid);
}
