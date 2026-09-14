import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { esCorreoAdmin } from '@/lib/admin';
import { requerir } from '@/lib/entorno';

/**
 * Dos trabajos:
 *  1. refrescar la cookie de sesion de Supabase en cada navegacion
 *     (sin esto el magic link "se cae" al cabo de una hora);
 *  2. mandar a entrar a quien pide una ruta privada.
 *
 * El middleware REDIRIGE, no autoriza. La autorizacion de verdad esta en
 * RLS (cliente) y en requerirAdmin/requerirAdminPagina (panel): una ruta
 * protegida solo aqui se salta llamando directo a la server action.
 */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const res = NextResponse.next({ request: req });
  const sb = createServerClient(
    requerir('NEXT_PUBLIC_SUPABASE_URL'),
    requerir('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (list) => {
          list.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
        },
      },
    }
  );

  const { data } = await sb.auth.getUser();
  const usuario = data.user;

  /* ---------------------------------------------------------- panel */
  if (pathname.startsWith('/admin') && pathname !== '/admin/sin-acceso') {
    if (!usuario) {
      const url = req.nextUrl.clone();
      url.pathname = '/entrar';
      url.searchParams.set('destino', pathname);
      return NextResponse.redirect(url);
    }
    if (!esCorreoAdmin(usuario.email)) {
      const url = req.nextUrl.clone();
      url.pathname = '/admin/sin-acceso';
      url.search = '';
      return NextResponse.redirect(url);
    }
    return res;
  }

  /* -------------------------------------------------------- cliente */
  if (pathname.startsWith('/mis-pedidos') || pathname.startsWith('/pedido/')) {
    if (!usuario) {
      const url = req.nextUrl.clone();
      url.pathname = '/entrar';
      url.searchParams.set('destino', pathname);
      return NextResponse.redirect(url);
    }
  }

  return res;
}

/**
 * OJO CON /api/pagar.
 *
 * Estaba fuera de esta lista, y ese era un agujero de verdad: el trabajo
 * numero 1 de aqui arriba es refrescar la cookie de sesion, y la unica
 * peticion que mueve dinero quedaba sin refrescar. Si el token vencia
 * justo en el POST del cobro, no habia nada que lo renovara y
 * usuarioActual() devolvia null -> 401 sin_sesion, con el comprador
 * mirando un formulario que acababa de funcionar.
 *
 * No se pone /api/:path* entero a proposito: el webhook de Mercado Pago
 * (/api/mp/webhook) no trae cookies de nadie y se autentica por firma
 * HMAC, y /api/subir y /api/pedidos van por API_KEY. Pasarlos por aqui
 * seria trabajo inutil en cada llamada.
 */
export const config = {
  matcher: [
    '/admin/:path*',
    '/mis-pedidos/:path*',
    '/pedido/:path*',
    '/checkout/:path*',
    '/api/pagar',
  ],
};
