// Adjuntos del paciente y visor de imágenes.
import { toast } from '../ui.js';
import { attachUrl, deleteAttachment, loadAttachments, signPaths, uploadAttachment } from '../storage.js';
import { esc } from '../utils.js';

export async function renderGallery(pid,cid){
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

window.openLightbox=function(url){ document.getElementById('lightbox-img').src=url; document.getElementById('lightbox').classList.add('open'); };

window.closeLightbox=function(){ document.getElementById('lightbox').classList.remove('open'); };
