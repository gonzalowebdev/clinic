// Estructura común de la aplicación: sidebar + barra superior, tema y navegación.
// Una sola definición para index, ficha de paciente y ficha de profesional.
import { actions } from './events.js';
import { sb, USR_TABLE } from './supabase.js';

const act = (current) => (name) => (current === name ? ' active' : '');

function sidebarHTML({ active, badge }) {
  const act_ = act(active);
  const act_n = act_;
  return `
  <div class="sb-overlay" id="sb-overlay" data-click="closeSb"></div>
  <aside class="sidebar" id="sidebar">
    <div class="sb-logo">
      <div class="sb-logo-inner">
        <img src="logo.svg" height="36">
        <div><div class="sb-name">Clinic</div><div class="sb-sub">Gestión clínica</div></div>
      </div>
      <button class="sb-close" data-click="closeSb"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" width="16" height="16"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
    </div>
    <nav class="nav">
      <div class="nav-lbl">Principal</div>
      <div class="nav-item${act_n('dashboard')}" data-click="shellNav" data-click-args='["dashboard","$el"]' data-nav="dashboard">
        <svg class="nav-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
        Dashboard
      </div>
      <div class="nav-item${act_n('pacientes')}" data-click="shellNav" data-click-args='["pacientes","$el"]' data-nav="pacientes">
        <svg class="nav-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
        Pacientes
        ${badge ? '<span class="nav-badge" id="badge-total">0</span>' : ''}
      </div>
      <div class="nav-lbl">Módulos</div>
      <div class="nav-item${act_n('historia')}" data-click="shellNav" data-click-args='["historia","$el"]' data-nav="historia">
        <svg class="nav-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
        Historia Clínica
      </div>
      <div class="nav-item${act_n('estudios')}" data-click="shellNav" data-click-args='["estudios","$el"]' data-nav="estudios">
        <svg class="nav-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v11m0 0H5a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2h-4m-6 0h6"/></svg>
        Estudios
      </div>
      <div class="nav-item${act_n('profesionales')}" data-click="shellNav" data-click-args='["profesionales","$el"]' data-nav="profesionales">
        <svg class="nav-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/><line x1="12" y1="11" x2="12" y2="13"/><line x1="10" y1="12" x2="14" y2="12"/></svg>
        Profesionales
      </div>
      <div class="nav-lbl admin-only-block">Administración</div>
      <div class="nav-item${act_n('usuarios')} admin-only" data-click="shellNav" data-click-args='["usuarios","$el"]' data-nav="usuarios">
        <svg class="nav-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 10-16 0"/><line x1="12" y1="12" x2="12" y2="16"/><line x1="10" y1="14" x2="14" y2="14"/></svg>
        Usuarios
      </div>
    </nav>
    <div class="sb-footer">
      <button class="btn-theme" id="btn-theme" data-click="toggleTheme">
        <svg id="theme-icon-dark" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>
        </svg>
        <svg id="theme-icon-light" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="display:none">
          <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
          <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
        </svg>
        <span id="theme-label">Modo claro</span>
      </button>
      <div class="user-card">
        <div class="av" id="user-av">DR</div>
        <div><div class="user-name" id="user-email-display">—</div><div class="user-role">Usuario activo</div></div>
      </div>
      <button class="btn-logout" data-click="doLogout">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16,17 21,12 16,7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
        Cerrar sesión
      </button>
    </div>
  </aside>
`;
}

function topbarHTML({ title, mode }) {
  const isIndex = mode === 'index';
  const searchAttrs = isIndex
    ? 'data-input="onSearch" data-input-args=\'["$value"]\''
    : 'data-keydown="shellSearch" data-keydown-key="Enter" data-keydown-args=\'["$value"]\'';
  const clearBtn = isIndex ? `<button class="s-clear" id="s-clear" data-click="clearSearch"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" width="14" height="14"><path d="M18 6L6 18M6 6l12 12"/></svg></button>` : '';
  const newAttrs = isIndex ? 'data-click="openForm"' : 'data-href="index.html#nuevo"';
  return `
    <header class="topbar">
      <button class="menu-btn" data-click="openSb"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" width="18" height="18"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg></button>
      <span class="page-title" id="page-title">${title}</span>
      <div class="search-wrap">
        <svg class="s-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input type="text" id="search-input" placeholder="Nombre, DNI, patología, ciudad…" ${searchAttrs}>${clearBtn}
      </div>
      <button class="btn btn-primary" ${newAttrs}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" width="15" height="15"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        <span>Nuevo Paciente</span>
      </button>
    </header>
`;
}

/** Reemplaza los marcadores #shell-aside y #shell-topbar por la sidebar y la barra superior. */
export function mountShell({ active = 'dashboard', title = 'Dashboard', mode = 'index', badge = mode === 'index' } = {}) {
  const aside = document.getElementById('shell-aside');
  const top = document.getElementById('shell-topbar');
  if (aside) { aside.insertAdjacentHTML('beforebegin', sidebarHTML({ active, badge })); aside.remove(); }
  if (top) { top.insertAdjacentHTML('beforebegin', topbarHTML({ title, mode })); top.remove(); }
}

/** Datos del usuario en la sidebar y rol (muestra/oculta lo exclusivo de admin). */
export async function fillShellUser(user) {
  const email = user?.email || '';
  const nameEl = document.getElementById('user-email-display');
  const avEl = document.getElementById('user-av');
  if (nameEl) nameEl.textContent = email;
  if (avEl) avEl.textContent = email.slice(0, 2).toUpperCase();
  if (!user?.id) return;
  const { data } = await sb.from(USR_TABLE).select('rol').eq('id', user.id).single();
  const admin = data?.rol === 'admin';
  document.body.classList.toggle('is-admin', admin);
  const roleEl = document.querySelector('.user-role');
  if (roleEl) roleEl.textContent = admin ? 'Administrador' : 'Usuario';
}

/* ── Tema claro/oscuro ── */
export function applyTheme(mode) {
  const light = mode === 'light';
  document.body.classList.toggle('light', light);
  const iconDark = document.getElementById('theme-icon-dark');
  const iconLight = document.getElementById('theme-icon-light');
  const label = document.getElementById('theme-label');
  if (iconDark) iconDark.style.display = light ? 'none' : '';
  if (iconLight) iconLight.style.display = light ? '' : 'none';
  if (label) label.textContent = light ? 'Modo oscuro' : 'Modo claro';
}

export function initTheme() {
  applyTheme(localStorage.getItem('mc_theme') || 'light');
}

actions.toggleTheme = function () {
  const next = document.body.classList.contains('light') ? 'dark' : 'light';
  localStorage.setItem('mc_theme', next);
  applyTheme(next);
};

/* ── Sidebar móvil ── */
actions.openSb = () => {
  document.getElementById('sidebar').classList.add('open');
  document.getElementById('sb-overlay').classList.add('show');
};
actions.closeSb = () => {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sb-overlay').classList.remove('show');
};

/* ── Navegación: en el panel cambia de vista; desde una ficha vuelve al panel en esa sección ── */
actions.shellNav = function (name, el) {
  if (document.getElementById('view-' + name)) actions.showView(name, el);
  else location.href = 'index.html#' + name;
};

/* Buscador de la barra superior en las fichas: lleva la búsqueda al listado de pacientes. */
actions.shellSearch = function (q) {
  const text = String(q || '').trim();
  location.href = text ? 'index.html#buscar=' + encodeURIComponent(text) : 'index.html#pacientes';
};
