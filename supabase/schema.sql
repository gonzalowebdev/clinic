-- ============================================================================
-- Clinic · esquema de base de datos para Supabase
-- Pegar completo en: Supabase → SQL Editor → New query → Run
-- Es idempotente: se puede ejecutar más de una vez.
-- ============================================================================

create extension if not exists pgcrypto;

-- ── TABLAS ──────────────────────────────────────────────────────────────────

create table if not exists public.perfiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text,
  nombre     text,
  rol        text not null default 'usuario' check (rol in ('admin','usuario')),
  created_at timestamptz not null default now()
);

create table if not exists public.pacientes (
  id                       uuid primary key default gen_random_uuid(),
  apellido                 text not null,
  nombres                  text not null,
  dni                      text not null,
  telefonos                text,
  mail                     text,
  domicilio                text,
  ciudad                   text,
  contacto_familia         text,
  medico_tratante          text,
  patologia                text,
  patologia1               text,
  patologia2               text,
  diagnostico_medico       text,
  historia_clinica         text,
  epicrisis                text,
  estudios_complementarios text,
  observaciones            text,
  enfermeria               text,
  kinesiologia             text,
  otros_profesionales      text,
  otros                    text,
  activo                   boolean not null default true,
  created_at               timestamptz not null default now()
);
create unique index if not exists pacientes_dni_uidx on public.pacientes (dni);

create table if not exists public.profesionales (
  id            uuid primary key default gen_random_uuid(),
  apellido      text not null,
  nombres       text not null,
  especialidad  text,
  matricula     text,
  telefono      text,
  mail          text,
  domicilio     text,
  ciudad        text,
  observaciones text,
  created_at    timestamptz not null default now()
);

create table if not exists public.paciente_profesional (
  paciente_id    uuid not null references public.pacientes(id)      on delete cascade,
  profesional_id uuid not null references public.profesionales(id)  on delete cascade,
  primary key (paciente_id, profesional_id)
);
create index if not exists pp_profesional_idx on public.paciente_profesional (profesional_id);

create table if not exists public.controles (
  id                  uuid primary key default gen_random_uuid(),
  paciente_id         uuid not null references public.pacientes(id) on delete cascade,
  fecha               date,
  enfermeria          text,
  kinesiologia        text,
  diagnostico_medico  text,
  observaciones       text,
  otros_profesionales text,
  otros               text,
  responsable         text,
  turno               text,
  created_at          timestamptz not null default now()
);
create index if not exists controles_paciente_fecha_idx on public.controles (paciente_id, fecha desc);

create table if not exists public.control_imagenes (
  id           uuid primary key default gen_random_uuid(),
  control_id   uuid not null references public.controles(id) on delete cascade,
  paciente_id  uuid not null references public.pacientes(id) on delete cascade,
  storage_path text not null,
  nombre       text,
  incluir_pdf  boolean not null default false,
  created_at   timestamptz not null default now()
);
create index if not exists ci_control_idx on public.control_imagenes (control_id);

-- ── PERFIL AUTOMÁTICO AL CREAR UN USUARIO ──────────────────────────────────

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.perfiles (id, email, nombre, rol)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'nombre',''), 'usuario')
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Perfiles para usuarios que ya existían antes de este script
insert into public.perfiles (id, email, rol)
select id, email, 'usuario' from auth.users
on conflict (id) do nothing;

-- ── FUNCIONES DE ROL (security definer: evitan recursión en RLS) ───────────

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.perfiles where id = auth.uid());
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.perfiles where id = auth.uid() and rol = 'admin');
$$;

revoke all on function public.is_staff(), public.is_admin() from public;
grant execute on function public.is_staff(), public.is_admin() to authenticated;

-- ── RLS: nadie entra sin sesión ni sin perfil ──────────────────────────────

revoke all on all tables in schema public from anon;

alter table public.perfiles             enable row level security;
alter table public.pacientes            enable row level security;
alter table public.profesionales        enable row level security;
alter table public.paciente_profesional enable row level security;
alter table public.controles            enable row level security;
alter table public.control_imagenes     enable row level security;

-- perfiles: cada uno ve el suyo; el admin ve y modifica todos. Nadie se cambia el rol.
drop policy if exists perfiles_select on public.perfiles;
drop policy if exists perfiles_update on public.perfiles;
drop policy if exists perfiles_delete on public.perfiles;
create policy perfiles_select on public.perfiles for select to authenticated
  using (id = auth.uid() or public.is_admin());
create policy perfiles_update on public.perfiles for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy perfiles_delete on public.perfiles for delete to authenticated
  using (public.is_admin() and id <> auth.uid());

-- pacientes: el equipo ve/crea/edita; solo el admin elimina
drop policy if exists pacientes_select on public.pacientes;
drop policy if exists pacientes_insert on public.pacientes;
drop policy if exists pacientes_update on public.pacientes;
drop policy if exists pacientes_delete on public.pacientes;
create policy pacientes_select on public.pacientes for select to authenticated using (public.is_staff());
create policy pacientes_insert on public.pacientes for insert to authenticated with check (public.is_staff());
create policy pacientes_update on public.pacientes for update to authenticated using (public.is_staff()) with check (public.is_staff());
create policy pacientes_delete on public.pacientes for delete to authenticated using (public.is_admin());

-- profesionales: el equipo ve; solo el admin crea/edita/elimina
drop policy if exists profesionales_select on public.profesionales;
drop policy if exists profesionales_write  on public.profesionales;
create policy profesionales_select on public.profesionales for select to authenticated using (public.is_staff());
create policy profesionales_write  on public.profesionales for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- vínculos paciente–profesional, controles e imágenes: todo el equipo
drop policy if exists pp_all  on public.paciente_profesional;
drop policy if exists ctrl_all on public.controles;
drop policy if exists ci_all  on public.control_imagenes;
create policy pp_all   on public.paciente_profesional for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy ctrl_all on public.controles            for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy ci_all   on public.control_imagenes     for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- ── STORAGE: bucket PRIVADO para adjuntos ──────────────────────────────────

insert into storage.buckets (id, name, public)
values ('adjuntos', 'adjuntos', false)
on conflict (id) do update set public = false;

drop policy if exists adjuntos_select on storage.objects;
drop policy if exists adjuntos_insert on storage.objects;
drop policy if exists adjuntos_delete on storage.objects;
create policy adjuntos_select on storage.objects for select to authenticated
  using (bucket_id = 'adjuntos' and public.is_staff());
create policy adjuntos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'adjuntos' and public.is_staff());
create policy adjuntos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'adjuntos' and public.is_staff());

-- ── PRIMER ADMINISTRADOR ───────────────────────────────────────────────────
-- 1) Crea tu usuario en Authentication → Users (o iniciando sesión con uno existente).
-- 2) Descomenta, pon tu email y ejecuta:
-- update public.perfiles set rol = 'admin' where email = 'TU_EMAIL@ejemplo.com';
