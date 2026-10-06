// Página: profesional.html
import { sb, P_TABLE, PP_TABLE, USR_TABLE } from '../supabase.js';
import { toast } from '../ui.js';
import { esc } from '../utils.js';
import { initEvents } from '../events.js';
import { actions } from '../events.js';

initEvents();

/* ── CONFIG ── */

const params  = new URLSearchParams(location.search);
const profId  = params.get('id');
let profesional = null;
let isAdmin     = false;

if (!profId) {
  showNotFound();
} else {
  sb.auth.onAuthStateChange(async (_e, session) => {
    if (session) { await boot(session.user); }
    else { location.href = 'index.html'; }
  });
  (async () => {
    const { data: { session } } = await sb.auth.getSession();
    if (session) await boot(session.user);
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

  const { data: links } = await sb.from(PP_TABLE).select('paciente_id, pacientes(id,apellido,nombres,dni,patologia)').eq('profesional_id',p.id);
  const pacs = (links||[]).map(l=>l.pacientes).filter(Boolean);

  const fi = (lbl,val) => val ? `<div class="info-item"><div class="info-lbl">${lbl}</div><div class="info-val">${val}</div></div>` : '';
  document.getElementById('det-body').innerHTML = `
    <div class="info-grid" style="margin-bottom:18px;">
      ${fi('Especialidad',p.especialidad)}
      ${fi('Matrícula',p.matricula)}
      ${fi('Teléfono',p.telefono)}
      ${fi('Mail',p.mail)}
      ${fi('Domicilio',p.domicilio)}
      ${fi('Ciudad',p.ciudad)}
    </div>
    ${esc(p.observaciones)?`<div class="clin-note"><div class="clin-lbl">Observaciones</div><div class="clin-txt">${esc(p.observaciones)}</div></div>`:''}
    <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:1px;color:var(--text-muted);margin:16px 0 10px;">
      Pacientes asignados (${pacs.length})
    </div>
    ${pacs.length ? `<div class="tbl-wrap"><table><thead><tr><th>Paciente</th><th>DNI</th><th>Patología</th><th>Ver</th></tr></thead><tbody>
      ${pacs.map(pac=>`<tr>
        <td class="td-p">${esc(pac.apellido)}, ${esc(pac.nombres)}</td>
        <td class="td-m">${esc(pac.dni)||'—'}</td>
        <td>${esc(pac.patologia)||'<span style="color:var(--text-muted)">—</span>'}</td>
        <td><button class="ic-btn ic-btn-blue" data-href="paciente.html?id=${encodeURIComponent(pac.id)}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button></td>
      </tr>`).join('')}
    </tbody></table></div>`
    : '<p style="font-size:13px;color:var(--text-muted)">Sin pacientes asignados actualmente.</p>'}`;
}

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

(function initTheme() { const saved = localStorage.getItem('mc_theme') || 'dark'; if (saved==='light') document.body.classList.add('light'); })();

document.addEventListener('keydown',e=>{ if(e.key==='Escape'){actions.closeProfForm();actions.closeDel();} });
