// Ficha del paciente: carga, render del detalle, estado y credencial.
import { state } from '../../state.js';
import { PP_TABLE, P_TABLE, TABLE, USR_TABLE, sb } from '../../supabase.js';
import { toast } from '../../ui.js';
import { fmtDate } from '../../forms.js';
import { diasDesde, fechaCorta, hace } from '../../fechas.js';
import { loadAttachments } from '../../storage.js';
import { loadControles } from '../comun.js';
import { esc, fichaUrl } from '../../utils.js';
import { pacId } from './contexto.js';
import { renderControlesList } from './controles.js';
import { renderGallery } from '../adjuntos.js';
import { actions } from '../../events.js';

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

  document.getElementById('btn-det-edit').onclick   = () => actions.openForm(p.id);
  document.getElementById('btn-det-print').onclick  = () => actions.printPaciente(p.id);
  document.getElementById('btn-det-credencial').onclick = () => actions.printCredencial(p.id);
  document.getElementById('btn-det-rpt').onclick    = () => actions.openRptModal(p.id);
  document.getElementById('btn-det-entrada').onclick= () => actions.openEntrada(p.id);

  const galleryId=`gallery-${p.id}`, ctrlListId=`ctrl-list-${p.id}`;
  const clean = v => String(v || '').trim();
  const pid = esc(JSON.stringify([p.id]));

  const [{ data: links }, ctrls, files] = await Promise.all([
    sb.from(PP_TABLE).select('profesional_id, profesionales(id,apellido,nombres,especialidad,matricula,telefono)').eq('paciente_id', p.id),
    loadControles(p.id),
    loadAttachments(p.id),
  ]);
  const profsAsig = (links || []).map(l => l.profesionales).filter(Boolean);

  /* Encabezado: patologías como etiquetas */
  const pats = [p.patologia, p.patologia1, p.patologia2].map(clean).filter(Boolean);
  document.getElementById('det-chips').innerHTML = pats.map(v => `<span class="chip-tag">${esc(v)}</span>`).join('');

  /* Indicadores (calculados con datos existentes) */
  const last = ctrls.find(c => c.fecha);
  const dias = last ? diasDesde(last.fecha) : null;
  const kpi = (lbl, val, sub, cls = '') => `<div class="kpi"><div class="kpi-lbl">${lbl}</div><div class="kpi-val">${val}</div><div class="kpi-sub ${cls}">${sub}</div></div>`;
  document.getElementById('det-kpis').innerHTML =
    kpi('Último control', last ? fechaCorta(last.fecha) : '—', last ? hace(dias) : 'Sin controles', dias !== null && dias > 7 ? 'warn' : '') +
    kpi('Controles', ctrls.length, ctrls.length === 1 ? 'registrado' : 'registrados') +
    kpi('Adjuntos', files.length, files.length === 1 ? 'archivo' : 'archivos') +
    kpi('Profesionales', profsAsig.length, profsAsig.length === 1 ? 'asignado' : 'asignados');

  /* Columna lateral: contacto + equipo asignado. Los campos vacíos se agrupan en una línea. */
  const contacto = [['Teléfonos', p.telefonos], ['Mail', p.mail], ['Domicilio', p.domicilio], ['Ciudad', p.ciudad], ['Contacto familia', p.contacto_familia], ['Médico tratante', p.medico_tratante]];
  const conDato = contacto.filter(([, v]) => clean(v));
  const sinDato = contacto.filter(([, v]) => !clean(v)).map(([l]) => l);
  const profsHtml = profsAsig.length
    ? `<div class="prof-chips">${profsAsig.map(pr => `
        <span class="prof-chip">
          <span class="pa">${esc(((pr.apellido || '')[0] || '').toUpperCase())}</span>
          <span class="prof-link" data-href="profesional.html?id=${encodeURIComponent(pr.id)}">${esc(pr.apellido)}, ${esc(pr.nombres)}</span>${clean(pr.especialidad) ? `<span class="prof-esp">${esc(pr.especialidad)}</span>` : ''}
        </span>`).join('')}</div>`
    : '<div class="muted">Sin profesionales asignados.</div>';
  document.getElementById('det-side').innerHTML = `
    <div class="side-title">Contacto</div>
    ${conDato.map(([l, v]) => `<div class="side-row"><div class="side-lbl">${l}</div><div class="side-val">${esc(v)}</div></div>`).join('')}
    ${sinDato.length ? `<div class="empty-line">Sin datos: ${sinDato.join(', ')}</div>` : ''}
    <div class="side-title">Profesionales asignados</div>
    ${profsHtml}`;

  /* Bloques de texto clínico: solo los que tienen contenido; los vacíos se resumen en una línea. */
  const bloques = (lista) => {
    const con = lista.filter(([, v]) => clean(v));
    const sin = lista.filter(([, v]) => !clean(v)).map(([l]) => l);
    if (!con.length) return `<div class="empty-state"><div class="empty-title">Sin información cargada</div><div class="empty-text">Todavía no hay datos en esta sección.</div><button class="btn btn-ghost btn-sm" data-click="openForm" data-click-args="${pid}">Completar en la ficha</button></div>`;
    return con.map(([l, v]) => `<div class="note-card"><div class="note-lbl">${l}</div><div class="note-txt">${esc(v)}</div></div>`).join('') + (sin.length ? `<div class="empty-line">Sin datos: ${sin.join(', ')}</div>` : '');
  };
  const disciplinas = c => [['Enfermería', c.enfermeria], ['Kinesiología', c.kinesiologia], ['Diagnóstico', c.diagnostico_medico], ['Observaciones', c.observaciones], ['Otros profesionales', c.otros_profesionales], ['Otros', c.otros]]
    .filter(([, v]) => clean(v)).map(([l]) => `<span class="mini-chip">${l}</span>`).join('');
  const actividad = ctrls.slice(0, 3).map(c => {
    const meta = [c.turno, c.responsable].filter(Boolean).map(esc).join(' · ');
    return `<div class="act-row"><div class="act-date">${fechaCorta(c.fecha)}</div><div class="act-main"><div class="act-chips">${disciplinas(c) || '<span class="muted">Sin texto</span>'}</div>${meta ? `<div class="act-meta">${meta}</div>` : ''}</div></div>`;
  }).join('');
  const tab = (name, label, on = false) => `<div class="tab${on ? ' active' : ''}" data-click="switchTab" data-click-args='["${name}","$el"]'>${label}</div>`;

  document.getElementById('det-body').innerHTML=`
    <div class="tabs">
      ${tab('resumen', 'Resumen', true)}${tab('clinico', 'Clínico')}${tab('equipos', 'Equipos')}${tab('controles', `Controles <span class="tab-count">${ctrls.length}</span>`)}${tab('adjuntos', `Adjuntos <span class="tab-count">${files.length}</span>`)}
    </div>
    <div class="tab-pane active" id="tab-resumen">
      <div class="sum-block">
        <div class="sum-lbl">Diagnóstico médico</div>
        ${clean(p.diagnostico_medico) ? `<div class="note-txt">${esc(p.diagnostico_medico)}</div>` : '<div class="muted">Sin diagnóstico registrado.</div>'}
      </div>
      <div class="sum-block">
        <div class="sum-lbl">Actividad reciente</div>
        ${ctrls.length ? actividad : `<div class="empty-state"><div class="empty-title">Aún no hay controles</div><div class="empty-text">Registrá la primera entrada para empezar el historial.</div><button class="btn btn-primary btn-sm" data-click="openEntrada" data-click-args="${pid}">Registrar primera entrada</button></div>`}
      </div>
    </div>
    <div class="tab-pane" id="tab-clinico">
      ${bloques([['Diagnóstico médico', p.diagnostico_medico], ['Historia clínica', p.historia_clinica], ['Epicrisis', p.epicrisis], ['Estudios complementarios', p.estudios_complementarios], ['Observaciones', p.observaciones]])}
    </div>
    <div class="tab-pane" id="tab-equipos">
      ${bloques([['Enfermería', p.enfermeria], ['Kinesiología', p.kinesiologia], ['Otros profesionales', p.otros_profesionales], ['Otros', p.otros]])}
    </div>
    <div class="tab-pane" id="tab-controles">
      <details class="ctrl-new">
        <summary><span class="plus">+</span> Nuevo control</summary>
      <div style="background:var(--surface2);border-radius:10px;padding:16px;margin-bottom:16px;">
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
          <button class="btn btn-ghost btn-sm" data-click="openRptModal" data-click-args="${esc(JSON.stringify([p.id]))}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" width="13" height="13"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            Informe por período
          </button>
          <button class="btn btn-primary btn-sm" id="ctrl-save-btn" data-click="saveControl" data-click-args="${esc(JSON.stringify([p.id, ctrlListId]))}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" width="13" height="13"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17,21 17,13 7,13 7,21"/></svg>
            Guardar Control
          </button>
        </div>
      </div>
      </details>
      <div class="sum-lbl" style="margin:20px 0 10px;">Historial de controles</div>
      <div id="${ctrlListId}"></div>
    </div>
    <div class="tab-pane" id="tab-adjuntos">
      <div class="attach-progress" id="attach-prog-${p.id}">
        <div class="prog-bar-wrap"><div class="prog-bar" id="attach-bar-${p.id}"></div></div>
        <span>Subiendo…</span>
      </div>
      <div class="attach-zone" id="attach-zone-${p.id}">
        <input type="file" multiple accept="image/*,.pdf"
          data-change="handleFileUpload" data-change-args="${esc(JSON.stringify(["$el", p.id, galleryId]))}"
          data-dragover="dragOn"
          data-dragleave="dragOff"
          data-drop="dragOff">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17,8 12,3 7,8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
        <p>Tocá para seleccionar o arrastrá archivos aquí</p>
        <small>Imágenes (JPG, PNG, HEIC) y PDF · Podés subir varios a la vez</small>
      </div>
      <div id="${galleryId}"></div>
    </div>`;

  await renderGallery(p.id,galleryId);
  await renderControlesList(p.id,ctrlListId);
}

actions.toggleActivo = async function(checked, inputEl) {
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

actions.printCredencial = function(id) {
  const p = state.paciente; if (!p) { toast('Paciente no encontrado', 'error'); return; }
  const html = `
    <div class="credencial-wrapper">
      <div class="credencial-card">
        <div class="credencial-header">
          <img src="logo.svg" alt="Clinic" height="32">
          <div><div class="credencial-org">Clinic</div><div class="credencial-org-sub">Gestión clínica</div></div>
        </div>
        <div class="credencial-body">
          <div class="credencial-qr" id="qr-${id}"></div>
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
      new QRCode(qrContainer, { text: fichaUrl(id), width: 400, height: 400, colorDark: '#0c1017', colorLight: '#ffffff', correctLevel: QRCode.CorrectLevel.M });
    }
    setTimeout(() => window.print(), 400);
  }, 100);
};
