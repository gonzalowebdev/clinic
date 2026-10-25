// Helpers de fechas (solo presentación). Las fechas de control vienen como 'YYYY-MM-DD'.
const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export function parseFecha(s) {
  if (!s) return null;
  const [y, m, d] = String(s).slice(0, 10).split('-').map(Number);
  return y && m && d ? new Date(y, m - 1, d) : null;
}

/** Días transcurridos desde la fecha (0 = hoy). null si no hay fecha válida. */
export function diasDesde(s) {
  const f = parseFecha(s);
  if (!f) return null;
  const t = new Date();
  return Math.round((new Date(t.getFullYear(), t.getMonth(), t.getDate()) - f) / 86400000);
}

export function hace(n) {
  return n <= 0 ? 'Hoy' : n === 1 ? 'Ayer' : `Hace ${n} días`;
}

export function fechaCorta(s) {
  const f = parseFecha(s);
  return f ? `${f.getDate()} ${MESES_CORTOS[f.getMonth()]} ${f.getFullYear()}` : '—';
}

export function mesLargo(s) {
  const f = parseFecha(s);
  return f ? f.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' }) : 'Sin fecha';
}
