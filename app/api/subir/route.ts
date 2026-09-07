import { NextResponse, type NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';
export const preferredRegion = 'iad1';

/**
 * POST /api/subir
 * Devuelve una URL firmada para que el navegador (o Make) suba la foto
 * DIRECTO a Supabase Storage, sin pasar por este servidor.
 *
 * Cuerpo: { ruta: "pedidos/<slug>/1.jpg" }
 */
export async function POST(req: NextRequest) {
  if (req.headers.get('x-api-key') !== process.env.API_KEY) {
    return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  }
  const { ruta } = await req.json().catch(() => ({ ruta: '' }));
  if (typeof ruta !== 'string' || !ruta.startsWith('pedidos/')) {
    return NextResponse.json({ error: 'ruta invalida' }, { status: 400 });
  }
  const sb = supabaseAdmin();
  const { data, error } = await sb.storage.from('media').createSignedUploadUrl(ruta);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
