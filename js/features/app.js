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

/** Abre la vista pedida en la URL (#pacientes, #nuevo, #buscar=texto). Se usa al llegar desde una ficha. */
let hashApplied = false;
export function applyHash() {
  if (hashApplied) return;
  hashApplied = true;
  const h = decodeURIComponent(location.hash.slice(1));
  if (!h) return;
  history.replaceState(null, '', location.pathname + location.search);
  const go = (name) => actions.showView(name, document.querySelector(`.nav-item[data-nav="${name}"]`));
  if (h === 'nuevo') { go('pacientes'); actions.openForm(); return; }
  if (h.startsWith('buscar=')) {
    const q = h.slice(7);
    go('pacientes');
    const input = document.getElementById('search-input');
    if (input) input.value = q;
    actions.onSearch(q);
    return;
  }
  if (VIEW_TITLES[h] && !(h === 'usuarios' && !state.isAdmin)) go(h);
}
