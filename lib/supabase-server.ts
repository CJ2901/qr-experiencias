import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Cliente de Supabase con la sesion del usuario leida de las cookies.
 * Usalo en Server Components y Server Actions cuando necesites saber
 * QUIEN esta pidiendo algo. Respeta RLS: eso es justamente lo que
 * hace que un cliente no pueda tocar el pedido de otro.
 */
export async function supabaseSesion() {
  const store = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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
  const { data } = await sb.auth.getUser();
  return data.user ?? null;
}
