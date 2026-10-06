// Pacientes: alta, edición, baja, búsqueda, filtros y ficha.
import { state } from '../state.js';
import { BUCKET, C_TABLE, TABLE, sb } from '../supabase.js';
import { DB_COLS } from '../constants.js';
import { toast } from '../ui.js';
import { clearFormValues, gv, setFormValues } from '../forms.js';
import { esc } from '../utils.js';
import { renderAll, renderDash, renderMain } from './render.js';
import { buildProfMultiList, loadPatientProfs, renderProfTags, saveProfLinks } from './comun.js';
import { actions } from '../events.js';

export async function loadPacientes() {
  const { data, error } = await sb.from(TABLE).select('*').order('created_at',{ascending:false});
  if (error) { toast(`Error al cargar: ${error.message}`,'error'); return; }
  state.pacientes = data || [];
  renderAll();
}

actions.savePaciente = async function() {
  if (!gv('apellido')||!gv('nombres')||!gv('dni')) { toast('Apellido, Nombres y DNI son obligatorios.','error'); return; }
  const payload={};
  DB_COLS.forEach(col=>{ payload[col]=gv(col)||null; });
  const btn=document.getElementById('btn-save'), txt=document.getElementById('btn-save-txt');
  btn.disabled=true; txt.textContent='Guardando…';
  let error, savedId;
  if (state.editId) {
    ({error}=await sb.from(TABLE).update(payload).eq('id',state.editId));
    savedId=state.editId;
    if(!error) toast('Paciente actualizado.','success');
  } else {
    const {data:ins,error:ie}=await sb.from(TABLE).insert(payload).select().single();
    error=ie; savedId=ins?.id;
    if(!error) toast('Paciente registrado.','success');
  }
  btn.disabled=false; txt.textContent='Guardar Paciente';
  if (error) { toast(`Error: ${error.message}`,'error'); return; }
  if (savedId) await saveProfLinks(savedId);
  actions.closeForm(); await loadPacientes();
};

actions.askDelete=function(id){ state.deleteId=id; document.getElementById('del-overlay').classList.add('open'); };

actions.confirmDelete=async function() {
  if (!state.deleteId) return;
  const btn=document.getElementById('btn-confirm-del');
  btn.disabled=true; btn.textContent='Eliminando…';
  // adjuntos
  const {data:files}=await sb.storage.from(BUCKET).list(state.deleteId);
  if (files&&files.length) await sb.storage.from(BUCKET).remove(files.map(f=>`${state.deleteId}/${f.name}`));
  // controles
  await sb.from(C_TABLE).delete().eq('paciente_id',state.deleteId);
  // paciente
  const {error}=await sb.from(TABLE).delete().eq('id',state.deleteId);
  btn.disabled=false;
  btn.innerHTML=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" width="15" height="15"><polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg> Eliminar`;
  if (error) { toast(`Error: ${error.message}`,'error'); actions.closeDel(); return; }
  toast('Paciente eliminado.','info');
  actions.closeDel(); state.deleteId=null; await loadPacientes();
};

actions.onSearch=function(val){ state.searchQuery=val.trim().toLowerCase(); document.getElementById('s-clear').classList.toggle('show',!!state.searchQuery); state.page=1; applyFilters(); renderMain(); renderDash(); };

actions.clearSearch=function(){ document.getElementById('search-input').value=''; actions.onSearch(''); };

actions.setChip=function(key,el){ document.querySelectorAll('.chip').forEach(c=>c.classList.remove('active')); el.classList.add('active'); state.activeFilter=key; state.page=1; applyFilters(); renderMain(); };

export function applyFilters(){
  let list=[...state.pacientes];
  if(state.searchQuery){ const q=state.searchQuery; list=list.filter(p=>DB_COLS.some(col=>p[col]&&String(p[col]).toLowerCase().includes(q))); }
  if(state.activeFilter==='patologia') list=list.filter(p=>p.patologia);
  if(state.activeFilter==='historia')  list=list.filter(p=>p.historia_clinica);
  if(state.activeFilter==='estudios')  list=list.filter(p=>p.estudios_complementarios);
  state.filteredList=list;
}

actions.toggleActivo = async function(id, checked, inputEl){
  inputEl.disabled = true;
  const { error } = await sb.from(TABLE).update({ activo: checked }).eq('id', id);
  inputEl.disabled = false;
  if (error) { toast(`Error: ${error.message}`,'error'); inputEl.checked = !checked; return; }
  const p = state.pacientes.find(x=>x.id===id);
  if (p) p.activo = checked;
  const badge = document.getElementById(`status-badge-${id}`);
  if (badge) { badge.textContent = checked?'Activo':'Inactivo'; badge.className = `status-badge ${checked?'active':'inactive'}`; }
  toast(checked?'Paciente habilitado.':'Paciente deshabilitado.','success');
};

actions.openForm=async function(id=null){
  state.editId=id||null;
  clearFormValues();
  state.selectedProfIds=[];
  document.getElementById('prof-multi-q').value='';
  document.getElementById('prof-form-title') // just ensure profs loaded
  buildProfMultiList();
  renderProfTags();
  document.getElementById('form-modal-title').textContent=id?'Editar Paciente':'Nuevo Paciente';
  if(id){
    const p=state.pacientes.find(x=>x.id===id);
    if(p) setFormValues(p);
    await loadPatientProfs(id);
  }
  document.getElementById('form-overlay').classList.add('open');
};

actions.closeForm=function(){ document.getElementById('form-overlay').classList.remove('open'); state.editId=null; };

actions.openDet=function(id){ location.href='paciente.html?id='+id; };

actions.closeDet=function(){ document.getElementById('det-overlay')?.classList.remove('open'); };

actions.closeDetIfBg=function(e){ if(e.target===document.getElementById('det-overlay')) actions.closeDet(); };

actions.closeDel=function(){ document.getElementById('del-overlay').classList.remove('open'); state.deleteId=null; };

actions.closeDelIfBg=function(e){ if(e.target===document.getElementById('del-overlay')) actions.closeDel(); };

actions.printCredencial = function(id) {
  const p = state.pacientes.find(x => x.id === id);
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
