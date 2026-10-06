// Página: paciente.html — punto de entrada.
import { sb } from '../supabase.js';
import { pacId } from '../features/ficha/contexto.js';
import { boot, showNotFound } from '../features/ficha/detalle.js';
import '../features/ficha/contexto.js';
import '../features/ficha/detalle.js';
import '../features/ficha/formulario.js';
import '../features/ficha/controles.js';
import '../features/ficha/informes.js';
import '../features/comun.js';
import '../features/adjuntos.js';

if (!pacId) {
  showNotFound();
} else {
  sb.auth.onAuthStateChange(async (_e, session) => {
    if (session) { await boot(session.user); }
    else { location.href = 'index.html'; }
  });
  (async () => {
    const { data: { session } } = await sb.auth.getSession();
    if (session) await boot(session.user);
    else location.href = 'index.html';
  })();
}

(function initTheme() { const saved = localStorage.getItem('mc_theme') || 'dark'; if (saved==='light') document.body.classList.add('light'); })();

document.addEventListener('keydown',e=>{ if(e.key==='Escape'){window.closeForm();window.closeEntrada();window.closeRpt();window.closeLightbox();} });

const s=document.createElement('style');

s.textContent='@keyframes shake{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-6px)}40%,80%{transform:translateX(6px)}}';

document.head.appendChild(s);
