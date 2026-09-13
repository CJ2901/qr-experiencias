import { createClient } from '@supabase/supabase-js';
import { requerir } from './entorno';

/* Se leen DENTRO de cada funcion, no al importar el modulo: si faltara una
   variable, hacerlo arriba revienta el modulo entero al cargarse y el
   error aparece en cualquier ruta que lo importe, lejos de la causa.
   (Antes tambien habia un `const URL` aqui, que tapaba el URL global.) */

/** Solo lee filas con estado='listo' (lo impone RLS). Seguro en el cliente. */
export function supabasePublico() {
  return createClient(
    requerir('NEXT_PUBLIC_SUPABASE_URL'),
    requerir('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    { auth: { persistSession: false } }
  );
}

/** Salta RLS. SOLO en rutas de servidor: nunca importar desde un componente 'use client'. */
export function supabaseAdmin() {
  return createClient(
    requerir('NEXT_PUBLIC_SUPABASE_URL'),
    requerir('SUPABASE_SERVICE_ROLE_KEY'),
    { auth: { persistSession: false } }
  );
}
