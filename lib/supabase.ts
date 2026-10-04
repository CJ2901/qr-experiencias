import { createClient } from '@supabase/supabase-js';
import { requerir } from './entorno';

/* Se leen DENTRO de cada funcion, no al importar el modulo: si faltara una
   variable, hacerlo arriba revienta el modulo entero al cargarse y el
   error aparece en cualquier ruta que lo importe, lejos de la causa.
   (Antes tambien habia un `const URL` aqui, que tapaba el URL global.) */

/* supabasePublico() se elimino (migracion 006): la anon key ya no lee
   pedidos. La pagina del regalo lee desde el servidor con supabaseAdmin. */

/** Salta RLS. SOLO en rutas de servidor: nunca importar desde un componente 'use client'. */
export function supabaseAdmin() {
  return createClient(
    requerir('NEXT_PUBLIC_SUPABASE_URL'),
    requerir('SUPABASE_SERVICE_ROLE_KEY'),
    { auth: { persistSession: false } }
  );
}
