// Navegación, tema claro/oscuro y sidebar.
import { state } from '../state.js';
import { VIEW_TITLES } from '../constants.js';
import { renderEstudios, renderHistoria } from './render.js';
import { renderProfesionales } from './profesionales.js';
import { renderUsuarios } from './usuarios.js';
import { actions } from '../events.js';

actions.showView=function(name,el){
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
  const view = document.getElementById('view-'+name);
  if (!view) return;
  view.classList.add('active');
  if(el) el.classList.add('active');
  document.getElementById('page-title').textContent=VIEW_TITLES[name]||name;
  if(name==='historia') renderHistoria();
  if(name==='estudios') renderEstudios();
  if(name==='profesionales') renderProfesionales();
  if(name==='usuarios' && state.isAdmin) renderUsuarios();
  if(window.innerWidth<=768) actions.closeSb();
};

actions.openSb=()=>{ document.getElementById('sidebar').classList.add('open'); document.getElementById('sb-overlay').classList.add('show'); };

actions.closeSb=()=>{ document.getElementById('sidebar').classList.remove('open'); document.getElementById('sb-overlay').classList.remove('show'); };

export function applyTheme(mode) {
  const body = document.body;
  const iconDark  = document.getElementById('theme-icon-dark');
  const iconLight = document.getElementById('theme-icon-light');
  const label     = document.getElementById('theme-label');
  if (mode === 'light') {
    body.classList.add('light');
    if (iconDark)  iconDark.style.display  = 'none';
    if (iconLight) iconLight.style.display = '';
    if (label)     label.textContent       = 'Modo oscuro';
  } else {
    body.classList.remove('light');
    if (iconDark)  iconDark.style.display  = '';
    if (iconLight) iconLight.style.display = 'none';
    if (label)     label.textContent       = 'Modo claro';
  }
}

actions.toggleTheme = function() {
  const isLight = document.body.classList.contains('light');
  const next = isLight ? 'dark' : 'light';
  localStorage.setItem('mc_theme', next);
  applyTheme(next);
};
