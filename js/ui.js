// Utilidades de interfaz (notificaciones).
import { esc } from './utils.js';

export function toast(msg,type='info'){
  const ICONS={
    success:`<svg viewBox="0 0 24 24" fill="none" stroke="var(--success)" stroke-width="2.2" stroke-linecap="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22,4 12,14.01 9,11.01"/></svg>`,
    error:`<svg viewBox="0 0 24 24" fill="none" stroke="var(--danger)" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
    info:`<svg viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`
  };
  const el=document.createElement('div'); el.className=`toast ${type}`; el.innerHTML=`${ICONS[type]||''}<span>${esc(msg)}</span>`; document.getElementById('toast-wrap').appendChild(el);
  setTimeout(()=>{ el.style.cssText='opacity:0;transform:translateX(10px);transition:.25s'; setTimeout(()=>el.remove(),260); },3600);
}
