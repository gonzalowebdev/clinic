// Contexto de la ficha: id del paciente tomado de la URL.


/* ── CONFIG ── */
/* ── STATE ── */
const params   = new URLSearchParams(location.search);

export const pacId    = params.get('id');
