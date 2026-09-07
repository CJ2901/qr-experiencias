import { NextResponse, type NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { esTemaValido, calcularVencimiento } from '@/lib/temas';
import { nuevoSlug } from '@/lib/slug';

/**
 * POST /api/pedidos
 * Lo llama Make (o Tally, o el panel) cuando hay una venta.
 * Cabecera obligatoria:  x-api-key: <API_KEY>
 *
 * Cuerpo minimo:
 *   { ocasion, destinatario, frase_principal, mensaje }
 *
 * Devuelve { url } lista para meter en el QR.
 */

export const runtime = 'nodejs';
export const preferredRegion = 'iad1';

const OBLIGATORIOS = ['ocasion', 'destinatario', 'frase_principal', 'mensaje'] as const;

export async function POST(req: NextRequest) {
  if (req.headers.get('x-api-key') !== process.env.API_KEY) {
    return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'json invalido' }, { status: 400 }); }

  const faltan = OBLIGATORIOS.filter((k) => !body[k]);
  if (faltan.length) {
    return NextResponse.json({ error: `faltan campos: ${faltan.join(', ')}` }, { status: 400 });
  }

  const sb = supabaseAdmin();

  // la ocasion tiene que existir; asi la URL nunca apunta a nada raro
  const { data: oc } = await sb
    .from('ocasiones').select('slug, emojis, tema_default')
    .eq('slug', body.ocasion).eq('activa', true).maybeSingle();
  if (!oc) return NextResponse.json({ error: 'ocasion desconocida' }, { status: 400 });

  const tema = esTemaValido(body.tema) ? body.tema : oc.tema_default;
  const retencion = typeof body.retencion === 'string' ? body.retencion : '12m';

  // idempotencia: si Make reintenta el webhook, no creamos dos paginas
  const slug = typeof body.slug === 'string' && body.slug ? body.slug : nuevoSlug();

  const fila = {
    ocasion: oc.slug,
    slug,
    tema,
    estado: body.estado === 'listo' ? 'listo' : 'borrador',
    destinatario: body.destinatario,
    pareja: body.pareja ?? null,
    frase_principal: body.frase_principal,
    fecha_texto: body.fecha_texto ?? null,
    mensaje: body.mensaje,
    frase_capitulo: body.frase_capitulo ?? null,
    frase_brindis: body.frase_brindis ?? null,
    frase_final: body.frase_final ?? null,
    emojis: body.emojis ?? oc.emojis,
    texto_boton: body.texto_boton ?? 'Guardar este momento',
    fotos: Array.isArray(body.fotos) ? body.fotos : [],
    foto_final: body.foto_final ?? null,
    voz_url: body.voz_url ?? null,
    cancion_url: body.cancion_url ?? null,
    comprador_email: body.comprador_email ?? null,
    comprador_tel: body.comprador_tel ?? null,
    retencion,
    media_expira_en: calcularVencimiento(retencion),
  };

  const { data, error } = await sb
    .from('pedidos')
    .upsert(fila, { onConflict: 'ocasion,slug' })
    .select('ocasion, slug, tema, estado')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // sin barra final: si la variable la trae, la URL saldria con doble barra
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/+$/, '');
  return NextResponse.json({
    ...data,
    url: `${base}/${data.ocasion}/${data.slug}`,
  }, { status: 201 });
}

/** GET /api/pedidos — listado para el panel. Misma clave. */
export async function GET(req: NextRequest) {
  if (req.headers.get('x-api-key') !== process.env.API_KEY) {
    return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  }
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from('pedidos')
    .select('id, ocasion, slug, tema, estado, destinatario, creado_en, media_expira_en')
    .order('creado_en', { ascending: false })
    .limit(100);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ pedidos: data });
}
