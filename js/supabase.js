// Cliente de Supabase y nombres de tablas/buckets.
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';
import { SUPABASE_URL, SUPABASE_ANON } from './config.js';

export const sb = createClient(SUPABASE_URL, SUPABASE_ANON);

export const TABLE   = 'pacientes';

export const C_TABLE = 'controles';

export const CI_TABLE= 'control_imagenes';

export const BUCKET  = 'adjuntos';

export const P_TABLE = 'profesionales';

export const PP_TABLE= 'paciente_profesional';

export const USR_TABLE='perfiles';
