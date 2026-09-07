import { createClient } from '@supabase/supabase-js';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/** Solo lee filas con estado='listo' (lo impone RLS). Seguro en el cliente. */
export function supabasePublico() {
  return createClient(URL, ANON, { auth: { persistSession: false } });
}

/** Salta RLS. SOLO en rutas de servidor: nunca importar desde un componente 'use client'. */
export function supabaseAdmin() {
  return createClient(URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
}
