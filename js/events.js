// Delegación de eventos: reemplaza los atributos inline (onclick, onchange, oninput…).
// El HTML declara  data-click="accion"  y, si hace falta,  data-click-args='["a", "$el"]'.
// Argumentos especiales: "$el" (el elemento), "$value", "$checked" y "$event".

export const actions = {};

const builtins = {
  dragOn:  el => el.parentElement.classList.add('drag'),
  dragOff: el => el.parentElement.classList.remove('drag'),
};

function resolveArgs(el, type, ev) {
  const raw = el.dataset[type + 'Args'];
  if (!raw) return [];
  let list;
  try { list = JSON.parse(raw); } catch { return []; }
  return list.map(a => a === '$el' ? el : a === '$value' ? el.value : a === '$checked' ? el.checked : a === '$event' ? ev : a);
}

function dispatch(type, ev) {
  // Sube desde el elemento clickeado hasta el documento, igual que el burbujeo nativo.
  for (let el = ev.target; el && el !== document; el = el.parentElement) {
    if (!el.dataset) continue;
    const name = el.dataset[type];
    if (name && !(type === 'keydown' && el.dataset.keydownKey && ev.key !== el.dataset.keydownKey)) {
      if (builtins[name]) builtins[name](el);
      else if (actions[name] || window[name]) (actions[name] || window[name])(...resolveArgs(el, type, ev));
      else console.warn('Acción no registrada:', name);
      if (ev.cancelBubble) break;
    }
    if (type === 'click' && el.dataset.href) { location.href = el.dataset.href; break; }
  }
}

let started = false;
export function initEvents() {
  if (started) return;
  started = true;
  for (const type of ['click', 'change', 'input', 'keydown', 'dragover', 'dragleave', 'drop']) {
    document.addEventListener(type, ev => dispatch(type, ev));
  }
}
