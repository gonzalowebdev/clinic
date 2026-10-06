// Helpers de formularios y fechas.
import { DB_COLS } from './constants.js';

export function gv(col){ const e=document.getElementById('f-'+col); return e?e.value.trim():''; }

export function setFormValues(p){ DB_COLS.forEach(c=>{ const e=document.getElementById('f-'+c); if(e) e.value=p[c]||''; }); }

export function clearFormValues(){ DB_COLS.forEach(c=>{ const e=document.getElementById('f-'+c); if(e) e.value=''; }); }

export function fmtDate(d) { return d.toISOString().slice(0,10); }
