// Informes por período, impresión y exportación CSV.
import { state } from '../../state.js';
import { CI_TABLE, sb } from '../../supabase.js';
import { toast } from '../../ui.js';
import { attachUrl, signPaths } from '../../storage.js';
import { fmtDate } from '../../forms.js';
import { esc } from '../../utils.js';
import { updateRptPreview } from '../comun.js';
import { actions } from '../../events.js';

actions.openRptModal = function(pacienteId) {
  state.rptPacId = pacienteId; state.rptDays = 7;
  document.getElementById('rpt-modal-sub').textContent = state.paciente ? `Paciente: ${state.paciente.apellido}, ${state.paciente.nombres}` : '';
  document.querySelectorAll('.rpt-period-btn').forEach(b=>b.classList.remove('sel'));
  document.getElementById('rpt-btn-7').classList.add('sel');
  document.getElementById('rpt-custom').classList.remove('show');
  const today=new Date(), from=new Date(); from.setDate(today.getDate()-7);
  state.rptFrom=fmtDate(from); state.rptTo=fmtDate(today);
  document.getElementById('rpt-from').value=state.rptFrom;
  document.getElementById('rpt-to').value=state.rptTo;
  document.getElementById('rpt-overlay').classList.add('open');
  updateRptPreview();
};

actions.generatePeriodReport = async function() {
  if (!state.rptPacId) return;
  if (!state.rptControles.length) { toast('No hay controles en el período seleccionado.','error'); return; }
  const p = state.paciente;
  const imgMap = {};
  for (const c of state.rptControles) { const { data: imgs } = await sb.from(CI_TABLE).select('*').eq('control_id', c.id).eq('incluir_pdf', true); imgMap[c.id] = imgs || []; }
  await signPaths(Object.values(imgMap).flat().map(i=>i.storage_path));
  const now = new Date();
  const fPrint = now.toLocaleDateString('es-AR',{day:'2-digit',month:'long',year:'numeric'});
  const hPrint = now.toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'});
  const f1 = new Date(state.rptFrom+'T00:00:00').toLocaleDateString('es-AR',{day:'2-digit',month:'long',year:'numeric'});
  const f2 = new Date(state.rptTo+'T00:00:00').toLocaleDateString('es-AR',{day:'2-digit',month:'long',year:'numeric'});
  const fld=(lbl,val)=>`<div class="pr-field"><div class="pr-field-lbl">${lbl}</div><div class="pr-field-val">${esc(val)||'<span class="pr-no-data">—</span>'}</div></div>`;
  const ctrlHtml = state.rptControles.map((c,i) => {
    const d=new Date(c.fecha+'T00:00:00').toLocaleDateString('es-AR',{weekday:'long',day:'2-digit',month:'long',year:'numeric'});
    const meta = [c.responsable, c.turno].filter(Boolean).map(esc).join(' · ');
    const imgs = imgMap[c.id] || [];
    const imgSection = imgs.length ? `
      <div style="margin-top:8px;">
        <div style="font-size:7.5pt;text-transform:uppercase;letter-spacing:.5px;color:#556070;margin-bottom:4px;">Imágenes del control (${imgs.length})</div>
        <div class="pr-img-grid">
          ${imgs.map(img=>`<div class="pr-img-item"><img src="${attachUrl(img.storage_path)}" alt="${esc(img.nombre)}"><div class="pr-img-caption">${esc(img.nombre)}</div></div>`).join('')}
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
      <div class="pr-logo-area"><img src="logo.svg" height="44"><div><div class="pr-org-name">Clinic</div><div class="pr-org-sub">Sistema de Gestión Clínica</div></div></div>
      <div class="pr-date"><strong>${fPrint}</strong>Impreso a las ${hPrint}</div>
    </div>
    <div class="pr-title">Informe de Controles por Período</div>
    <div class="pr-period-badge">Del ${f1} al ${f2} — ${state.rptControles.length} control${state.rptControles.length!==1?'es':''}</div>
    <div class="pr-section">
      <div class="pr-section-title">Datos del Paciente</div>
      <div class="pr-grid">
        ${fld('Apellido y Nombres',`${p.apellido||''}, ${p.nombres||''}`)}
        ${fld('DNI',p.dni)}${fld('Médico Tratante',p.medico_tratante)}${fld('Patología Principal',p.patologia)}${fld('Domicilio',p.domicilio)}${fld('Ciudad',p.ciudad)}
      </div>
    </div>
    <div class="pr-section"><div class="pr-section-title">Registro de Controles (${state.rptControles.length})</div>${ctrlHtml}</div>
    <div class="pr-sign-row">
      <div class="pr-sign">Firma y Sello Médico Tratante<br><br><br>${esc(p.medico_tratante)||'____________________________'}</div>
      <div class="pr-sign">Firma Enfermería / Responsable<br><br><br>____________________________</div>
      <div class="pr-sign">Aclaración y Fecha<br><br><br>____________________________</div>
    </div>
    <div class="pr-footer">Clinic — Sistema de Gestión Clínica &nbsp;|&nbsp; ${fPrint} · ${hPrint}<br>Documento confidencial. Uso exclusivo del equipo médico tratante.</div>
  </div>`;
  actions.closeRpt();
  window.print();
};

actions.printPaciente = function(id) {
  const p=state.paciente; if(!p) return;
  const now=new Date();
  const fPrint=now.toLocaleDateString('es-AR',{day:'2-digit',month:'long',year:'numeric'});
  const hPrint=now.toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'});
  const fld=(lbl,val)=>`<div class="pr-field"><div class="pr-field-lbl">${lbl}</div><div class="pr-field-val">${esc(val)||'<span class="pr-no-data">—</span>'}</div></div>`;
  const blk=(lbl,val,c='#0b8579')=>val?`<div class="pr-text-block" style="border-left-color:${c}"><div class="pr-text-lbl" style="color:${c}">${lbl}</div><div class="pr-text-val">${esc(val)}</div></div>`:'';
  document.getElementById('print-report').innerHTML=`
  <div class="pr-page">
    <div class="pr-header">
      <div class="pr-logo-area"><img src="logo.svg" height="44"><div><div class="pr-org-name">Clinic</div><div class="pr-org-sub">Sistema de Gestión Clínica</div></div></div>
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
