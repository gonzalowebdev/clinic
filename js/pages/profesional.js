// Página: profesional.html
import { sb, P_TABLE, PP_TABLE, USR_TABLE } from '../supabase.js';
import { toast } from '../ui.js';
import { esc } from '../utils.js';
import { ICO_EYE } from '../constants.js';
import { initEvents } from '../events.js';
import { mountShell, fillShellUser, initTheme } from '../shell.js';
import { actions } from '../events.js';

initEvents();
mountShell({ active: 'profesionales', title: 'Ficha del profesional', mode: 'detail' });
initTheme();

/* ── CONFIG ── */

const params  = new URLSearchParams(location.search);
const profId  = params.get('id');
let profesional = null;
let isAdmin     = false;

if (!profId) {
  showNotFound();
} else {
  sb.auth.onAuthStateChange(async (_e, session) => {
    if (session) { fillShellUser(session.user); await boot(session.user); }
    else { location.href = 'index.html'; }
  });
  (async () => {
    const { data: { session } } = await sb.auth.getSession();
    if (session) { fillShellUser(session.user); await boot(session.user); }
    else location.href = 'index.html';
  })();
}

async function boot(user) {
  const { data } = await sb.from(USR_TABLE).select('rol').eq('id', user.id).single();
  isAdmin = data?.rol === 'admin';
  document.getElementById('btn-prof-edit').style.display   = isAdmin ? 'inline-flex' : 'none';
  document.getElementById('btn-prof-delete').style.display = isAdmin ? 'inline-flex' : 'none';
  await loadProfesional();
}

async function loadProfesional() {
  const { data, error } = await sb.from(P_TABLE).select('*').eq('id', profId).single();
  if (error || !data) { showNotFound(); return; }
  profesional = data;
  document.getElementById('loading-screen').style.display = 'none';
  document.getElementById('det-page').style.display = 'flex';
  await renderProfesionalDetail();
}

function showNotFound() {
  document.getElementById('loading-screen').style.display = 'none';
  document.getElementById('not-found-screen').style.display = 'flex';
}

/* ══════════════════════════════
   DETALLE DEL PROFESIONAL (ex-modal, ahora página)
══════════════════════════════ */
async function renderProfesionalDetail() {
  const p = profesional;
  const inits = ((p.apellido||'')[0]||'').toUpperCase()+((p.nombres||'')[0]||'').toUpperCase();
  document.getElementById('det-avatar-lg').textContent = inits || '?';
  document.getElementById('det-name').textContent = `${p.apellido}, ${p.nombres}`;
  document.getElementById('det-sub').textContent = [p.especialidad, p.matricula ? 'Mat. '+p.matricula : ''].filter(Boolean).join(' · ') || '—';
  document.getElementById('prof-page-title').textContent = `${p.apellido}, ${p.nombres}`;
  document.title = `${p.apellido}, ${p.nombres} · Clinic`;

  document.getElementById('btn-prof-edit').onclick   = () => actions.openProfForm();
  document.getElementById('btn-prof-delete').onclick = () => actions.askDeleteProf();

  const { data: links } = await sb.from(PP_TABLE).select('paciente_id, pacientes(id,apellido,nombres,dni,patologia,activo)').eq('profesional_id', p.id);
  const pacs = (links || []).map(l => l.pacientes).filter(Boolean)
    .sort((x, y) => `${x.apellido} ${x.nombres}`.localeCompare(`${y.apellido} ${y.nombres}`, 'es'));
  const clean = v => String(v || '').trim();

  /* Indicadores calculados con los pacientes asignados */
  const activos = pacs.filter(x => x.activo !== false).length;
  const patologias = new Set(pacs.map(x => clean(x.patologia).toLowerCase()).filter(Boolean)).size;
  const kpi = (lbl, val, sub) => `<div class="kpi"><div class="kpi-lbl">${lbl}</div><div class="kpi-val">${val}</div><div class="kpi-sub">${sub}</div></div>`;
  document.getElementById('det-kpis').innerHTML =
    kpi('Pacientes asignados', pacs.length, pacs.length === 1 ? 'paciente' : 'pacientes') +
    kpi('Activos', activos, 'en seguimiento') +
    kpi('Inactivos', pacs.length - activos, 'deshabilitados') +
    kpi('Patologías', patologias, patologias === 1 ? 'distinta' : 'distintas');

  /* Columna lateral: datos profesionales y contacto (los campos vacíos se agrupan en una línea) */
  const grupo = (titulo, filas) => {
    const con = filas.filter(([, v]) => clean(v));
    const sin = filas.filter(([, v]) => !clean(v)).map(([l]) => l);
    return `<div class="side-title">${titulo}</div>
      ${con.map(([l, v]) => `<div class="side-row"><div class="side-lbl">${l}</div><div class="side-val">${esc(v)}</div></div>`).join('')}
      ${sin.length ? `<div class="empty-line">Sin datos: ${sin.join(', ')}</div>` : ''}`;
  };
  document.getElementById('det-side').innerHTML =
    grupo('Contacto', [['Teléfono', p.telefono], ['Mail', p.mail], ['Domicilio', p.domicilio], ['Ciudad', p.ciudad]]);

  /* Cuerpo: observaciones + pacientes asignados */
  const eye = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICO_EYE}</svg>`;
  const filas = pacs.map(pac => {
    const activo = pac.activo !== false;
    const inits = ((pac.apellido || '')[0] || '').toUpperCase() + ((pac.nombres || '')[0] || '').toUpperCase();
    const buscar = `${pac.apellido} ${pac.nombres} ${pac.dni || ''} ${pac.patologia || ''}`.toLowerCase();
    return `<div class="pac-row" data-nom="${esc(buscar)}">
      <div class="pac-av">${esc(inits) || '?'}</div>
      <div class="pac-main">
        <div class="pac-name"><span class="prof-link" data-href="paciente.html?id=${encodeURIComponent(pac.id)}">${esc(pac.apellido)}, ${esc(pac.nombres)}</span></div>
        <div class="pac-meta">DNI ${esc(pac.dni) || '—'}</div>
      </div>
      <div class="pac-tags">${clean(pac.patologia) ? `<span class="chip-tag">${esc(pac.patologia)}</span>` : ''}<span class="status-badge ${activo ? 'active' : 'inactive'}">${activo ? 'Activo' : 'Inactivo'}</span></div>
      <button class="ic-btn ic-btn-blue" data-href="paciente.html?id=${encodeURIComponent(pac.id)}" title="Ver ficha">${eye}</button>
    </div>`;
  }).join('');
  document.getElementById('det-body').innerHTML = `
    ${clean(p.observaciones) ? `<div class="sum-block"><div class="note-card"><div class="note-lbl">Observaciones</div><div class="note-txt">${esc(p.observaciones)}</div></div></div>` : ''}
    <div class="sum-block">
      <div class="sum-head">
        <div class="sum-lbl" style="margin:0;">Pacientes asignados <span class="tab-count">${pacs.length}</span></div>
        ${pacs.length > 6 ? `<input class="pac-search" type="search" placeholder="Buscar paciente…" data-input="filterPacsProf" data-input-args='["$value"]'>` : ''}
      </div>
      ${pacs.length ? `<div class="pac-list" id="pac-list">${filas}</div>`
        : `<div class="empty-state"><div class="empty-title">Sin pacientes asignados</div><div class="empty-text">Asigná a este profesional desde la ficha de un paciente (Editar → Profesionales asignados).</div></div>`}
    </div>`;
}

/* Filtro local de la lista de pacientes asignados */
actions.filterPacsProf = function(q) {
  const t = String(q || '').trim().toLowerCase();
  document.querySelectorAll('#pac-list .pac-row').forEach(r => { r.style.display = !t || r.dataset.nom.includes(t) ? '' : 'none'; });
};

/* ══════════════════════════════
   EDITAR PROFESIONAL
══════════════════════════════ */
actions.openProfForm = function() {
  if (!isAdmin) return;
  const p = profesional;
  document.getElementById('pf-apellido').value      = p.apellido||'';
  document.getElementById('pf-nombres').value       = p.nombres||'';
  document.getElementById('pf-especialidad').value  = p.especialidad||'';
  document.getElementById('pf-matricula').value     = p.matricula||'';
  document.getElementById('pf-telefono').value      = p.telefono||'';
  document.getElementById('pf-mail').value          = p.mail||'';
  document.getElementById('pf-domicilio').value     = p.domicilio||'';
  document.getElementById('pf-ciudad').value        = p.ciudad||'';
  document.getElementById('pf-observaciones').value = p.observaciones||'';
  document.getElementById('prof-form-overlay').classList.add('open');
};
actions.closeProfForm = function() { document.getElementById('prof-form-overlay').classList.remove('open'); };
actions.closeProfFormIfBg = function(e) { if(e.target===document.getElementById('prof-form-overlay')) actions.closeProfForm(); };

actions.saveProfesional = async function() {
  if (!isAdmin) return;
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
  const { error } = await sb.from(P_TABLE).update(payload).eq('id',profesional.id);
  btn.disabled=false; txt.textContent='Guardar';
  if (error) { toast(`Error: ${error.message}`,'error'); return; }
  toast('Profesional actualizado.','success');
  actions.closeProfForm();
  await loadProfesional();
};

/* ══════════════════════════════
   ELIMINAR
══════════════════════════════ */
actions.askDeleteProf = function() { document.getElementById('del-overlay').classList.add('open'); };
actions.closeDel = function() { document.getElementById('del-overlay').classList.remove('open'); };
actions.closeDelIfBg = function(e) { if(e.target===document.getElementById('del-overlay')) actions.closeDel(); };
actions.confirmDeleteProf = async function() {
  if (!isAdmin || !profesional) return;
  const btn=document.getElementById('btn-confirm-del');
  btn.disabled=true; btn.textContent='Eliminando…';
  await sb.from(PP_TABLE).delete().eq('profesional_id',profesional.id);
  const { error } = await sb.from(P_TABLE).delete().eq('id',profesional.id);
  btn.disabled=false; btn.innerHTML=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" width="15" height="15"><polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg> Eliminar`;
  if (error) { toast(`Error: ${error.message}`,'error'); actions.closeDel(); return; }
  toast('Profesional eliminado.','info');
  location.href = 'index.html';
};

/* ══════════════════════════════
   TOAST / THEME
══════════════════════════════ */


document.addEventListener('keydown',e=>{ if(e.key==='Escape'){actions.closeProfForm();actions.closeDel();} });
