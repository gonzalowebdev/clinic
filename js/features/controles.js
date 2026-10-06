// Controles diarios y entrada diaria (con imágenes).
import { state } from '../state.js';
import { BUCKET, CI_TABLE, C_TABLE, sb } from '../supabase.js';
import { toast } from '../ui.js';
import { attachUrl, signPaths } from '../storage.js';
import { fmtDate } from '../forms.js';
import { esc } from '../utils.js';

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

window.openEntrada = function(pacienteId) {
  state.entradaPacId    = pacienteId;
  state.entradaImgFiles = [];
  const p = state.pacientes.find(x => x.id === pacienteId);

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
  state.entradaPacId    = null;
  state.entradaImgFiles = [];
};

window.closeEntradaIfBg = function(e) {
  if (e.target === document.getElementById('entrada-overlay')) window.closeEntrada();
};

/* Previsualiza imágenes antes de subir — con checkbox "incluir en PDF" */
window.previewEntradaImages = function(input) {
  const files = Array.from(input.files).filter(f => /\.(jpe?g|png|gif|webp|heic|heif)$/i.test(f.name));
  if (!files.length) return;

  files.forEach(file => {
    if (!state.entradaImgFiles.find(f => f.name === file.name && f.size === file.size)) {
      state.entradaImgFiles.push({ file, incluirPdf: true });
    }
  });
  renderEntradaPreview();
  input.value = ''; // reset so same file can be re-added if needed
};

function renderEntradaPreview() {
  const cont = document.getElementById('entrada-img-preview');
  if (!state.entradaImgFiles.length) { cont.innerHTML = ''; return; }
  cont.innerHTML = state.entradaImgFiles.map((item, i) => {
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
  state.entradaImgFiles.splice(i, 1);
  renderEntradaPreview();
};

window.togglePdfImg = function(i, val) {
  if (state.entradaImgFiles[i]) {
    state.entradaImgFiles[i].incluirPdf = val;
    const tog = document.getElementById(`pdf-toggle-${i}`);
    if (tog) tog.classList.toggle('active', val);
  }
};

/* Guarda la entrada: inserta en controles, sube imágenes a Storage, guarda refs en control_imagenes */
window.saveEntrada = async function() {
  const fecha = document.getElementById('e-fecha').value;
  if (!fecha) { toast('La fecha es obligatoria.', 'error'); return; }
  if (!state.entradaPacId) return;

  const btn = document.getElementById('btn-entrada-save');
  const txt = document.getElementById('btn-entrada-txt');
  btn.disabled = true; txt.textContent = 'Guardando…';

  // 1. Insertar en controles
  const payload = {
    paciente_id:         state.entradaPacId,
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
  if (state.entradaImgFiles.length) {
    const prog    = document.getElementById('entrada-upload-prog');
    const bar     = document.getElementById('entrada-prog-bar');
    const progTxt = document.getElementById('entrada-prog-txt');
    prog.style.display = 'block';

    for (let i = 0; i < state.entradaImgFiles.length; i++) {
      const { file, incluirPdf } = state.entradaImgFiles[i];
      bar.style.width = `${Math.round((i / state.entradaImgFiles.length) * 100)}%`;
      progTxt.textContent = `Subiendo ${i+1}/${state.entradaImgFiles.length}: ${file.name}`;

      const safeName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g,'_')}`;
      const storagePath = `${state.entradaPacId}/${controlId}/${safeName}`;

      const { error: upErr } = await sb.storage.from(BUCKET).upload(storagePath, file, { upsert: false, contentType: file.type });
      if (upErr) { toast(`Error subiendo ${file.name}: ${upErr.message}`, 'error'); continue; }

      // Guardar referencia en control_imagenes
      await sb.from(CI_TABLE).insert({
        control_id:   controlId,
        paciente_id:  state.entradaPacId,
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
