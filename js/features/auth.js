// Autenticación y sesión.
import { state } from '../state.js';
import { USR_TABLE, sb } from '../supabase.js';
import { actions } from '../events.js';

export async function loadUserRole(uid) {
  const { data } = await sb.from(USR_TABLE).select('rol,nombre').eq('id', uid).single();
  state.isAdmin = data?.rol === 'admin';
  if (state.isAdmin) document.body.classList.add('is-admin');
  else document.body.classList.remove('is-admin');
  // update sidebar user role label
  const roleEl = document.querySelector('.user-role');
  if (roleEl) roleEl.textContent = state.isAdmin ? 'Administrador' : 'Usuario';
}

export function showLogin() {
  document.getElementById('page-login').classList.add('active');
  document.getElementById('page-app').classList.remove('active');
  setTimeout(() => document.getElementById('l-email').focus(), 100);
}

export function showApp(user) {
  document.getElementById('page-login').classList.remove('active');
  document.getElementById('page-app').classList.add('active');
  const email = user?.email || '';
  document.getElementById('user-email-display').textContent = email;
  document.getElementById('user-av').textContent = email.slice(0,2).toUpperCase();
}

actions.doLogin = async function() {
  const email = document.getElementById('l-email').value.trim();
  const pw    = document.getElementById('l-pw').value;
  let ok = true;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showFErr('email','Ingresá un email válido'); ok=false; }
  if (!pw) { showFErr('pw','La contraseña es requerida'); ok=false; }
  if (!ok) return;
  setBtnState(true);
  const { error } = await sb.auth.signInWithPassword({ email, password: pw });
  setBtnState(false);
  if (error) {
    document.getElementById('login-alert-txt').textContent = error.message.includes('Invalid')?'Email o contraseña incorrectos.':error.message;
    document.getElementById('login-alert').classList.add('show');
    shakePanel();
  }
};

actions.doLogout = async function() { await sb.auth.signOut(); state.pacientes=[]; };

function setBtnState(l) {
  document.getElementById('btn-login').disabled=l;
  document.getElementById('l-spin').style.display=l?'block':'none';
  document.getElementById('l-btn-ico').style.display=l?'none':'';
  document.getElementById('l-btn-txt').textContent=l?'Verificando…':'Iniciar sesión';
}

function showFErr(f,msg) { document.getElementById(`l-err-${f}-txt`).textContent=msg; document.getElementById(`l-err-${f}`).classList.add('show'); }

actions.loginClearErr=function(){ ['email','pw'].forEach(f=>document.getElementById(`l-err-${f}`).classList.remove('show')); document.getElementById('login-alert').classList.remove('show'); };

function shakePanel() { const p=document.querySelector('.lc-right'); p.style.animation='shake .4s ease'; setTimeout(()=>p.style.animation='',400); }

actions.togglePw=function() { const i=document.getElementById('l-pw'),on=i.type==='password'; i.type=on?'text':'password'; document.getElementById('ico-eye').style.display=on?'none':''; document.getElementById('ico-eye-off').style.display=on?'':'none'; };
