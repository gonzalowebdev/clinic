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
import { initEvents } from '../events.js';
import { mountShell, fillShellUser, initTheme } from '../shell.js';
import { actions } from '../events.js';

initEvents();
mountShell({ active: 'pacientes', title: 'Ficha del paciente', mode: 'detail' });
initTheme();

if (!pacId) {
  showNotFound();
} else {
  sb.auth.onAuthStateChange(async (_e, session) => {
    if (session) { fillShellUser(session.user); await boot(session.user); }
    else { location.href = 'index.html'; }
  });
  (async () => {
    const { data: { session } } = await sb.auth.getSession();
    if (session) { fillShellUser(session.user); await boot(session.user); }
    else location.href = 'index.html';
  })();
}


document.addEventListener('keydown',e=>{ if(e.key==='Escape'){actions.closeForm();actions.closeEntrada();actions.closeRpt();actions.closeLightbox();} });
