// Formulario de edición del paciente y vínculo con profesionales.
import { state } from '../../state.js';
import { TABLE, sb } from '../../supabase.js';
import { DB_COLS } from '../../constants.js';
import { toast } from '../../ui.js';
import { clearFormValues, gv, setFormValues } from '../../forms.js';
import { loadPaciente } from './detalle.js';
import { buildProfMultiList, loadPatientProfs, renderProfTags, saveProfLinks } from '../comun.js';
import { actions } from '../../events.js';

actions.openForm=async function(id=null){
  state.editId=id||state.paciente.id;
  clearFormValues();
  state.selectedProfIds=[];
  document.getElementById('prof-multi-q').value='';
  buildProfMultiList();
  renderProfTags();
  document.getElementById('form-modal-title').textContent='Editar Paciente';
  setFormValues(state.paciente);
  await loadPatientProfs(state.paciente.id);
  document.getElementById('form-overlay').classList.add('open');
};

actions.closeForm=function(){ document.getElementById('form-overlay').classList.remove('open'); };

actions.savePaciente = async function() {
  if (!gv('apellido')||!gv('nombres')||!gv('dni')) { toast('Apellido, Nombres y DNI son obligatorios.','error'); return; }
  const payload={};
  DB_COLS.forEach(col=>{ payload[col]=gv(col)||null; });
  const btn=document.getElementById('btn-save'), txt=document.getElementById('btn-save-txt');
  btn.disabled=true; txt.textContent='Guardando…';
  const { error } = await sb.from(TABLE).update(payload).eq('id',state.paciente.id);
  btn.disabled=false; txt.textContent='Guardar Paciente';
  if (error) { toast(`Error: ${error.message}`,'error'); return; }
  await saveProfLinks(state.paciente.id);
  toast('Paciente actualizado.','success');
  actions.closeForm();
  await loadPaciente();
};
