// Informes por período, impresión y exportación CSV.
import { state } from '../state.js';
import { CI_TABLE, C_TABLE, sb } from '../supabase.js';
import { CTRL_COLS, CTRL_LABELS, DB_COLS, DB_LABELS } from '../constants.js';
import { toast } from '../ui.js';
import { attachUrl, signPaths } from '../storage.js';
import { fmtDate } from '../forms.js';
import { esc } from '../utils.js';

window.openRptModal = function(pacienteId) {
  state.rptPacId = pacienteId;
  state.rptDays  = 7;
  const p = state.pacientes.find(x=>x.id===pacienteId);
  document.getElementById('rpt-modal-sub').textContent = p ? `Paciente: ${p.apellido}, ${p.nombres}` : '';
  // reset buttons
  document.querySelectorAll('.rpt-period-btn').forEach(b=>b.classList.remove('sel'));
  document.getElementById('rpt-btn-7').classList.add('sel');
  document.getElementById('rpt-custom').classList.remove('show');
  // set default dates
  const today=new Date(), from=new Date(); from.setDate(today.getDate()-7);
  state.rptFrom=fmtDate(from); state.rptTo=fmtDate(today);
  document.getElementById('rpt-from').value=state.rptFrom;
  document.getElementById('rpt-to').value=state.rptTo;
  document.getElementById('rpt-overlay').classList.add('open');
  updateRptPreview();
};

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

async function updateRptPreview() {
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

window.generatePeriodReport = async function() {
  if (!state.rptPacId) return;
  if (!state.rptControles.length) { toast('No hay controles en el período seleccionado.','error'); return; }
  const p = state.pacientes.find(x=>x.id===state.rptPacId);
  if (!p) return;

  // Load images for each control that have incluir_pdf = true
  const imgMap = {};
  for (const c of state.rptControles) {
    const { data: imgs } = await sb.from(CI_TABLE).select('*').eq('control_id', c.id).eq('incluir_pdf', true);
    imgMap[c.id] = imgs || [];
  }
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
    <div class="pr-period-badge">Del ${f1} al ${f2} — ${state.rptControles.length} control${state.rptControles.length!==1?'es':''}</div>
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
      <div class="pr-section-title">Registro de Controles (${state.rptControles.length})</div>
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
  const p=state.pacientes.find(x=>x.id===id); if(!p) return;
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

window.openCsvModal = function() {
  buildCsvCols();
  document.getElementById('csv-overlay').classList.add('open');
  updateCsvCount();
};

window.closeCsvModal=function(){ document.getElementById('csv-overlay').classList.remove('open'); };

window.closeCsvIfBg=function(e){ if(e.target===document.getElementById('csv-overlay')) window.closeCsvModal(); };

export function buildCsvCols() {
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

export function updateCsvCount() {
  const source = document.getElementById('csv-source').value;
  const n = source==='pacientes' ? state.filteredList.length : state.csvControles.length;
  document.getElementById('csv-row-count').textContent=`${n} fila${n!==1?'s':''}`;
}

window.csvSelectAll=function(val){ document.querySelectorAll('#csv-cols-container input[type=checkbox]').forEach(c=>{ c.checked=val; }); };

window.doExportCSV = async function() {
  const source = document.getElementById('csv-source').value;
  const checked = Array.from(document.querySelectorAll('#csv-cols-container input:checked')).map(i=>i.value);
  if (!checked.length) { toast('Seleccioná al menos una columna.','error'); return; }

  let rows, labels, data;
  if (source==='pacientes') {
    data   = state.filteredList;
    labels = checked.map(c=>DB_LABELS[c]||c);
    rows   = data.map(p=>checked.map(c=>`"${(p[c]||'').toString().replace(/"/g,'""')}"`).join(','));
  } else {
    // Cargar todos los controles si no están
    if (!state.csvControles.length) {
      toast('Cargando controles…','info');
      const { data: d, error } = await sb.from(C_TABLE).select('*,pacientes(apellido,nombres,dni)').order('fecha',{ascending:false});
      if (error) { toast(`Error: ${error.message}`,'error'); return; }
      state.csvControles = d || [];
    }
    data   = state.csvControles;
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
