// Adjuntos en Supabase Storage (bucket privado, URLs firmadas).
import { sb, BUCKET } from './supabase.js';

// Bucket privado: las URLs se firman (1 h) antes de renderizar y se leen de forma síncrona desde la caché.
export const urlCache = new Map();

export async function signPaths(paths){
  const now = Date.now();
  const need = [...new Set(paths)].filter(p => p && !(urlCache.get(p) && urlCache.get(p).exp > now));
  if (!need.length) return;
  const { data, error } = await sb.storage.from(BUCKET).createSignedUrls(need, 3600);
  if (error || !data) return;
  data.forEach(d => { if (d.signedUrl) urlCache.set(d.path, { url: d.signedUrl, exp: now + 3300000 }); });
}

export function attachUrl(path){ const e = urlCache.get(path); return e ? e.url : ''; }

export async function loadAttachments(pid){ const{data,error}=await sb.storage.from(BUCKET).list(pid,{sortBy:{column:'created_at',order:'asc'}}); if(error) return []; return data||[]; }

export async function uploadAttachment(pid,file){ const name=`${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g,'_')}`; const path=`${pid}/${name}`; const{error}=await sb.storage.from(BUCKET).upload(path,file,{upsert:false,contentType:file.type}); if(error) throw error; return path; }

export async function deleteAttachment(path){ const{error}=await sb.storage.from(BUCKET).remove([path]); if(error) throw error; }
