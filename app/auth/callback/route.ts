import { NextResponse, type NextRequest } from 'next/server';
import { supabaseSesion } from '@/lib/supabase-server';

/** Cambia el codigo del magic link por una sesion con cookie. */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const destino = url.searchParams.get('destino') || '/mis-pedidos';
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? url.origin).replace(/\/+$/, '');

  if (code) {
    const sb = await supabaseSesion();
    const { error } = await sb.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${base}${destino}`);
  }
  return NextResponse.redirect(`${base}/entrar?error=1`);
}
