// Configuración de Supabase (única fuente para index, paciente y profesional).
// La anon key es pública por diseño: la seguridad real depende de las políticas RLS en Supabase.
export const SUPABASE_URL  = 'https://dedyjnqwrjiwcvsxvqsn.supabase.co';
export const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRlZHlqbnF3cmppd2N2c3h2cXNuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxMTgzOTcsImV4cCI6MjA5NDY5NDM5N30.c6Xt-oqejcZe3RyAXDqbbek8W8Ix7ZNG5f5mYefH5EE';

// Dirección pública del sitio, solo para el QR de la credencial.
// Vacío = se usa la dirección desde la que se abre la app (funciona en cualquier dominio o carpeta).
// Si se imprimen credenciales desde una vista previa de Netlify o desde localhost, conviene fijar aquí
// la dirección definitiva, por ejemplo 'https://mi-clinica.netlify.app/'.
export const SITE_URL = '';
