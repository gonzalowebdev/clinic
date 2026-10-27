// Utilidades compartidas por index, paciente y profesional.
import { SITE_URL } from './config.js';

const ESC_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Escapa texto para insertarlo de forma segura en HTML (contenido y atributos). null/undefined → ''. */
export function esc(v) {
  return v == null ? '' : String(v).replace(/[&<>"']/g, ch => ESC_MAP[ch]);
}

/** Dirección de la ficha de un paciente (la que lleva el QR): SITE_URL o, si está vacío, el sitio actual + paciente.html?id=… */
export function fichaUrl(id) {
  const base = SITE_URL ? SITE_URL.replace(/\/?$/, '/') : new URL('./', location.href).href;
  return new URL('paciente.html?id=' + encodeURIComponent(id), base).href;
}
