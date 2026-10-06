// Ficha del paciente: carga, render del detalle, estado y credencial.
import { state } from '../../state.js';
import { PP_TABLE, P_TABLE, TABLE, USR_TABLE, sb } from '../../supabase.js';
import { toast } from '../../ui.js';
import { fmtDate } from '../../forms.js';
import { esc } from '../../utils.js';
import { pacId } from './contexto.js';
import { renderControlesList } from './controles.js';
import { renderGallery } from '../adjuntos.js';

export async function boot(user) {
  const { data } = await sb.from(USR_TABLE).select('rol').eq('id', user.id).single();
  state.isAdmin = data?.rol === 'admin';
  const { data: profs } = await sb.from(P_TABLE).select('*').order('apellido');
  state.profesionales = profs || [];
  await loadPaciente();
}

export async function loadPaciente() {
  const { data, error } = await sb.from(TABLE).select('*').eq('id', pacId).single();
  if (error || !data) { showNotFound(); return; }
  state.paciente = data;
  document.getElementById('loading-screen').style.display = 'none';
  document.getElementById('det-page').style.display = 'flex';
  await renderPacienteDetail();
}

export function showNotFound() {
  document.getElementById('loading-screen').style.display = 'none';
  document.getElementById('not-found-screen').style.display = 'flex';
}

async function renderPacienteDetail() {
  const p = state.paciente;
  const inits = ((p.apellido||'')[0]||'').toUpperCase()+((p.nombres||'')[0]||'').toUpperCase();
  document.getElementById('det-avatar-lg').textContent = inits || '?';
  document.getElementById('det-name').textContent = `${p.apellido}, ${p.nombres}`;
  document.getElementById('det-sub').textContent = `DNI: ${p.dni||'—'}${p.ciudad?' · '+p.ciudad:''}`;
  document.getElementById('pac-page-title').textContent = `${p.apellido}, ${p.nombres}`;
  document.title = `${p.apellido}, ${p.nombres} · Clinic`;

  const active = p.activo !== false;
  document.getElementById('pac-status-badge').textContent = active ? 'Activo' : 'Inactivo';
  document.getElementById('pac-status-badge').className = `status-badge ${active ? 'active' : 'inactive'}`;
  document.getElementById('pac-status-input').checked = active;

  document.getElementById('btn-det-edit').onclick   = () => window.openForm(p.id);
  document.getElementById('btn-det-print').onclick  = () => window.printPaciente(p.id);
  document.getElementById('btn-det-credencial').onclick = () => window.printCredencial(p.id);
  document.getElementById('btn-det-rpt').onclick    = () => window.openRptModal(p.id);
  document.getElementById('btn-det-entrada').onclick= () => window.openEntrada(p.id);

  const f=v=>esc(v)||'<span style="color:var(--text-muted)">—</span>';
  const note=(lbl,val,color='var(--accent)')=>`<div class="clin-note" style="border-left-color:${color}"><div class="clin-lbl" style="color:${color}">${lbl}</div><div class="clin-txt">${esc(val)||'<span style="color:var(--text-muted)">Sin datos registrados.</span>'}</div></div>`;
  const galleryId=`gallery-${p.id}`, ctrlListId=`ctrl-list-${p.id}`;

  const {data:links}=await sb.from(PP_TABLE).select('profesional_id, profesionales(id,apellido,nombres,especialidad,matricula,telefono)').eq('paciente_id',p.id);
  const profsAsig=(links||[]).map(l=>l.profesionales).filter(Boolean);
  const profsHtml = profsAsig.length
    ? `<div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:4px;">${profsAsig.map(pr=>`
        <span style="display:inline-flex;align-items:center;gap:6px;background:rgba(16,185,129,.1);border:1px solid rgba(16,185,129,.2);border-radius:20px;padding:4px 12px 4px 8px;">
          <div class="prof-avatar" style="width:22px;height:22px;border-radius:5px;font-size:9px;">${((esc(pr.apellido)||'')[0]||'').toUpperCase()}</div>
          <span class="prof-link" style="font-size:12.5px;color:#34d399;" onclick="location.href='profesional.html?id=${pr.id}'">${esc(pr.apellido)}, ${esc(pr.nombres)}${esc(pr.especialidad)?' · '+esc(pr.especialidad):''}</span>
        </span>`).join('')}</div>`
    : '<span style="color:var(--text-muted);font-size:13px;">Sin profesionales asignados</span>';

  document.getElementById('det-body').innerHTML=`
    <div class="tabs">
      <div class="tab active" onclick="switchTab('datos',this)">Datos Personales</div>
      <div class="tab" onclick="switchTab('clinico',this)">Clínico</div>
      <div class="tab" onclick="switchTab('equipos',this)">Equipos</div>
      <div class="tab" onclick="switchTab('controles',this)">📅 Controles</div>
      <div class="tab" onclick="switchTab('adjuntos',this)">📎 Adjuntos</div>
    </div>
    <div class="tab-pane active" id="tab-datos">
      <div class="info-grid">
        <div class="info-item"><div class="info-lbl">DNI</div><div class="info-val">${f(p.dni)}</div></div>
        <div class="info-item"><div class="info-lbl">Teléfonos</div><div class="info-val">${f(p.telefonos)}</div></div>
        <div class="info-item"><div class="info-lbl">Mail</div><div class="info-val">${f(p.mail)}</div></div>
        <div class="info-item"><div class="info-lbl">Domicilio</div><div class="info-val">${f(p.domicilio)}</div></div>
        <div class="info-item"><div class="info-lbl">Ciudad</div><div class="info-val">${f(p.ciudad)}</div></div>
        <div class="info-item"><div class="info-lbl">Contacto Familia</div><div class="info-val">${f(p.contacto_familia)}</div></div>
        <div class="info-item"><div class="info-lbl">Médico Tratante</div><div class="info-val">${f(p.medico_tratante)}</div></div>
        <div class="info-item"><div class="info-lbl">Patología</div><div class="info-val">${f(p.patologia)}</div></div>
        <div class="info-item"><div class="info-lbl">Pat. 1 / 2</div><div class="info-val">${[esc(p.patologia1),esc(p.patologia2)].filter(Boolean).join(' · ')||'—'}</div></div>
      </div>
      <div style="margin-top:14px;">
        <div style="font-size:9.5px;text-transform:uppercase;letter-spacing:1px;color:var(--text-muted);margin-bottom:8px;">Profesionales Asignados</div>
        ${profsHtml}
      </div>
    </div>
    <div class="tab-pane" id="tab-clinico">
      ${note('Diagnóstico Médico',p.diagnostico_medico,'var(--accent)')}
      ${note('Historia Clínica',p.historia_clinica,'var(--success)')}
      ${note('Epicrisis',p.epicrisis,'var(--warning)')}
      ${note('Estudios Complementarios',p.estudios_complementarios,'var(--accent2)')}
      ${note('Observaciones',p.observaciones,'var(--text-muted)')}
    </div>
    <div class="tab-pane" id="tab-equipos">
      ${note('Enfermería',p.enfermeria,'#a78bfa')}
      ${note('Kinesiología',p.kinesiologia,'#34d399')}
      ${note('Otros Profesionales',p.otros_profesionales,'#fb923c')}
      ${note('Otros',p.otros,'var(--text-muted)')}
    </div>
    <div class="tab-pane" id="tab-controles">
      <div style="background:var(--surface2);border-radius:10px;padding:16px;margin-bottom:16px;">
        <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:1px;color:var(--accent);margin-bottom:12px;">Nuevo Control</div>
        <div class="fgrid" style="margin-bottom:10px;">
          <div class="f"><label>Fecha del control *</label><input type="date" id="ctrl-fecha" value="${fmtDate(new Date())}"></div>
          <div class="f"><label>Enfermería</label><textarea id="ctrl-enfermeria" placeholder="Notas de enfermería…" style="min-height:60px"></textarea></div>
          <div class="f"><label>Kinesiología</label><textarea id="ctrl-kinesiologia" placeholder="Tratamiento kinesiológico…" style="min-height:60px"></textarea></div>
          <div class="f"><label>Diagnóstico</label><textarea id="ctrl-diagnostico" placeholder="Diagnóstico del día…" style="min-height:60px"></textarea></div>
          <div class="f"><label>Observaciones</label><textarea id="ctrl-obs" placeholder="Observaciones generales…" style="min-height:60px"></textarea></div>
          <div class="f"><label>Otros Profesionales</label><textarea id="ctrl-otros-prof" placeholder="Otros…" style="min-height:60px"></textarea></div>
          <div class="f"><label>Otros</label><textarea id="ctrl-otros" placeholder="Información adicional…" style="min-height:60px"></textarea></div>
        </div>
        <div style="display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap;">
          <button class="btn btn-ghost btn-sm" onclick="openRptModal('${p.id}')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" width="13" height="13"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            Informe por período
          </button>
          <button class="btn btn-primary btn-sm" id="ctrl-save-btn" onclick="saveControl('${p.id}','${ctrlListId}')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" width="13" height="13"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17,21 17,13 7,13 7,21"/></svg>
            Guardar Control
          </button>
        </div>
      </div>
      <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:1px;color:var(--text-muted);margin-bottom:10px;">Historial de controles</div>
      <div id="${ctrlListId}"></div>
    </div>
    <div class="tab-pane" id="tab-adjuntos">
      <div class="attach-progress" id="attach-prog-${p.id}">
        <div class="prog-bar-wrap"><div class="prog-bar" id="attach-bar-${p.id}"></div></div>
        <span>Subiendo…</span>
      </div>
      <div class="attach-zone" id="attach-zone-${p.id}">
        <input type="file" multiple accept="image/*,.pdf"
          onchange="handleFileUpload(this,'${p.id}','${galleryId}')"
          ondragover="this.parentElement.classList.add('drag')"
          ondragleave="this.parentElement.classList.remove('drag')"
          ondrop="this.parentElement.classList.remove('drag')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17,8 12,3 7,8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
        <p>Tocá para seleccionar o arrastrá archivos aquí</p>
        <small>Imágenes (JPG, PNG, HEIC) y PDF · Podés subir varios a la vez</small>
      </div>
      <div id="${galleryId}"></div>
    </div>`;

  await renderGallery(p.id,galleryId);
  await renderControlesList(p.id,ctrlListId);
}

window.toggleActivo = async function(checked, inputEl) {
  if (!state.paciente) return;
  inputEl.disabled = true;
  const { error } = await sb.from(TABLE).update({ activo: checked }).eq('id', state.paciente.id);
  inputEl.disabled = false;
  if (error) { toast(`Error: ${error.message}`, 'error'); inputEl.checked = !checked; return; }
  state.paciente.activo = checked;
  const badge = document.getElementById('pac-status-badge');
  badge.textContent = checked ? 'Activo' : 'Inactivo';
  badge.className = `status-badge ${checked ? 'active' : 'inactive'}`;
  toast(checked ? 'Paciente habilitado.' : 'Paciente deshabilitado.', 'success');
};

window.printCredencial = function(id) {
  const p = state.paciente; if (!p) { toast('Paciente no encontrado', 'error'); return; }
  const html = `
    <div class="credencial-wrapper">
      <div class="credencial-card">
        <div class="credencial-header">
          <img src="logo.svg" alt="Clinic" height="32">
          <div><div class="credencial-org">Clinic</div><div class="credencial-org-sub">Gestión clínica</div></div>
        </div>
        <div class="credencial-body">
          <div id="qr-${id}" style="width:20mm;height:20mm;flex-shrink:0;background:#fff;border-radius:3mm;display:flex;align-items:center;justify-content:center;"></div>
          <div class="credencial-datos">
            <div class="credencial-nombre">${esc(p.apellido)}, ${esc(p.nombres)}</div>
            <div class="credencial-dni">DNI: ${esc(p.dni) || '—'}</div>
          </div>
        </div>
      </div>
    </div>`;
  document.getElementById('print-report').innerHTML = html;
  setTimeout(() => {
    const qrContainer = document.getElementById(`qr-${id}`);
    if (qrContainer) {
      new QRCode(qrContainer, { text: `https://athomeenfermeria.netlify.app/paciente.html?id=${id}`, width: 100, height: 100, colorDark: '#0c1017', colorLight: '#ffffff', correctLevel: QRCode.CorrectLevel.H });
    }
    setTimeout(() => window.print(), 400);
  }, 100);
};
