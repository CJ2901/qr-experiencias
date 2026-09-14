import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { requerir } from './entorno';

/**
 * Cliente de Supabase con la sesion del usuario leida de las cookies.
 * Usalo en Server Components y Server Actions cuando necesites saber
 * QUIEN esta pidiendo algo. Respeta RLS: eso es justamente lo que
 * hace que un cliente no pueda tocar el pedido de otro.
 */
export async function supabaseSesion() {
  const store = await cookies();
  return createServerClient(
    requerir('NEXT_PUBLIC_SUPABASE_URL'),
    requerir('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    {
      cookies: {
        getAll: () => store.getAll(),
        setAll: (list) => {
          try {
            list.forEach(({ name, value, options }) => store.set(name, value, options));
          } catch {
            // Llamado desde un Server Component: la cookie la refresca el middleware.
          }
        },
      },
    }
  );
}

export async function usuarioActual() {
  const sb = await supabaseSesion();
  const { data, error } = await sb.auth.getUser();
  // Un null aqui puede ser "no ha entrado nadie" o "el token venció y no se
  // pudo refrescar", que son problemas distintos y hasta ahora se veian
  // igual: un 401 pelado. Supabase si da el motivo; solo habia que mirarlo.
  if (error) {
    console.warn('[sesion] getUser falló', {
      status: error.status,
      code: error.code,
      mensaje: error.message,
    });
  }
  return data.user ?? null;
}

/**
 * Que cookies de Supabase llegaron en esta peticion. SOLO LOS NOMBRES:
 * el valor es la sesion entera y no tiene por que aparecer en un log.
 *
 * Es la unica forma de distinguir las dos causas de un 401 en el cobro:
 *  - lista vacia  -> la cookie no viajó (dominio distinto, SameSite, etc.)
 *  - hay cookies  -> viajó pero Supabase la rechazó; el motivo lo dice
 *                    el aviso de arriba.
 */
export async function cookiesDeSesion(): Promise<string[]> {
  const store = await cookies();
  return store
    .getAll()
    .map((c) => c.name)
    .filter((n) => n.startsWith('sb-'));
}
