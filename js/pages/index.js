// Página: index.html — punto de entrada. Carga los módulos de funciones y arranca la app.
import { state } from '../state.js';
import { TABLE, sb } from '../supabase.js';
import { loadUserRole, showApp, showLogin } from '../features/auth.js';
import { loadPacientes } from '../features/pacientes.js';
import { buildCsvCols, updateCsvCount } from '../features/informes.js';
import { loadProfesionales } from '../features/profesionales.js';
import { applyTheme } from '../features/app.js';
import '../features/auth.js';
import '../features/pacientes.js';
import '../features/render.js';
import '../features/controles.js';
import '../features/informes.js';
import '../features/adjuntos.js';
import '../features/profesionales.js';
import '../features/usuarios.js';
import '../features/app.js';

/* ── CONFIG ── */
console.log("🔌 Conectando a Supabase");

const { data, error } = await sb.from(TABLE).select('count', { count: 'exact', head: true });

if (error) console.error("❌ Error de conexión o tabla:", error);
else console.log("✅ Tabla accesible");

/* ── Columnas DB pacientes ── */
/* ── Columnas DB controles ── */
/* ── Labels legibles ── */
sb.auth.onAuthStateChange(async (_e, session) => {
  if (session) {
    state.currentUser = session.user;
    await loadUserRole(session.user.id);
    showApp(session.user);
    await Promise.all([loadPacientes(), loadProfesionales()]);
  } else {
    state.currentUser = null; state.isAdmin = false;
    document.body.classList.remove('is-admin');
    showLogin();
  }
});

(async () => {
  const { data: { session } } = await sb.auth.getSession();
  if (session) {
    state.currentUser = session.user;
    await loadUserRole(session.user.id);
    showApp(session.user);
    await Promise.all([loadPacientes(), loadProfesionales()]);
  } else showLogin();
})();

document.getElementById('csv-source').addEventListener('change',()=>{ buildCsvCols(); updateCsvCount(); });

document.addEventListener('keydown',e=>{ if(e.key==='Escape'){window.closeForm();window.closeDet();window.closeDel();window.closeLightbox();window.closeRpt();window.closeCsvModal();window.closeEntrada();window.closeProfForm();window.closeProfDet();window.closeUsrForm();} if((e.ctrlKey||e.metaKey)&&e.key==='n'){e.preventDefault();window.openForm();} });

const s=document.createElement('style');

s.textContent='@keyframes shake{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-6px)}40%,80%{transform:translateX(6px)}}';

document.head.appendChild(s);

(function initTheme() {
  const saved = localStorage.getItem('mc_theme') || 'dark';
  applyTheme(saved);
})();
