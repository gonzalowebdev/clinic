// Utilidades compartidas por index, paciente y profesional.

const ESC_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Escapa texto para insertarlo de forma segura en HTML (contenido y atributos). null/undefined → ''. */
export function esc(v) {
  return v == null ? '' : String(v).replace(/[&<>"']/g, ch => ESC_MAP[ch]);
}
