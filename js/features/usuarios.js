// Gestión de usuarios (solo admin).
import { state } from '../state.js';
import { USR_TABLE, sb } from '../supabase.js';
import { ICO_DEL, ICO_EDIT } from '../constants.js';
import { toast } from '../ui.js';
import { esc } from '../utils.js';
import { emptyRow } from './render.js';
import { actions } from '../events.js';

export async function renderUsuarios() {
  if (!state.isAdmin) return;
  const tb = document.getElementById('usr-tbody');
  tb.innerHTML = '<tr class="loading-row"><td colspan="5">Cargando…</td></tr>';
  const { data, error } = await sb.from(USR_TABLE).select('*').order('created_at');
  if (error) { toast(`Error: ${error.message}`,'error'); return; }
  state.usuarios = data || [];
  document.getElementById('usr-count').textContent = `${state.usuarios.length} usuario${state.usuarios.length!==1?'s':''}`;
  if (!state.usuarios.length) {
    tb.innerHTML = emptyRow(5,`<circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 10-16 0"/>`,'Sin usuarios','—');
    return;
  }
  tb.innerHTML = state.usuarios.map(u => {
    const isSelf = u.id === state.currentUser?.id;
    const date = u.created_at ? new Date(u.created_at).toLocaleDateString('es-AR',{day:'2-digit',month:'short',year:'numeric'}) : '—';
    return `<tr>
      <td><div class="td-p">${esc(u.email)||'—'}${isSelf?'<span style="font-size:10px;color:var(--accent);margin-left:6px;">(vos)</span>':''}</div></td>
      <td>${esc(u.nombre)||'<span style="color:var(--text-muted)">—</span>'}</td>
      <td><span class="role-badge ${u.rol==='admin'?'role-admin':'role-usuario'}">${u.rol==='admin'?'Admin':'Usuario'}</span></td>
      <td class="td-s">${date}</td>
      <td><div class="act-row">
        <button class="ic-btn ic-btn-green" data-click="openUsrForm" data-click-args="${esc(JSON.stringify([u.id]))}" title="Editar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">${ICO_EDIT}</svg></button>
        ${!isSelf?`<button class="ic-btn ic-btn-red" data-click="deleteUsuario" data-click-args="${esc(JSON.stringify([u.id]))}" title="Eliminar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">${ICO_DEL}</svg></button>`:''}
      </div></td>
    </tr>`;
  }).join('');
}

actions.openUsrForm = function(id=null) {
  if (!state.isAdmin) return;
  state.editUsrId = id || null;
  document.getElementById('uf-email').value  = '';
  document.getElementById('uf-nombre').value = '';
  document.getElementById('uf-rol').value    = 'usuario';
  document.getElementById('uf-pw').value     = '';
  const pwWrap = document.getElementById('uf-pw-wrap');

  if (id) {
    const u = state.usuarios.find(x=>x.id===id);
    if (u) {
      document.getElementById('uf-email').value  = u.email||'';
      document.getElementById('uf-nombre').value = u.nombre||'';
      document.getElementById('uf-rol').value    = u.rol||'usuario';
    }
    document.getElementById('usr-form-title').textContent = 'Editar Usuario';
    document.getElementById('usr-form-sub').textContent   = 'Modificá nombre, rol o contraseña';
    if (pwWrap) pwWrap.style.display='block';
  } else {
    document.getElementById('usr-form-title').textContent = 'Nuevo Usuario';
    document.getElementById('usr-form-sub').textContent   = 'Ingresá email y contraseña inicial';
    if (pwWrap) pwWrap.style.display='block';
  }
  document.getElementById('usr-form-overlay').classList.add('open');
};

actions.closeUsrForm  = function() { document.getElementById('usr-form-overlay').classList.remove('open'); state.editUsrId=null; };

actions.closeUsrFormIfBg = function(e) { if(e.target===document.getElementById('usr-form-overlay')) actions.closeUsrForm(); };

actions.saveUsuario = async function() {
  if (!state.isAdmin) return;
  const email  = document.getElementById('uf-email').value.trim();
  const nombre = document.getElementById('uf-nombre').value.trim();
  const rol    = document.getElementById('uf-rol').value;
  const pw     = document.getElementById('uf-pw').value;

  const btn=document.getElementById('btn-usr-save'),txt=document.getElementById('btn-usr-save-txt');
  btn.disabled=true; txt.textContent='Guardando…';

  if (state.editUsrId) {
    // Update perfil (nombre + rol)
    const { error:pe } = await sb.from(USR_TABLE).update({nombre,rol}).eq('id',state.editUsrId);
    if (pe) { toast(`Error: ${pe.message}`,'error'); btn.disabled=false; txt.textContent='Guardar'; return; }
    // Password change via user's own session (only works for self) — admin needs service key for others
    // We update the perfil and show a note if pw was typed
    if (pw && pw.length >= 6) {
      if (state.editUsrId === state.currentUser?.id) {
        const { error:pwe } = await sb.auth.updateUser({ password: pw });
        if (pwe) { toast(`Error al cambiar contraseña: ${pwe.message}`,'error'); }
        else { toast('Contraseña actualizada.','success'); }
      } else {
        toast('⚠️ Para cambiar la contraseña de otro usuario, hacelo desde el Dashboard de Supabase → Authentication → Users.','info');
      }
    }
    toast('Usuario actualizado.','success');
  } else {
    // New user: create via signUp (sends confirmation email)
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast('Email inválido.','error'); btn.disabled=false; txt.textContent='Guardar'; return;
    }
    if (!pw || pw.length < 6) {
      toast('La contraseña debe tener al menos 6 caracteres.','error'); btn.disabled=false; txt.textContent='Guardar'; return;
    }
    // Use Supabase Admin API if available, fallback: create via signUp
    // Note: signUp from another session won't auto-login — user gets email confirmation
    const { data: nu, error: ne } = await sb.auth.signUp({ email, password: pw, options:{ emailRedirectTo: window.location.href } });
    if (ne) { toast(`Error: ${ne.message}`,'error'); btn.disabled=false; txt.textContent='Guardar'; return; }
    // Update perfil record
    if (nu?.user) {
      await sb.from(USR_TABLE).update({nombre,rol,email}).eq('id',nu.user.id);
    }
    toast('Usuario creado. Recibirá un email de confirmación.','success');
  }
  btn.disabled=false; txt.textContent='Guardar';
  actions.closeUsrForm();
  await renderUsuarios();
};

actions.deleteUsuario = async function(id) {
  if (!state.isAdmin || id===state.currentUser?.id) return;
  if (!confirm('¿Eliminar este usuario? No podrá más acceder al sistema.')) return;
  // Delete perfil (auth.users requires service key — we delete the profile row)
  const { error } = await sb.from(USR_TABLE).delete().eq('id',id);
  if (error) { toast(`Error: ${error.message}`,'error'); return; }
  toast('Perfil eliminado. Para eliminar el acceso definitivamente, remové el usuario en Supabase Dashboard → Authentication.','info');
  await renderUsuarios();
};
