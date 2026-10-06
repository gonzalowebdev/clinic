// Página: index.html
import { sb, TABLE, C_TABLE, CI_TABLE, BUCKET, P_TABLE, PP_TABLE, USR_TABLE } from '../supabase.js';
import { DB_COLS, CTRL_COLS, DB_LABELS, CTRL_LABELS, TAGS, ICO_EYE, ICO_EDIT, ICO_DEL, ICO_USERS, ICO_DOC, ICO_FLASK, VIEW_TITLES, PER } from '../constants.js';
import { toast } from '../ui.js';
import { signPaths, attachUrl, loadAttachments, uploadAttachment, deleteAttachment } from '../storage.js';
import { gv, setFormValues, clearFormValues, fmtDate } from '../forms.js';
import { esc } from '../utils.js';

/* ── CONFIG ── */

console.log("🔌 Conectando a Supabase");
const { data, error } = await sb.from(TABLE).select('count', { count: 'exact', head: true });
if (error) console.error("❌ Error de conexión o tabla:", error);
else console.log("✅ Tabla accesible");

  

/* ── STATE ── */
let pacientes    = [];
let filteredList = [];
let activeFilter = 'todos';
let searchQuery  = '';
let page         = 1;
let editId       = null;
let deleteId     = null;
// Entrada diaria state
let entradaPacId   = null;
let entradaImgFiles = [];    // File objects pending upload
// Report state
let rptPacId     = null;
let rptDays      = 7;        // 0 = custom
let rptFrom      = null;
let rptTo        = null;
let rptControles = [];       // controles cargados para el período
// CSV state
let csvControles = [];
// Profesionales state
let profesionales    = [];
let editProfId       = null;
let selectedProfIds  = [];   // IDs seleccionados en el multiselect del form paciente
// Usuarios state
let usuarios     = [];
let editUsrId    = null;
let currentUser  = null;
let isAdmin      = false;

/* ── Columnas DB pacientes ── */

/* ── Columnas DB controles ── */

/* ── Labels legibles ── */

/* ══════════════════════════════
   AUTH
══════════════════════════════ */
sb.auth.onAuthStateChange(async (_e, session) => {
  if (session) {
    currentUser = session.user;
    await loadUserRole(session.user.id);
    showApp(session.user);
    await Promise.all([loadPacientes(), loadProfesionales()]);
  } else {
    currentUser = null; isAdmin = false;
    document.body.classList.remove('is-admin');
    showLogin();
  }
});
(async () => {
  const { data: { session } } = await sb.auth.getSession();
  if (session) {
    currentUser = session.user;
    await loadUserRole(session.user.id);
    showApp(session.user);
    await Promise.all([loadPacientes(), loadProfesionales()]);
  } else showLogin();
})();

async function loadUserRole(uid) {
  const { data } = await sb.from(USR_TABLE).select('rol,nombre').eq('id', uid).single();
  isAdmin = data?.rol === 'admin';
  if (isAdmin) document.body.classList.add('is-admin');
  else document.body.classList.remove('is-admin');
  // update sidebar user role label
  const roleEl = document.querySelector('.user-role');
  if (roleEl) roleEl.textContent = isAdmin ? 'Administrador' : 'Usuario';
}

function showLogin() {
  document.getElementById('page-login').classList.add('active');
  document.getElementById('page-app').classList.remove('active');
  setTimeout(() => document.getElementById('l-email').focus(), 100);
}
function showApp(user) {
  document.getElementById('page-login').classList.remove('active');
  document.getElementById('page-app').classList.add('active');
  const email = user?.email || '';
  document.getElementById('user-email-display').textContent = email;
  document.getElementById('user-av').textContent = email.slice(0,2).toUpperCase();
}

window.doLogin = async function() {
  const email = document.getElementById('l-email').value.trim();
  const pw    = document.getElementById('l-pw').value;
  let ok = true;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showFErr('email','Ingresá un email válido'); ok=false; }
  if (!pw) { showFErr('pw','La contraseña es requerida'); ok=false; }
  if (!ok) return;
  setBtnState(true);
  const { error } = await sb.auth.signInWithPassword({ email, password: pw });
  setBtnState(false);
  if (error) {
    document.getElementById('login-alert-txt').textContent = error.message.includes('Invalid')?'Email o contraseña incorrectos.':error.message;
    document.getElementById('login-alert').classList.add('show');
    shakePanel();
  }
};
window.doLogout = async function() { await sb.auth.signOut(); pacientes=[]; };
function setBtnState(l) {
  document.getElementById('btn-login').disabled=l;
  document.getElementById('l-spin').style.display=l?'block':'none';
  document.getElementById('l-btn-ico').style.display=l?'none':'';
  document.getElementById('l-btn-txt').textContent=l?'Verificando…':'Iniciar sesión';
}
function showFErr(f,msg) { document.getElementById(`l-err-${f}-txt`).textContent=msg; document.getElementById(`l-err-${f}`).classList.add('show'); }
window.loginClearErr=function(){ ['email','pw'].forEach(f=>document.getElementById(`l-err-${f}`).classList.remove('show')); document.getElementById('login-alert').classList.remove('show'); };
function shakePanel() { const p=document.querySelector('.lc-right'); p.style.animation='shake .4s ease'; setTimeout(()=>p.style.animation='',400); }
window.togglePw=function() { const i=document.getElementById('l-pw'),on=i.type==='password'; i.type=on?'text':'password'; document.getElementById('ico-eye').style.display=on?'none':''; document.getElementById('ico-eye-off').style.display=on?'':'none'; };

/* ══════════════════════════════
   CRUD PACIENTES
══════════════════════════════ */
async function loadPacientes() {
  const { data, error } = await sb.from(TABLE).select('*').order('created_at',{ascending:false});
  if (error) { toast(`Error al cargar: ${error.message}`,'error'); return; }
  pacientes = data || [];
  renderAll();
}

window.savePaciente = async function() {
  if (!gv('apellido')||!gv('nombres')||!gv('dni')) { toast('Apellido, Nombres y DNI son obligatorios.','error'); return; }
  const payload={};
  DB_COLS.forEach(col=>{ payload[col]=gv(col)||null; });
  const btn=document.getElementById('btn-save'), txt=document.getElementById('btn-save-txt');
  btn.disabled=true; txt.textContent='Guardando…';
  let error, savedId;
  if (editId) {
    ({error}=await sb.from(TABLE).update(payload).eq('id',editId));
    savedId=editId;
    if(!error) toast('Paciente actualizado.','success');
  } else {
    const {data:ins,error:ie}=await sb.from(TABLE).insert(payload).select().single();
    error=ie; savedId=ins?.id;
    if(!error) toast('Paciente registrado.','success');
  }
  btn.disabled=false; txt.textContent='Guardar Paciente';
  if (error) { toast(`Error: ${error.message}`,'error'); return; }
  if (savedId) await saveProfLinks(savedId);
  window.closeForm(); await loadPacientes();
};

window.askDelete=function(id){ deleteId=id; document.getElementById('del-overlay').classList.add('open'); };
window.confirmDelete=async function() {
  if (!deleteId) return;
  const btn=document.getElementById('btn-confirm-del');
  btn.disabled=true; btn.textContent='Eliminando…';
  // adjuntos
  const {data:files}=await sb.storage.from(BUCKET).list(deleteId);
  if (files&&files.length) await sb.storage.from(BUCKET).remove(files.map(f=>`${deleteId}/${f.name}`));
  // controles
  await sb.from(C_TABLE).delete().eq('paciente_id',deleteId);
  // paciente
  const {error}=await sb.from(TABLE).delete().eq('id',deleteId);
  btn.disabled=false;
  btn.innerHTML=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" width="15" height="15"><polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg> Eliminar`;
  if (error) { toast(`Error: ${error.message}`,'error'); closeDel(); return; }
  toast('Paciente eliminado.','info');
  closeDel(); deleteId=null; await loadPacientes();
};

/* ══════════════════════════════
   CRUD CONTROLES
══════════════════════════════ */
async function loadControles(pacienteId) {
  const { data, error } = await sb
    .from(C_TABLE)
    .select('*')
    .eq('paciente_id', pacienteId)
    .order('fecha', { ascending: false });
  if (error) { toast(`Error cargando controles: ${error.message}`,'error'); return []; }
  return data || [];
}

window.saveControl = async function(pacienteId, containerId) {
  const fecha = document.getElementById('ctrl-fecha').value;
  if (!fecha) { toast('La fecha del control es obligatoria.','error'); return; }
  const payload = {
    paciente_id:        pacienteId,
    fecha:              fecha,
    enfermeria:         document.getElementById('ctrl-enfermeria').value.trim() || null,
    kinesiologia:       document.getElementById('ctrl-kinesiologia').value.trim() || null,
    diagnostico_medico: document.getElementById('ctrl-diagnostico').value.trim() || null,
    observaciones:      document.getElementById('ctrl-obs').value.trim() || null,
    otros_profesionales:document.getElementById('ctrl-otros-prof').value.trim() || null,
    otros:              document.getElementById('ctrl-otros').value.trim() || null,
  };
  const btn=document.getElementById('ctrl-save-btn');
  btn.disabled=true; btn.textContent='Guardando…';
  const { error } = await sb.from(C_TABLE).insert(payload);
  btn.disabled=false; btn.textContent='Guardar Control';
  if (error) { toast(`Error: ${error.message}`,'error'); return; }
  toast('Control guardado.','success');
  // Limpiar form
  ['ctrl-enfermeria','ctrl-kinesiologia','ctrl-diagnostico','ctrl-obs','ctrl-otros-prof','ctrl-otros'].forEach(id=>{ const e=document.getElementById(id); if(e) e.value=''; });
  // Recargar lista
  await renderControlesList(pacienteId, containerId);
};

window.deleteControl = async function(controlId, pacienteId, containerId) {
  if (!confirm('¿Eliminar este control? También se eliminarán sus imágenes.')) return;
  // Delete images from storage first
  const { data: imgs } = await sb.from(CI_TABLE).select('storage_path').eq('control_id', controlId);
  if (imgs?.length) await sb.storage.from(BUCKET).remove(imgs.map(i => i.storage_path));
  const { error } = await sb.from(C_TABLE).delete().eq('id', controlId);
  if (error) { toast(`Error: ${error.message}`,'error'); return; }
  toast('Control eliminado.','info');
  await renderControlesList(pacienteId, containerId);
};

window.deleteCtrlImg = async function(imgId, storagePath, pacienteId, containerId) {
  if (!confirm('¿Eliminar esta imagen?')) return;
  await sb.storage.from(BUCKET).remove([storagePath]);
  await sb.from(CI_TABLE).delete().eq('id', imgId);
  toast('Imagen eliminada.','info');
  await renderControlesList(pacienteId, containerId);
};

async function renderControlesList(pacienteId, containerId) {
  const cont = document.getElementById(containerId);
  cont.innerHTML = '<p style="font-size:12px;color:var(--text-muted);padding:8px 0">Cargando controles…</p>';
  const list = await loadControles(pacienteId);
  if (!list.length) {
    cont.innerHTML = '<p style="font-size:12px;color:var(--text-muted);padding:8px 0">Aún no hay controles registrados para este paciente.</p>';
    return;
  }

  // Load images for each control
  const imgMap = {};
  for (const c of list) {
    const { data: imgs } = await sb.from(CI_TABLE).select('*').eq('control_id', c.id);
    imgMap[c.id] = imgs || [];
  }
  await signPaths(Object.values(imgMap).flat().map(i=>i.storage_path));

  cont.innerHTML = list.map(c => {
    const d = new Date(c.fecha + 'T00:00:00').toLocaleDateString('es-AR',{weekday:'long',day:'2-digit',month:'long',year:'numeric'});
    const meta = [c.responsable, c.turno].filter(Boolean).map(esc).join(' · ');
    const fields = [
      esc(c.enfermeria)         && `<div class="ctrl-field"><strong>Enfermería</strong>${esc(c.enfermeria)}</div>`,
      esc(c.kinesiologia)       && `<div class="ctrl-field"><strong>Kinesiología</strong>${esc(c.kinesiologia)}</div>`,
      esc(c.diagnostico_medico) && `<div class="ctrl-field"><strong>Diagnóstico / Evolución</strong>${esc(c.diagnostico_medico)}</div>`,
      esc(c.observaciones)      && `<div class="ctrl-field"><strong>Observaciones</strong>${esc(c.observaciones)}</div>`,
      esc(c.otros_profesionales)&& `<div class="ctrl-field"><strong>Otros Profesionales</strong>${esc(c.otros_profesionales)}</div>`,
      esc(c.otros)              && `<div class="ctrl-field"><strong>Otros</strong>${esc(c.otros)}</div>`,
    ].filter(Boolean).join('');

    const imgs = imgMap[c.id] || [];
    const imgHtml = imgs.length ? `
      <div style="margin-top:10px;">
        <div style="font-size:9.5px;text-transform:uppercase;letter-spacing:1px;color:var(--text-muted);margin-bottom:6px;">Imágenes (${imgs.length})</div>
        <div class="gallery" style="grid-template-columns:repeat(auto-fill,minmax(70px,1fr));">
          ${imgs.map(img => {
            const url = attachUrl(img.storage_path);
            return `<div class="gallery-item" style="position:relative;">
              <img src="${url}" alt="${esc(img.nombre)}" onclick="openLightbox('${url}')" loading="lazy">
              <div class="attach-name">${esc(img.nombre)}</div>
              ${img.incluir_pdf ? '<div style="position:absolute;top:3px;left:3px;background:rgba(20,166,150,.85);border-radius:3px;padding:1px 5px;font-size:8px;color:#fff;">PDF</div>' : ''}
              <button class="del-attach" onclick="deleteCtrlImg('${img.id}','${img.storage_path}','${pacienteId}','${containerId}')" title="Eliminar">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>`;
          }).join('')}
        </div>
      </div>` : '';

    return `<div class="ctrl-card">
      <div class="ctrl-date">
        <span class="ctrl-date-badge">Control</span>
        ${d}
        ${meta ? `<span style="font-size:10px;color:var(--text-muted);margin-left:4px;">· ${meta}</span>` : ''}
      </div>
      <button class="ctrl-del-btn" onclick="deleteControl('${c.id}','${pacienteId}','${containerId}')" title="Eliminar control">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
      </button>
      <div class="ctrl-fields">${fields || '<span style="font-size:12px;color:var(--text-muted)">Sin datos de texto.</span>'}</div>
      ${imgHtml}
    </div>`;
  }).join('');
}

/* ══════════════════════════════
   INFORME POR PERÍODO
══════════════════════════════ */
window.openRptModal = function(pacienteId) {
  rptPacId = pacienteId;
  rptDays  = 7;
  const p = pacientes.find(x=>x.id===pacienteId);
  document.getElementById('rpt-modal-sub').textContent = p ? `Paciente: ${p.apellido}, ${p.nombres}` : '';
  // reset buttons
  document.querySelectorAll('.rpt-period-btn').forEach(b=>b.classList.remove('sel'));
  document.getElementById('rpt-btn-7').classList.add('sel');
  document.getElementById('rpt-custom').classList.remove('show');
  // set default dates
  const today=new Date(), from=new Date(); from.setDate(today.getDate()-7);
  rptFrom=fmtDate(from); rptTo=fmtDate(today);
  document.getElementById('rpt-from').value=rptFrom;
  document.getElementById('rpt-to').value=rptTo;
  document.getElementById('rpt-overlay').classList.add('open');
  updateRptPreview();
};

window.selectPeriod = function(days, btn) {
  rptDays = days;
  document.querySelectorAll('.rpt-period-btn').forEach(b=>b.classList.remove('sel'));
  btn.classList.add('sel');
  const custom = document.getElementById('rpt-custom');
  if (days === 0) {
    custom.classList.add('show');
  } else {
    custom.classList.remove('show');
    const today=new Date(), from=new Date(); from.setDate(today.getDate()-days);
    rptFrom=fmtDate(from); rptTo=fmtDate(today);
    document.getElementById('rpt-from').value=rptFrom;
    document.getElementById('rpt-to').value=rptTo;
    updateRptPreview();
  }
};

window.applyCustomPeriod = function() {
  rptFrom = document.getElementById('rpt-from').value;
  rptTo   = document.getElementById('rpt-to').value;
  if (!rptFrom || !rptTo) { toast('Seleccioná ambas fechas.','error'); return; }
  if (rptFrom > rptTo) { toast('La fecha "desde" debe ser anterior a "hasta".','error'); return; }
  updateRptPreview();
};

async function updateRptPreview() {
  if (!rptPacId || !rptFrom || !rptTo) return;
  const countEl = document.getElementById('rpt-preview-count');
  const textEl  = document.getElementById('rpt-preview-text');
  countEl.textContent = '…';
  const { data, error } = await sb
    .from(C_TABLE)
    .select('*')
    .eq('paciente_id', rptPacId)
    .gte('fecha', rptFrom)
    .lte('fecha', rptTo)
    .order('fecha', { ascending: true });
  if (error) { countEl.textContent='Error'; return; }
  rptControles = data || [];
  const n = rptControles.length;
  countEl.textContent = `${n} control${n!==1?'es':''}`;
  const f1 = new Date(rptFrom+'T00:00:00').toLocaleDateString('es-AR',{day:'2-digit',month:'short',year:'numeric'});
  const f2 = new Date(rptTo+'T00:00:00').toLocaleDateString('es-AR',{day:'2-digit',month:'short',year:'numeric'});
  textEl.textContent = `Del ${f1} al ${f2}${n===0?' — Sin controles en ese período':''}`;
}

window.generatePeriodReport = async function() {
  if (!rptPacId) return;
  if (!rptControles.length) { toast('No hay controles en el período seleccionado.','error'); return; }
  const p = pacientes.find(x=>x.id===rptPacId);
  if (!p) return;

  // Load images for each control that have incluir_pdf = true
  const imgMap = {};
  for (const c of rptControles) {
    const { data: imgs } = await sb.from(CI_TABLE).select('*').eq('control_id', c.id).eq('incluir_pdf', true);
    imgMap[c.id] = imgs || [];
  }
  await signPaths(Object.values(imgMap).flat().map(i=>i.storage_path));

  const now = new Date();
  const fPrint = now.toLocaleDateString('es-AR',{day:'2-digit',month:'long',year:'numeric'});
  const hPrint = now.toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'});
  const f1 = new Date(rptFrom+'T00:00:00').toLocaleDateString('es-AR',{day:'2-digit',month:'long',year:'numeric'});
  const f2 = new Date(rptTo+'T00:00:00').toLocaleDateString('es-AR',{day:'2-digit',month:'long',year:'numeric'});
  const fld=(lbl,val)=>`<div class="pr-field"><div class="pr-field-lbl">${lbl}</div><div class="pr-field-val">${esc(val)||'<span class="pr-no-data">—</span>'}</div></div>`;

  const ctrlHtml = rptControles.map((c,i) => {
    const d=new Date(c.fecha+'T00:00:00').toLocaleDateString('es-AR',{weekday:'long',day:'2-digit',month:'long',year:'numeric'});
    const meta = [c.responsable, c.turno].filter(Boolean).map(esc).join(' · ');
    const imgs = imgMap[c.id] || [];
    const imgSection = imgs.length ? `
      <div style="margin-top:8px;">
        <div style="font-size:7.5pt;text-transform:uppercase;letter-spacing:.5px;color:#556070;margin-bottom:4px;">Imágenes del control (${imgs.length})</div>
        <div class="pr-img-grid">
          ${imgs.map(img=>`<div class="pr-img-item">
            <img src="${attachUrl(img.storage_path)}" alt="${esc(img.nombre)}">
            <div class="pr-img-caption">${esc(img.nombre)}</div>
          </div>`).join('')}
        </div>
      </div>` : '';

    return `<div class="pr-ctrl-entry">
      <div class="pr-ctrl-header">
        <span class="pr-ctrl-num">Control ${i+1}</span>
        <span class="pr-ctrl-date">${d}</span>
        ${meta ? `<span style="font-size:8pt;color:#556070;">${meta}</span>` : ''}
      </div>
      <div class="pr-ctrl-grid">
        ${esc(c.enfermeria)?`<div class="pr-ctrl-field"><div class="pr-ctrl-field-lbl">Enfermería</div>${esc(c.enfermeria)}</div>`:''}
        ${esc(c.kinesiologia)?`<div class="pr-ctrl-field"><div class="pr-ctrl-field-lbl">Kinesiología</div>${esc(c.kinesiologia)}</div>`:''}
        ${esc(c.diagnostico_medico)?`<div class="pr-ctrl-field"><div class="pr-ctrl-field-lbl">Diagnóstico / Evolución</div>${esc(c.diagnostico_medico)}</div>`:''}
        ${esc(c.observaciones)?`<div class="pr-ctrl-field"><div class="pr-ctrl-field-lbl">Observaciones</div>${esc(c.observaciones)}</div>`:''}
        ${esc(c.otros_profesionales)?`<div class="pr-ctrl-field"><div class="pr-ctrl-field-lbl">Otros Profesionales</div>${esc(c.otros_profesionales)}</div>`:''}
        ${esc(c.otros)?`<div class="pr-ctrl-field"><div class="pr-ctrl-field-lbl">Otros</div>${esc(c.otros)}</div>`:''}
      </div>
      ${imgSection}
    </div>`;
  }).join('');

  document.getElementById('print-report').innerHTML=`
  <div class="pr-page">
    <div class="pr-header">
      <div class="pr-logo-area">
        <img src="logo.svg" height="44">
        <div><div class="pr-org-name">Clinic</div><div class="pr-org-sub">Sistema de Gestión Clínica</div></div>
      </div>
      <div class="pr-date"><strong>${fPrint}</strong>Impreso a las ${hPrint}</div>
    </div>
    <div class="pr-title">Informe de Controles por Período</div>
    <div class="pr-period-badge">Del ${f1} al ${f2} — ${rptControles.length} control${rptControles.length!==1?'es':''}</div>
    <div class="pr-section">
      <div class="pr-section-title">Datos del Paciente</div>
      <div class="pr-grid">
        ${fld('Apellido y Nombres',`${p.apellido||''}, ${p.nombres||''}`)}
        ${fld('DNI',p.dni)}
        ${fld('Médico Tratante',p.medico_tratante)}
        ${fld('Patología Principal',p.patologia)}
        ${fld('Domicilio',p.domicilio)}
        ${fld('Ciudad',p.ciudad)}
      </div>
    </div>
    <div class="pr-section">
      <div class="pr-section-title">Registro de Controles (${rptControles.length})</div>
      ${ctrlHtml}
    </div>
    <div class="pr-sign-row">
      <div class="pr-sign">Firma y Sello Médico Tratante<br><br><br>${esc(p.medico_tratante)||'____________________________'}</div>
      <div class="pr-sign">Firma Enfermería / Responsable<br><br><br>____________________________</div>
      <div class="pr-sign">Aclaración y Fecha<br><br><br>____________________________</div>
    </div>
    <div class="pr-footer">Clinic — Sistema de Gestión Clínica &nbsp;|&nbsp; ${fPrint} · ${hPrint}<br>Documento confidencial. Uso exclusivo del equipo médico tratante.</div>
  </div>`;

  closeRpt();
  window.print();
};

/* Informe simple de ficha (botón "Imprimir ficha") */
window.printPaciente = function(id) {
  const p=pacientes.find(x=>x.id===id); if(!p) return;
  const now=new Date();
  const fPrint=now.toLocaleDateString('es-AR',{day:'2-digit',month:'long',year:'numeric'});
  const hPrint=now.toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'});
  const fld=(lbl,val)=>`<div class="pr-field"><div class="pr-field-lbl">${lbl}</div><div class="pr-field-val">${esc(val)||'<span class="pr-no-data">—</span>'}</div></div>`;
  const blk=(lbl,val,c='#0b8579')=>val?`<div class="pr-text-block" style="border-left-color:${c}"><div class="pr-text-lbl" style="color:${c}">${lbl}</div><div class="pr-text-val">${esc(val)}</div></div>`:'';
  document.getElementById('print-report').innerHTML=`
  <div class="pr-page">
    <div class="pr-header">
      <div class="pr-logo-area">
        <img src="logo.svg" height="44">
        <div><div class="pr-org-name">Clinic</div><div class="pr-org-sub">Sistema de Gestión Clínica</div></div>
      </div>
      <div class="pr-date"><strong>${fPrint}</strong>Impreso a las ${hPrint}</div>
    </div>
    <div class="pr-title">Ficha Clínica del Paciente</div>
    <div class="pr-subtitle">Reporte generado para revisión médica</div>
    <div class="pr-section"><div class="pr-section-title">Datos Personales</div>
      <div class="pr-grid">
        ${fld('Apellido y Nombres',`${p.apellido||''}, ${p.nombres||''}`)}
        ${fld('DNI',p.dni)}${fld('Teléfonos',p.telefonos)}${fld('Mail',p.mail)}
        ${fld('Domicilio',p.domicilio)}${fld('Ciudad',p.ciudad)}
        ${fld('Contacto Familia',p.contacto_familia)}${fld('Médico Tratante',p.medico_tratante)}
      </div>
    </div>
    <div class="pr-section"><div class="pr-section-title">Patologías</div>
      <div class="pr-grid">${fld('Patología Principal',p.patologia)}${fld('Patología 1',p.patologia1)}${fld('Patología 2',p.patologia2)}</div>
      ${blk('Diagnóstico Médico',p.diagnostico_medico)}
    </div>
    <div class="pr-section"><div class="pr-section-title">Registros Clínicos</div>
      ${blk('Historia Clínica',p.historia_clinica,'#10b981')}
      ${blk('Epicrisis',p.epicrisis,'#f59e0b')}
      ${blk('Estudios Complementarios',p.estudios_complementarios,'#14b8a6')}
      ${blk('Observaciones',p.observaciones,'#556070')}
    </div>
    <div class="pr-section"><div class="pr-section-title">Equipos de Atención</div>
      ${blk('Enfermería',p.enfermeria,'#a78bfa')}
      ${blk('Kinesiología',p.kinesiologia,'#34d399')}
      ${blk('Otros Profesionales',p.otros_profesionales,'#fb923c')}
      ${blk('Otros',p.otros,'#556070')}
    </div>
    <div class="pr-sign-row">
      <div class="pr-sign">Firma y Sello Médico Tratante<br><br><br>${esc(p.medico_tratante)||'____________________________'}</div>
      <div class="pr-sign">Firma Enfermería<br><br><br>____________________________</div>
      <div class="pr-sign">Aclaración y Fecha<br><br><br>____________________________</div>
    </div>
    <div class="pr-footer">Clinic · ${fPrint} · ${hPrint} · Documento confidencial.</div>
  </div>`;
  window.print();
};

window.closeRpt=function(){ document.getElementById('rpt-overlay').classList.remove('open'); };
window.closeRptIfBg=function(e){ if(e.target===document.getElementById('rpt-overlay')) window.closeRpt(); };

/* ══════════════════════════════
   CSV EXPORT MODAL
══════════════════════════════ */
window.openCsvModal = function() {
  buildCsvCols();
  document.getElementById('csv-overlay').classList.add('open');
  updateCsvCount();
};
window.closeCsvModal=function(){ document.getElementById('csv-overlay').classList.remove('open'); };
window.closeCsvIfBg=function(e){ if(e.target===document.getElementById('csv-overlay')) window.closeCsvModal(); };

function buildCsvCols() {
  const source = document.getElementById('csv-source').value;
  const cols   = source==='pacientes' ? DB_COLS : CTRL_COLS;
  const labels = source==='pacientes' ? DB_LABELS : CTRL_LABELS;
  const cont   = document.getElementById('csv-cols-container');
  cont.innerHTML = cols.map(c=>`
    <label class="csv-col-item">
      <input type="checkbox" value="${c}" checked onchange="updateCsvCount()">
      ${labels[c]||c}
    </label>`).join('');
}
document.getElementById('csv-source').addEventListener('change',()=>{ buildCsvCols(); updateCsvCount(); });

function updateCsvCount() {
  const source = document.getElementById('csv-source').value;
  const n = source==='pacientes' ? filteredList.length : csvControles.length;
  document.getElementById('csv-row-count').textContent=`${n} fila${n!==1?'s':''}`;
}

window.csvSelectAll=function(val){ document.querySelectorAll('#csv-cols-container input[type=checkbox]').forEach(c=>{ c.checked=val; }); };

window.doExportCSV = async function() {
  const source = document.getElementById('csv-source').value;
  const checked = Array.from(document.querySelectorAll('#csv-cols-container input:checked')).map(i=>i.value);
  if (!checked.length) { toast('Seleccioná al menos una columna.','error'); return; }

  let rows, labels, data;
  if (source==='pacientes') {
    data   = filteredList;
    labels = checked.map(c=>DB_LABELS[c]||c);
    rows   = data.map(p=>checked.map(c=>`"${(p[c]||'').toString().replace(/"/g,'""')}"`).join(','));
  } else {
    // Cargar todos los controles si no están
    if (!csvControles.length) {
      toast('Cargando controles…','info');
      const { data: d, error } = await sb.from(C_TABLE).select('*,pacientes(apellido,nombres,dni)').order('fecha',{ascending:false});
      if (error) { toast(`Error: ${error.message}`,'error'); return; }
      csvControles = d || [];
    }
    data   = csvControles;
    labels = ['Paciente','DNI',...checked.filter(c=>c!=='fecha').map(c=>CTRL_LABELS[c]||c)];
    if (checked.includes('fecha')) labels = ['Fecha','Paciente','DNI',...checked.filter(c=>c!=='fecha').map(c=>CTRL_LABELS[c]||c)];
    rows = data.map(c=>{
      const pac = c.pacientes||{};
      const base = [`"${pac.apellido||''}, ${pac.nombres||''}"`,`"${pac.dni||''}"`];
      const vals = checked.filter(col=>col!=='fecha').map(col=>`"${(c[col]||'').toString().replace(/"/g,'""')}"`);
      if (checked.includes('fecha')) return [`"${c.fecha||''}"`, ...base, ...vals].join(',');
      return [...base,...vals].join(',');
    });
  }

  const csv=[labels.join(','),...rows].join('\n');
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8;'}));
  a.download=`${source}_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  toast('CSV descargado.','success');
  closeCsvModal();
};

/* ══════════════════════════════
   ADJUNTOS
══════════════════════════════ */

async function renderGallery(pid,cid){
  const cont=document.getElementById(cid);
  cont.innerHTML='<p style="font-size:12px;color:var(--text-muted)">Cargando…</p>';
  const files=await loadAttachments(pid);
  await signPaths(files.map(f=>`${pid}/${f.name}`));
  if(!files.length){ cont.innerHTML='<p style="font-size:12px;color:var(--text-muted)">Sin adjuntos todavía.</p>'; return; }
  const items=files.map(f=>{
    const path=`${pid}/${f.name}`,url=attachUrl(path),isImg=/\.(jpe?g|png|gif|webp|heic|heif)$/i.test(f.name);
    return `<div class="gallery-item" title="${esc(f.name)}">
      ${isImg?`<img src="${url}" alt="${esc(f.name)}" onclick="openLightbox('${url}')" loading="lazy">`:`<div style="display:grid;place-items:center;height:100%;font-size:11px;color:var(--text-muted);padding:6px;text-align:center;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" width="28" height="28"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14,2 14,8 20,8"/></svg><a href="${url}" target="_blank" style="color:var(--accent);font-size:10px;margin-top:4px">Abrir</a></div>`}
      <button class="del-attach" onclick="removeAttach('${path}','${pid}','${cid}')" title="Eliminar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
      <div class="attach-name">${esc(f.name)}</div>
    </div>`;
  });
  cont.innerHTML=`<div class="gallery">${items.join('')}</div>`;
}

window.removeAttach=async function(path,pid,cid){ if(!confirm('¿Eliminar este adjunto?')) return; try{ await deleteAttachment(path); toast('Adjunto eliminado.','info'); await renderGallery(pid,cid); }catch(e){ toast(`Error: ${e.message}`,'error'); } };
window.handleFileUpload=async function(input,pid,cid){
  const files=Array.from(input.files); if(!files.length) return;
  const allowed=files.filter(f=>/\.(jpe?g|png|gif|webp|heic|heif|pdf)$/i.test(f.name));
  if(allowed.length!==files.length) toast('Solo imágenes y PDF.','error');
  if(!allowed.length) return;
  const prog=document.getElementById('attach-prog-'+pid),bar=document.getElementById('attach-bar-'+pid);
  prog.classList.add('show');
  for(let i=0;i<allowed.length;i++){
    bar.style.width=`${Math.round((i/allowed.length)*100)}%`;
    prog.querySelector('span').textContent=`Subiendo ${i+1}/${allowed.length}: ${allowed[i].name}`;
    try{ await uploadAttachment(pid,allowed[i]); }catch(e){ toast(`Error: ${e.message}`,'error'); }
  }
  bar.style.width='100%'; prog.querySelector('span').textContent='¡Listo!';
  setTimeout(()=>{ prog.classList.remove('show'); bar.style.width='0%'; },1200);
  input.value=''; toast(`${allowed.length} archivo(s) subido(s).`,'success');
  await renderGallery(pid,cid);
};

/* ══════════════════════════════
   HELPERS
══════════════════════════════ */

/* ══════════════════════════════
   SEARCH / FILTER
══════════════════════════════ */
window.onSearch=function(val){ searchQuery=val.trim().toLowerCase(); document.getElementById('s-clear').classList.toggle('show',!!searchQuery); page=1; applyFilters(); renderMain(); renderDash(); };
window.clearSearch=function(){ document.getElementById('search-input').value=''; window.onSearch(''); };
window.setChip=function(key,el){ document.querySelectorAll('.chip').forEach(c=>c.classList.remove('active')); el.classList.add('active'); activeFilter=key; page=1; applyFilters(); renderMain(); };
function applyFilters(){
  let list=[...pacientes];
  if(searchQuery){ const q=searchQuery; list=list.filter(p=>DB_COLS.some(col=>p[col]&&String(p[col]).toLowerCase().includes(q))); }
  if(activeFilter==='patologia') list=list.filter(p=>p.patologia);
  if(activeFilter==='historia')  list=list.filter(p=>p.historia_clinica);
  if(activeFilter==='estudios')  list=list.filter(p=>p.estudios_complementarios);
  filteredList=list;
}

/* ══════════════════════════════
   RENDER
══════════════════════════════ */
function renderAll(){ applyFilters(); updateStats(); renderDash(); renderMain(); renderHistoria(); renderEstudios(); document.getElementById('badge-total').textContent=pacientes.length; }
function updateStats(){
  document.getElementById('s-total').textContent=pacientes.length;
  document.getElementById('s-historia').textContent=pacientes.filter(p=>p.historia_clinica).length;
  document.getElementById('s-estudios').textContent=pacientes.filter(p=>p.estudios_complementarios).length;
  document.getElementById('s-patologias').textContent=pacientes.filter(p=>p.patologia).length;
}
function tagC(id){ let n=0; if(id) for(let i=0;i<Math.min(id.length,8);i++) n+=id.charCodeAt(i); return TAGS[n%TAGS.length]; }
function initials(p){ return ((p.apellido||'')[0]||'').toUpperCase()+((p.nombres||'')[0]||'').toUpperCase(); }
function hl(text){ if(!text) return '—'; const t=String(text); if(!searchQuery) return esc(t); const re=new RegExp('('+searchQuery.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+')','gi'); return t.split(re).map((s,i)=>i%2?'<mark style="background:rgba(20,166,150,.3);color:var(--text);border-radius:2px;padding:0 1px">'+esc(s)+'</mark>':esc(s)).join(''); }

function emptyRow(cols,ico,title,text){ return `<tr><td colspan="${cols}"><div class="empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round">${ico}</svg><div class="empty-title">${title}</div><div class="empty-text">${text}</div></div></td></tr>`; }
function patientCell(p){ return `<td><div style="display:flex;align-items:center;gap:10px;"><div style="width:30px;height:30px;border-radius:7px;flex-shrink:0;background:linear-gradient(135deg,var(--accent),var(--accent2));display:grid;place-items:center;font-size:11px;font-weight:600;color:#fff;">${esc(initials(p))}</div><div><div class="td-p">${hl(p.apellido)}, ${hl(p.nombres)}</div><div class="td-s">${esc(p.mail)||''}</div></div></div></td>`; }
function statusCell(p){
  const active = p.activo !== false;
  return `<td><div style="display:flex;align-items:center;gap:8px;">
    <label class="pac-switch" title="${active?'Deshabilitar paciente':'Habilitar paciente'}">
      <input type="checkbox" ${active?'checked':''} onchange="toggleActivo('${p.id}', this.checked, this)">
      <span class="slider"></span>
    </label>
    <span class="status-badge ${active?'active':'inactive'}" id="status-badge-${p.id}">${active?'Activo':'Inactivo'}</span>
  </div></td>`;
}
window.toggleActivo = async function(id, checked, inputEl){
  inputEl.disabled = true;
  const { error } = await sb.from(TABLE).update({ activo: checked }).eq('id', id);
  inputEl.disabled = false;
  if (error) { toast(`Error: ${error.message}`,'error'); inputEl.checked = !checked; return; }
  const p = pacientes.find(x=>x.id===id);
  if (p) p.activo = checked;
  const badge = document.getElementById(`status-badge-${id}`);
  if (badge) { badge.textContent = checked?'Activo':'Inactivo'; badge.className = `status-badge ${checked?'active':'inactive'}`; }
  toast(checked?'Paciente habilitado.':'Paciente deshabilitado.','success');
};
function actionsCell(id){ return `<td><div class="act-row">
  <button class="ic-btn ic-btn-blue"  onclick="openDet('${id}')"          title="Ver ficha"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">${ICO_EYE}</svg></button>
  <button class="ic-btn" style="background:rgba(139,92,246,.12);color:#a78bfa;" onclick="openEntrada('${id}')" title="Nueva entrada del día"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" width="14" height="14"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></button>
  <button class="ic-btn ic-btn-amber" onclick="printPaciente('${id}')"    title="Imprimir ficha"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="6,9 6,2 18,2 18,9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg></button>
  <button class="ic-btn ic-btn-green" onclick="openForm('${id}')"         title="Editar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">${ICO_EDIT}</svg></button>
  ${isAdmin ? `<button class="ic-btn ic-btn-red" onclick="askDelete('${id}')" title="Eliminar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">${ICO_DEL}</svg></button>` : ''}
</div></td>`; }

function renderDash(){ const list=filteredList.slice(0,6),tb=document.getElementById('dash-tbody'); if(!list.length){tb.innerHTML=emptyRow(6,ICO_USERS,'Sin pacientes','Registrá el primer paciente');return;} tb.innerHTML=list.map(p=>`<tr>${patientCell(p)}<td><span class="td-m">${esc(p.dni)||'—'}</span></td><td>${esc(p.patologia)?`<span class="tag ${tagC(p.id)}">${hl(p.patologia)}</span>`:'<span style="color:var(--text-muted)">—</span>'}</td><td>${esc(p.medico_tratante)?hl(p.medico_tratante):'<span style="color:var(--text-muted)">—</span>'}</td><td>${esc(p.ciudad)?hl(p.ciudad):'<span style="color:var(--text-muted)">—</span>'}</td>${actionsCell(p.id)}</tr>`).join(''); }
function renderMain(){
  const total=filteredList.length,pages=Math.max(1,Math.ceil(total/PER));
  page=Math.min(page,pages);
  const slice=filteredList.slice((page-1)*PER,page*PER);
  document.getElementById('tbl-count').textContent=`${total} paciente${total!==1?'s':''}${searchQuery?' (búsqueda activa)':''}`;
  document.getElementById('pg-info').textContent=`${slice.length} de ${total}`;
  const banner=document.getElementById('result-banner');
  banner.innerHTML=searchQuery&&total>0?`<div class="result-banner"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>${total} resultado${total!==1?'s':''} para "<strong>${esc(searchQuery)}</strong>" — búsqueda en todos los campos</div>`:'';
  const tb=document.getElementById('main-tbody');
  if(!slice.length){tb.innerHTML=emptyRow(8,ICO_USERS,searchQuery?'Sin resultados':'Sin pacientes',searchQuery?`No hay coincidencias para "${esc(searchQuery)}"`:'Registrá el primer paciente');}
  else{tb.innerHTML=slice.map(p=>`<tr>${patientCell(p)}<td><span class="td-m">${hl(p.dni)||'—'}</span></td><td>${esc(p.telefonos)?hl(p.telefonos):'<span style="color:var(--text-muted)">—</span>'}</td><td>${esc(p.patologia)?`<span class="tag ${tagC(p.id)}">${hl(p.patologia)}</span>`:'<span style="color:var(--text-muted)">—</span>'}</td><td>${esc(p.medico_tratante)?hl(p.medico_tratante):'<span style="color:var(--text-muted)">—</span>'}</td><td>${esc(p.ciudad)?hl(p.ciudad):'<span style="color:var(--text-muted)">—</span>'}</td>${statusCell(p)}${actionsCell(p.id)}</tr>`).join('');}
  renderPagination(pages,total);
}
function renderPagination(pages,total){
  const c=document.getElementById('pg-btns'); if(!total){c.innerHTML='';return;}
  const arr=(d,n)=>`<button class="pg-btn" onclick="goPage(${n})" ${(d==='p'&&page===1)||(d==='n'&&page===pages)?'disabled':''}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" width="12" height="12"><polyline points="${d==='p'?'15,18 9,12 15,6':'9,18 15,12 9,6'}"/></svg></button>`;
  let h=arr('p',page-1);
  for(let i=1;i<=pages;i++){ if(pages<=7||i===1||i===pages||Math.abs(i-page)<=1) h+=`<button class="pg-btn ${i===page?'active':''}" onclick="goPage(${i})">${i}</button>`; else if(Math.abs(i-page)===2) h+=`<button class="pg-btn" disabled>…</button>`; }
  h+=arr('n',page+1); c.innerHTML=h;
}
window.goPage=function(n){ const pages=Math.max(1,Math.ceil(filteredList.length/PER)); if(n<1||n>pages) return; page=n; renderMain(); };
function renderHistoria(){ const list=pacientes.filter(p=>p.historia_clinica||p.epicrisis||p.diagnostico_medico),tb=document.getElementById('hist-tbody'); tb.innerHTML=!list.length?emptyRow(5,ICO_DOC,'Sin historias clínicas','Completá la historia clínica al editar un paciente'):list.map(p=>`<tr><td class="td-p">${esc(p.apellido)}, ${esc(p.nombres)}</td><td style="max-width:200px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:12px;">${esc(p.historia_clinica)||'—'}</td><td style="max-width:160px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:12px;">${esc(p.epicrisis)||'—'}</td><td style="max-width:160px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:12px;">${esc(p.diagnostico_medico)||'—'}</td><td><button class="ic-btn ic-btn-blue" onclick="openDet('${p.id}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">${ICO_EYE}</svg></button></td></tr>`).join(''); }
function renderEstudios(){ const list=pacientes.filter(p=>p.estudios_complementarios||p.observaciones),tb=document.getElementById('est-tbody'); tb.innerHTML=!list.length?emptyRow(4,ICO_FLASK,'Sin estudios cargados','Cargá estudios al editar un paciente'):list.map(p=>`<tr><td class="td-p">${esc(p.apellido)}, ${esc(p.nombres)}</td><td style="max-width:260px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:12px;">${esc(p.estudios_complementarios)||'—'}</td><td style="max-width:200px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:12px;">${esc(p.observaciones)||'—'}</td><td><button class="ic-btn ic-btn-blue" onclick="openDet('${p.id}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">${ICO_EYE}</svg></button></td></tr>`).join(''); }

/* ══════════════════════════════
   MODALES
══════════════════════════════ */
window.openForm=async function(id=null){
  editId=id||null;
  clearFormValues();
  selectedProfIds=[];
  document.getElementById('prof-multi-q').value='';
  document.getElementById('prof-form-title') // just ensure profs loaded
  buildProfMultiList();
  renderProfTags();
  document.getElementById('form-modal-title').textContent=id?'Editar Paciente':'Nuevo Paciente';
  if(id){
    const p=pacientes.find(x=>x.id===id);
    if(p) setFormValues(p);
    await loadPatientProfs(id);
  }
  document.getElementById('form-overlay').classList.add('open');
};
window.closeForm=function(){ document.getElementById('form-overlay').classList.remove('open'); editId=null; };
window.closeFormIfBg=function(e){ if(e.target===document.getElementById('form-overlay')) window.closeForm(); };

/* ══════════════════════════════
   ENTRADA DIARIA
══════════════════════════════ */
window.openEntrada = function(pacienteId) {
  entradaPacId    = pacienteId;
  entradaImgFiles = [];
  const p = pacientes.find(x => x.id === pacienteId);

  // Header with patient info
  const inits = ((p?.apellido||'')[0]||'').toUpperCase() + ((p?.nombres||'')[0]||'').toUpperCase();
  document.getElementById('entrada-avatar').textContent    = inits || '?';
  document.getElementById('entrada-pac-name').textContent  = p ? `${p.apellido}, ${p.nombres}` : '—';
  document.getElementById('entrada-pac-meta').textContent  = [p?.patologia, p?.medico_tratante].filter(Boolean).join(' · ') || 'Sin datos adicionales';
  document.getElementById('entrada-title').textContent     = 'Nueva entrada del día';
  document.getElementById('entrada-sub').textContent       = 'Registrá la evolución diaria del paciente';

  // Reset form
  ['e-enfermeria','e-kinesiologia','e-diagnostico','e-observaciones','e-otros_prof','e-otros','e-responsable'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  document.getElementById('e-fecha').value   = fmtDate(new Date());
  document.getElementById('e-turno').value   = '';
  document.getElementById('entrada-img-preview').innerHTML = '';
  document.getElementById('entrada-img-input').value = '';
  document.getElementById('entrada-upload-prog').style.display = 'none';

  document.getElementById('entrada-overlay').classList.add('open');
};

window.closeEntrada = function() {
  document.getElementById('entrada-overlay').classList.remove('open');
  entradaPacId    = null;
  entradaImgFiles = [];
};
window.closeEntradaIfBg = function(e) {
  if (e.target === document.getElementById('entrada-overlay')) window.closeEntrada();
};

/* Previsualiza imágenes antes de subir — con checkbox "incluir en PDF" */
window.previewEntradaImages = function(input) {
  const files = Array.from(input.files).filter(f => /\.(jpe?g|png|gif|webp|heic|heif)$/i.test(f.name));
  if (!files.length) return;

  files.forEach(file => {
    if (!entradaImgFiles.find(f => f.name === file.name && f.size === file.size)) {
      entradaImgFiles.push({ file, incluirPdf: true });
    }
  });
  renderEntradaPreview();
  input.value = ''; // reset so same file can be re-added if needed
};

function renderEntradaPreview() {
  const cont = document.getElementById('entrada-img-preview');
  if (!entradaImgFiles.length) { cont.innerHTML = ''; return; }
  cont.innerHTML = entradaImgFiles.map((item, i) => {
    const url = URL.createObjectURL(item.file);
    return `<div class="img-preview-item" id="prev-item-${i}">
      <img src="${url}" alt="${esc(item.file.name)}" onclick="openLightbox('${url}')">
      <button class="img-remove" onclick="removeEntradaImg(${i})" title="Quitar">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
      </button>
      <label class="img-pdf-toggle ${item.incluirPdf ? 'active' : ''}" id="pdf-toggle-${i}">
        <input type="checkbox" ${item.incluirPdf ? 'checked' : ''} onchange="togglePdfImg(${i},this.checked)">
        Incluir en PDF
      </label>
    </div>`;
  }).join('');
}

window.removeEntradaImg = function(i) {
  entradaImgFiles.splice(i, 1);
  renderEntradaPreview();
};

window.togglePdfImg = function(i, val) {
  if (entradaImgFiles[i]) {
    entradaImgFiles[i].incluirPdf = val;
    const tog = document.getElementById(`pdf-toggle-${i}`);
    if (tog) tog.classList.toggle('active', val);
  }
};

/* Guarda la entrada: inserta en controles, sube imágenes a Storage, guarda refs en control_imagenes */
window.saveEntrada = async function() {
  const fecha = document.getElementById('e-fecha').value;
  if (!fecha) { toast('La fecha es obligatoria.', 'error'); return; }
  if (!entradaPacId) return;

  const btn = document.getElementById('btn-entrada-save');
  const txt = document.getElementById('btn-entrada-txt');
  btn.disabled = true; txt.textContent = 'Guardando…';

  // 1. Insertar en controles
  const payload = {
    paciente_id:         entradaPacId,
    fecha,
    enfermeria:          document.getElementById('e-enfermeria').value.trim()    || null,
    kinesiologia:        document.getElementById('e-kinesiologia').value.trim()  || null,
    diagnostico_medico:  document.getElementById('e-diagnostico').value.trim()   || null,
    observaciones:       document.getElementById('e-observaciones').value.trim() || null,
    otros_profesionales: document.getElementById('e-otros_prof').value.trim()    || null,
    otros:               document.getElementById('e-otros').value.trim()          || null,
    responsable:         document.getElementById('e-responsable').value.trim()   || null,
    turno:               document.getElementById('e-turno').value                || null,
  };

  const { data: ctrlData, error: ctrlError } = await sb.from(C_TABLE).insert(payload).select().single();
  if (ctrlError) {
    toast(`Error al guardar: ${ctrlError.message}`, 'error');
    btn.disabled = false; txt.textContent = 'Guardar entrada'; return;
  }

  const controlId = ctrlData.id;

  // 2. Subir imágenes si hay
  if (entradaImgFiles.length) {
    const prog    = document.getElementById('entrada-upload-prog');
    const bar     = document.getElementById('entrada-prog-bar');
    const progTxt = document.getElementById('entrada-prog-txt');
    prog.style.display = 'block';

    for (let i = 0; i < entradaImgFiles.length; i++) {
      const { file, incluirPdf } = entradaImgFiles[i];
      bar.style.width = `${Math.round((i / entradaImgFiles.length) * 100)}%`;
      progTxt.textContent = `Subiendo ${i+1}/${entradaImgFiles.length}: ${file.name}`;

      const safeName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g,'_')}`;
      const storagePath = `${entradaPacId}/${controlId}/${safeName}`;

      const { error: upErr } = await sb.storage.from(BUCKET).upload(storagePath, file, { upsert: false, contentType: file.type });
      if (upErr) { toast(`Error subiendo ${file.name}: ${upErr.message}`, 'error'); continue; }

      // Guardar referencia en control_imagenes
      await sb.from(CI_TABLE).insert({
        control_id:   controlId,
        paciente_id:  entradaPacId,
        storage_path: storagePath,
        nombre:       file.name,
        incluir_pdf:  incluirPdf,
      });
    }

    bar.style.width = '100%'; progTxt.textContent = '¡Listo!';
    setTimeout(() => { prog.style.display = 'none'; bar.style.width = '0%'; }, 1200);
  }

  btn.disabled = false; txt.textContent = 'Guardar entrada';
  toast('Entrada guardada correctamente.', 'success');
  window.closeEntrada();
};

window.openDet=function(id){ location.href='paciente.html?id='+id; };
window.closeDet=function(){ document.getElementById('det-overlay')?.classList.remove('open'); };
window.closeDetIfBg=function(e){ if(e.target===document.getElementById('det-overlay')) window.closeDet(); };
window.switchTab=function(name,el){ document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active')); document.querySelectorAll('.tab-pane').forEach(t=>t.classList.remove('active')); el.classList.add('active'); document.getElementById('tab-'+name).classList.add('active'); };
window.closeDel=function(){ document.getElementById('del-overlay').classList.remove('open'); deleteId=null; };
window.closeDelIfBg=function(e){ if(e.target===document.getElementById('del-overlay')) window.closeDel(); };

/* ══════════════════════════════
   CRUD PROFESIONALES
══════════════════════════════ */
async function loadProfesionales() {
  const { data, error } = await sb.from(P_TABLE).select('*').order('apellido');
  if (error) { toast(`Error cargando profesionales: ${error.message}`,'error'); return; }
  profesionales = data || [];
  document.getElementById('prof-count').textContent = `${profesionales.length} profesional${profesionales.length!==1?'es':''}`;
  buildProfMultiList();
}

function renderProfesionales() {
  const tb = document.getElementById('prof-tbody');
  if (!profesionales.length) {
    tb.innerHTML = emptyRow(6,
      `<path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>`,
      'Sin profesionales', 'Agregá el primer profesional médico');
    return;
  }
  tb.innerHTML = profesionales.map(p => {
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
  profesionales.forEach(p => loadProfPacCount(p.id));
}

async function loadProfPacCount(profId) {
  const { count } = await sb.from(PP_TABLE).select('*',{count:'exact',head:true}).eq('profesional_id', profId);
  const el = document.getElementById(`prof-pac-count-${profId}`);
  if (el) el.textContent = `${count||0} pac.`;
}

window.openProfForm = function(id=null) {
  if (!isAdmin) return;
  editProfId = id || null;
  ['pf-apellido','pf-nombres','pf-especialidad','pf-matricula','pf-telefono','pf-mail','pf-domicilio','pf-ciudad','pf-observaciones']
    .forEach(fid => { const e=document.getElementById(fid); if(e) e.value=''; });
  document.getElementById('prof-form-title').textContent = id ? 'Editar Profesional' : 'Nuevo Profesional';
  if (id) {
    const p = profesionales.find(x=>x.id===id);
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

window.closeProfForm = function() { document.getElementById('prof-form-overlay').classList.remove('open'); editProfId=null; };
window.closeProfFormIfBg = function(e) { if(e.target===document.getElementById('prof-form-overlay')) window.closeProfForm(); };

window.saveProfesional = async function() {
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
  let error;
  if (editProfId) { ({error}=await sb.from(P_TABLE).update(payload).eq('id',editProfId)); }
  else { ({error}=await sb.from(P_TABLE).insert(payload)); }
  btn.disabled=false; txt.textContent='Guardar';
  if (error) { toast(`Error: ${error.message}`,'error'); return; }
  toast(editProfId?'Profesional actualizado.':'Profesional registrado.','success');
  window.closeProfForm();
  await loadProfesionales();
  renderProfesionales();
};

window.deleteProfesional = async function(id) {
  if (!isAdmin) return;
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

/* ══════════════════════════════
   MULTISELECT PROFESIONALES (form paciente)
══════════════════════════════ */
function buildProfMultiList(filter='') {
  const list = document.getElementById('prof-multi-list');
  if (!list) return;
  const q = filter.toLowerCase();
  const items = profesionales.filter(p =>
    !q || `${p.apellido} ${p.nombres} ${p.especialidad||''}`.toLowerCase().includes(q)
  );
  if (!items.length) {
    list.innerHTML='<div style="padding:10px;font-size:12px;color:var(--text-muted)">Sin resultados.</div>';
    return;
  }
  list.innerHTML = items.map(p => {
    const sel = selectedProfIds.includes(p.id);
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
  if (checked && !selectedProfIds.includes(profId)) selectedProfIds.push(profId);
  else if (!checked) selectedProfIds = selectedProfIds.filter(x=>x!==profId);
  // Update item style
  const item = document.getElementById(`pmi-${profId}`);
  if (item) item.classList.toggle('selected', checked);
  renderProfTags();
};

function renderProfTags() {
  const cont = document.getElementById('prof-selected-tags');
  if (!cont) return;
  cont.innerHTML = selectedProfIds.map(id => {
    const p = profesionales.find(x=>x.id===id);
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
async function loadPatientProfs(pacienteId) {
  const { data } = await sb.from(PP_TABLE).select('profesional_id').eq('paciente_id', pacienteId);
  selectedProfIds = (data||[]).map(r=>r.profesional_id);
  buildProfMultiList();
  renderProfTags();
}

// Save profesional links for a patient
async function saveProfLinks(pacienteId) {
  // Get current links
  const { data: existing } = await sb.from(PP_TABLE).select('profesional_id').eq('paciente_id', pacienteId);
  const existingIds = (existing||[]).map(r=>r.profesional_id);
  // Insert new
  const toAdd = selectedProfIds.filter(id => !existingIds.includes(id));
  if (toAdd.length) await sb.from(PP_TABLE).insert(toAdd.map(pid=>({paciente_id:pacienteId,profesional_id:pid})));
  // Remove old
  const toRemove = existingIds.filter(id => !selectedProfIds.includes(id));
  for (const pid of toRemove) await sb.from(PP_TABLE).delete().eq('paciente_id',pacienteId).eq('profesional_id',pid);
}

/* ══════════════════════════════
   CRUD USUARIOS (admin only)
══════════════════════════════ */
async function renderUsuarios() {
  if (!isAdmin) return;
  const tb = document.getElementById('usr-tbody');
  tb.innerHTML = '<tr class="loading-row"><td colspan="5">Cargando…</td></tr>';
  const { data, error } = await sb.from(USR_TABLE).select('*').order('created_at');
  if (error) { toast(`Error: ${error.message}`,'error'); return; }
  usuarios = data || [];
  document.getElementById('usr-count').textContent = `${usuarios.length} usuario${usuarios.length!==1?'s':''}`;
  if (!usuarios.length) {
    tb.innerHTML = emptyRow(5,`<circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 10-16 0"/>`,'Sin usuarios','—');
    return;
  }
  tb.innerHTML = usuarios.map(u => {
    const isSelf = u.id === currentUser?.id;
    const date = u.created_at ? new Date(u.created_at).toLocaleDateString('es-AR',{day:'2-digit',month:'short',year:'numeric'}) : '—';
    return `<tr>
      <td><div class="td-p">${esc(u.email)||'—'}${isSelf?'<span style="font-size:10px;color:var(--accent);margin-left:6px;">(vos)</span>':''}</div></td>
      <td>${esc(u.nombre)||'<span style="color:var(--text-muted)">—</span>'}</td>
      <td><span class="role-badge ${u.rol==='admin'?'role-admin':'role-usuario'}">${u.rol==='admin'?'Admin':'Usuario'}</span></td>
      <td class="td-s">${date}</td>
      <td><div class="act-row">
        <button class="ic-btn ic-btn-green" onclick="openUsrForm('${u.id}')" title="Editar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">${ICO_EDIT}</svg></button>
        ${!isSelf?`<button class="ic-btn ic-btn-red" onclick="deleteUsuario('${u.id}')" title="Eliminar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">${ICO_DEL}</svg></button>`:''}
      </div></td>
    </tr>`;
  }).join('');
}

window.openUsrForm = function(id=null) {
  if (!isAdmin) return;
  editUsrId = id || null;
  document.getElementById('uf-email').value  = '';
  document.getElementById('uf-nombre').value = '';
  document.getElementById('uf-rol').value    = 'usuario';
  document.getElementById('uf-pw').value     = '';
  const pwWrap = document.getElementById('uf-pw-wrap');

  if (id) {
    const u = usuarios.find(x=>x.id===id);
    if (u) {
      document.getElementById('uf-email').value  = u.email||'';
      document.getElementById('uf-nombre').value = u.nombre||'';
      document.getElementById('uf-rol').value    = u.rol||'usuario';
    }
    document.getElementById('usr-form-title').textContent = 'Editar Usuario';
    document.getElementById('usr-form-sub').textContent   = 'Modificá nombre, rol o contraseña';
    if (pwWrap) pwWrap.style.display='block';
  } else {
    document.getElementById('usr-form-title').textContent = 'Nuevo Usuario';
    document.getElementById('usr-form-sub').textContent   = 'Ingresá email y contraseña inicial';
    if (pwWrap) pwWrap.style.display='block';
  }
  document.getElementById('usr-form-overlay').classList.add('open');
};

window.closeUsrForm  = function() { document.getElementById('usr-form-overlay').classList.remove('open'); editUsrId=null; };
window.closeUsrFormIfBg = function(e) { if(e.target===document.getElementById('usr-form-overlay')) window.closeUsrForm(); };

window.saveUsuario = async function() {
  if (!isAdmin) return;
  const email  = document.getElementById('uf-email').value.trim();
  const nombre = document.getElementById('uf-nombre').value.trim();
  const rol    = document.getElementById('uf-rol').value;
  const pw     = document.getElementById('uf-pw').value;

  const btn=document.getElementById('btn-usr-save'),txt=document.getElementById('btn-usr-save-txt');
  btn.disabled=true; txt.textContent='Guardando…';

  if (editUsrId) {
    // Update perfil (nombre + rol)
    const { error:pe } = await sb.from(USR_TABLE).update({nombre,rol}).eq('id',editUsrId);
    if (pe) { toast(`Error: ${pe.message}`,'error'); btn.disabled=false; txt.textContent='Guardar'; return; }
    // Password change via user's own session (only works for self) — admin needs service key for others
    // We update the perfil and show a note if pw was typed
    if (pw && pw.length >= 6) {
      if (editUsrId === currentUser?.id) {
        const { error:pwe } = await sb.auth.updateUser({ password: pw });
        if (pwe) { toast(`Error al cambiar contraseña: ${pwe.message}`,'error'); }
        else { toast('Contraseña actualizada.','success'); }
      } else {
        toast('⚠️ Para cambiar la contraseña de otro usuario, hacelo desde el Dashboard de Supabase → Authentication → Users.','info');
      }
    }
    toast('Usuario actualizado.','success');
  } else {
    // New user: create via signUp (sends confirmation email)
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast('Email inválido.','error'); btn.disabled=false; txt.textContent='Guardar'; return;
    }
    if (!pw || pw.length < 6) {
      toast('La contraseña debe tener al menos 6 caracteres.','error'); btn.disabled=false; txt.textContent='Guardar'; return;
    }
    // Use Supabase Admin API if available, fallback: create via signUp
    // Note: signUp from another session won't auto-login — user gets email confirmation
    const { data: nu, error: ne } = await sb.auth.signUp({ email, password: pw, options:{ emailRedirectTo: window.location.href } });
    if (ne) { toast(`Error: ${ne.message}`,'error'); btn.disabled=false; txt.textContent='Guardar'; return; }
    // Update perfil record
    if (nu?.user) {
      await sb.from(USR_TABLE).update({nombre,rol,email}).eq('id',nu.user.id);
    }
    toast('Usuario creado. Recibirá un email de confirmación.','success');
  }
  btn.disabled=false; txt.textContent='Guardar';
  window.closeUsrForm();
  await renderUsuarios();
};

window.deleteUsuario = async function(id) {
  if (!isAdmin || id===currentUser?.id) return;
  if (!confirm('¿Eliminar este usuario? No podrá más acceder al sistema.')) return;
  // Delete perfil (auth.users requires service key — we delete the profile row)
  const { error } = await sb.from(USR_TABLE).delete().eq('id',id);
  if (error) { toast(`Error: ${error.message}`,'error'); return; }
  toast('Perfil eliminado. Para eliminar el acceso definitivamente, remové el usuario en Supabase Dashboard → Authentication.','info');
  await renderUsuarios();
};
window.openLightbox=function(url){ document.getElementById('lightbox-img').src=url; document.getElementById('lightbox').classList.add('open'); };
window.closeLightbox=function(){ document.getElementById('lightbox').classList.remove('open'); };

/* ══════════════════════════════
   NAV
══════════════════════════════ */
window.showView=function(name,el){
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
  const view = document.getElementById('view-'+name);
  if (!view) return;
  view.classList.add('active');
  if(el) el.classList.add('active');
  document.getElementById('page-title').textContent=VIEW_TITLES[name]||name;
  if(name==='historia') renderHistoria();
  if(name==='estudios') renderEstudios();
  if(name==='profesionales') renderProfesionales();
  if(name==='usuarios' && isAdmin) renderUsuarios();
  if(window.innerWidth<=768) window.closeSb();
};
window.openSb=()=>{ document.getElementById('sidebar').classList.add('open'); document.getElementById('sb-overlay').classList.add('show'); };
window.closeSb=()=>{ document.getElementById('sidebar').classList.remove('open'); document.getElementById('sb-overlay').classList.remove('show'); };

window.printCredencial = function(id) {
  const p = pacientes.find(x => x.id === id);
  if (!p) { toast('Paciente no encontrado', 'error'); return; }

  // HTML de la credencial con QR y solo nombre + DNI
  const html = `
    <div class="credencial-wrapper">
      <div class="credencial-card">
        <div class="credencial-header">
          <img src="logo.svg" alt="Clinic" height="32">
          <div>
            <div class="credencial-org">Clinic</div>
            <div class="credencial-org-sub">Gestión clínica</div>
          </div>
        </div>
        <div class="credencial-body">
          <!-- Contenedor para el QR -->
          <div id="qr-${id}" style="width:20mm;height:20mm;flex-shrink:0;background:#fff;border-radius:3mm;display:flex;align-items:center;justify-content:center;"></div>
          <div class="credencial-datos">
            <div class="credencial-nombre">${esc(p.apellido)}, ${esc(p.nombres)}</div>
            <div class="credencial-dni">DNI: ${esc(p.dni) || '—'}</div>
          </div>
        </div>
      </div>
    </div>
  `;

  document.getElementById('print-report').innerHTML = html;

  // Generar el QR dentro del contenedor
  setTimeout(() => {
    const qrContainer = document.getElementById(`qr-${id}`);
    if (qrContainer) {
      new QRCode(qrContainer, {
        text: `https://athomeenfermeria.netlify.app/paciente.html?id=${id}`,
        width: 100,   // tamaño en píxeles (alta resolución para impresión)
        height: 100,
        colorDark: '#0c1017',
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.H
      });
    }
    // Esperar un poco para que el QR se renderice y luego imprimir
    setTimeout(() => window.print(), 400);
  }, 100);
};

/* ══════════════════════════════
   TOAST
══════════════════════════════ */

/* ══════════════════════════════
   KEYBOARD
══════════════════════════════ */
document.addEventListener('keydown',e=>{ if(e.key==='Escape'){window.closeForm();window.closeDet();window.closeDel();window.closeLightbox();window.closeRpt();window.closeCsvModal();window.closeEntrada();window.closeProfForm();window.closeProfDet();window.closeUsrForm();} if((e.ctrlKey||e.metaKey)&&e.key==='n'){e.preventDefault();window.openForm();} });

const s=document.createElement('style'); s.textContent='@keyframes shake{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-6px)}40%,80%{transform:translateX(6px)}}'; document.head.appendChild(s);

/* ══════════════════════════════
   THEME TOGGLE
══════════════════════════════ */
(function initTheme() {
  const saved = localStorage.getItem('mc_theme') || 'dark';
  applyTheme(saved);
})();

function applyTheme(mode) {
  const body = document.body;
  const iconDark  = document.getElementById('theme-icon-dark');
  const iconLight = document.getElementById('theme-icon-light');
  const label     = document.getElementById('theme-label');
  if (mode === 'light') {
    body.classList.add('light');
    if (iconDark)  iconDark.style.display  = 'none';
    if (iconLight) iconLight.style.display = '';
    if (label)     label.textContent       = 'Modo oscuro';
  } else {
    body.classList.remove('light');
    if (iconDark)  iconDark.style.display  = '';
    if (iconLight) iconLight.style.display = 'none';
    if (label)     label.textContent       = 'Modo claro';
  }
}

window.toggleTheme = function() {
  const isLight = document.body.classList.contains('light');
  const next = isLight ? 'dark' : 'light';
  localStorage.setItem('mc_theme', next);
  applyTheme(next);
};
