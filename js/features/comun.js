// Funciones idénticas en el listado (index) y en la ficha del paciente.
import { state } from '../state.js';
import { C_TABLE, PP_TABLE, sb } from '../supabase.js';
import { toast } from '../ui.js';
import { fmtDate } from '../forms.js';
import { esc } from '../utils.js';

export async function loadControles(pacienteId) {
  const { data, error } = await sb
    .from(C_TABLE)
    .select('*')
    .eq('paciente_id', pacienteId)
    .order('fecha', { ascending: false });
  if (error) { toast(`Error cargando controles: ${error.message}`,'error'); return []; }
  return data || [];
}

window.selectPeriod = function(days, btn) {
  state.rptDays = days;
  document.querySelectorAll('.rpt-period-btn').forEach(b=>b.classList.remove('sel'));
  btn.classList.add('sel');
  const custom = document.getElementById('rpt-custom');
  if (days === 0) {
    custom.classList.add('show');
  } else {
    custom.classList.remove('show');
    const today=new Date(), from=new Date(); from.setDate(today.getDate()-days);
    state.rptFrom=fmtDate(from); state.rptTo=fmtDate(today);
    document.getElementById('rpt-from').value=state.rptFrom;
    document.getElementById('rpt-to').value=state.rptTo;
    updateRptPreview();
  }
};

window.applyCustomPeriod = function() {
  state.rptFrom = document.getElementById('rpt-from').value;
  state.rptTo   = document.getElementById('rpt-to').value;
  if (!state.rptFrom || !state.rptTo) { toast('Seleccioná ambas fechas.','error'); return; }
  if (state.rptFrom > state.rptTo) { toast('La fecha "desde" debe ser anterior a "hasta".','error'); return; }
  updateRptPreview();
};

export async function updateRptPreview() {
  if (!state.rptPacId || !state.rptFrom || !state.rptTo) return;
  const countEl = document.getElementById('rpt-preview-count');
  const textEl  = document.getElementById('rpt-preview-text');
  countEl.textContent = '…';
  const { data, error } = await sb
    .from(C_TABLE)
    .select('*')
    .eq('paciente_id', state.rptPacId)
    .gte('fecha', state.rptFrom)
    .lte('fecha', state.rptTo)
    .order('fecha', { ascending: true });
  if (error) { countEl.textContent='Error'; return; }
  state.rptControles = data || [];
  const n = state.rptControles.length;
  countEl.textContent = `${n} control${n!==1?'es':''}`;
  const f1 = new Date(state.rptFrom+'T00:00:00').toLocaleDateString('es-AR',{day:'2-digit',month:'short',year:'numeric'});
  const f2 = new Date(state.rptTo+'T00:00:00').toLocaleDateString('es-AR',{day:'2-digit',month:'short',year:'numeric'});
  textEl.textContent = `Del ${f1} al ${f2}${n===0?' — Sin controles en ese período':''}`;
}

window.closeRpt=function(){ document.getElementById('rpt-overlay').classList.remove('open'); };

window.closeRptIfBg=function(e){ if(e.target===document.getElementById('rpt-overlay')) window.closeRpt(); };

window.closeFormIfBg=function(e){ if(e.target===document.getElementById('form-overlay')) window.closeForm(); };

window.closeEntrada = function() {
  document.getElementById('entrada-overlay').classList.remove('open');
  state.entradaPacId    = null;
  state.entradaImgFiles = [];
};

window.closeEntradaIfBg = function(e) {
  if (e.target === document.getElementById('entrada-overlay')) window.closeEntrada();
};

window.togglePdfImg = function(i, val) {
  if (state.entradaImgFiles[i]) {
    state.entradaImgFiles[i].incluirPdf = val;
    const tog = document.getElementById(`pdf-toggle-${i}`);
    if (tog) tog.classList.toggle('active', val);
  }
};

window.switchTab=function(name,el){ document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active')); document.querySelectorAll('.tab-pane').forEach(t=>t.classList.remove('active')); el.classList.add('active'); document.getElementById('tab-'+name).classList.add('active'); };

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
      <input type="checkbox" ${sel?'checked':''} data-change="toggleProfSel" data-change-args="${esc(JSON.stringify([p.id, "$checked"]))}">
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
      <button data-click="deselectProf" data-click-args="${esc(JSON.stringify([id]))}" title="Quitar">
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

// Quita un profesional del formulario: lo deselecciona y destilda su casilla.
window.deselectProf = function(id) {
  window.toggleProfSel(id, false);
  const cb = document.querySelector(`#pmi-${id} input`);
  if (cb) cb.checked = false;
};
