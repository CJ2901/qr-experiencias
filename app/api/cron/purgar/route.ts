import { NextResponse, type NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * GET /api/cron/purgar — borrado definitivo a los 5 anos.
 *
 * Lo dispara Vercel Cron a diario (vercel.json). Vercel manda
 * "Authorization: Bearer <CRON_SECRET>"; sin esa variable la ruta
 * rechaza todo.
 *
 * Orden: 1) borrar archivos por la API de Storage (un DELETE en
 * storage.objects NO borra el archivo fisico), 2) verificar que no quede
 * nada, 3) cerrar_purga() borra el contenido de la fila y deja auditoria.
 * Si algo falla, el pedido queda pendiente y el job de manana reintenta.
 */

export const runtime = 'nodejs';
export const preferredRegion = 'iad1';
export const maxDuration = 60;

const LOTE = 50;
type SB = ReturnType<typeof supabaseAdmin>;

async function listar(sb: SB, carpeta: string): Promise<string[]> {
  const { data } = await sb.storage.from('media').list(carpeta, { limit: 1000 });
  // los objetos tienen id; las "subcarpetas" no
  return (data ?? []).filter((o) => o.id).map((o) => `${carpeta}/${o.name}`);
}

export async function GET(req: NextRequest) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto || req.headers.get('authorization') !== `Bearer ${secreto}`) {
    return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  }

  const sb = supabaseAdmin();
  const { data: vencidos, error } = await sb
    .from('pedidos')
    .select('id, slug, fotos, foto_final, voz_url, cancion_url')
    .lt('media_expira_en', new Date().toISOString())
    .is('purgado_en', null)
    .limit(LOTE);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const res = { purgados: 0, pendientes: [] as string[] };

  for (const p of vencidos ?? []) {
    // la tienda sube a pedidos/<id>/; el panel y Make a pedidos/<slug>/
    const carpetas = [`pedidos/${p.id}`, `pedidos/${p.slug}`];
    const guardadas = [...((p.fotos as unknown[]) ?? []), p.foto_final, p.voz_url, p.cancion_url].filter(
      (r): r is string => typeof r === 'string' && r.startsWith('pedidos/')
    );
    const enCarpetas = (await Promise.all(carpetas.map((c) => listar(sb, c)))).flat();
    const rutas = [...new Set([...guardadas, ...enCarpetas])];

    if (rutas.length) {
      const { error: e } = await sb.storage.from('media').remove(rutas);
      if (e) { res.pendientes.push(p.id); continue; }
    }

    const quedan = (await Promise.all(carpetas.map((c) => listar(sb, c)))).flat();
    if (quedan.length) { res.pendientes.push(p.id); continue; }

    const { error: e2 } = await sb.rpc('cerrar_purga', { p_pedido: p.id, p_archivos: rutas.length });
    if (e2) { res.pendientes.push(p.id); continue; }
    res.purgados++;
  }

  if (res.pendientes.length) console.warn('[purgar] pendientes', res.pendientes);
  return NextResponse.json(res);
}
