import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseSesion } from '@/lib/supabase-server';
import { baseDelSitio } from '@/lib/sitio';

/**
 * Cambia el codigo del magic link por una sesion con cookie.
 *
 * El "destino" NO viaja en la URL: Supabase valida `redirect_to` contra la
 * lista de Redirect URLs del panel con match exacto, y esa lista solo tiene
 * la ruta pelada (`/auth/callback`, sin query string). Si el link trae
 * `?destino=...`, la validacion falla y Supabase cae en silencio al Site
 * URL (la raiz) sin canjear el codigo -> se pierde la sesion y la app
 * termina en /catalogo, que es lo que hace la raiz.
 *
 * Por eso el destino se guarda en una cookie de corta duracion ANTES de
 * pedir el enlace (ver entrar/page.tsx) y se lee aqui.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const base = (await baseDelSitio()) || url.origin;

  const store = await cookies();
  const destino = store.get('destino_login')?.value || '/mis-pedidos';
  store.delete('destino_login');

  if (code) {
    const sb = await supabaseSesion();
    const { error } = await sb.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${base}${destino}`);
    console.error('[callback] no se pudo canjear el código', {
      status: error.status,
      code: error.code,
      mensaje: error.message,
    });
  }
  return NextResponse.redirect(`${base}/entrar?error=envio`);
}
