import { NextResponse, type NextRequest } from 'next/server';
import crypto from 'node:crypto';
import { supabaseAdmin } from '@/lib/supabase';
import { nuevoSlug } from '@/lib/slug';
import { consultar } from '@/lib/pagos/pasarela';
import { buscarIntento, buscarPedidoPorPago, sincronizarPedido } from '@/lib/pagos/repositorio';

/**
 * POST /api/mp/webhook
 *
 * La VERDAD del pago. El navegador no es de fiar: el cliente puede cerrar
 * la pestana justo al aprobarse, y Yape o los pagos en efectivo se
 * acreditan minutos despues. Sin esto, esos pedidos se pierden.
 *
 * Configuralo en Mercado Pago > Tus integraciones > Webhooks:
 *   https://tudominio.pe/api/mp/webhook
 * Copia la clave secreta que te dan y ponla en MP_WEBHOOK_SECRET.
 *
 * QUE EVENTO MARCAR: desde la migracion a la Orders API (set. 2026) el id
 * que llega y el que guardamos en pedidos.mp_payment_id es el de la ORDEN
 * (ORD…), no el del pago de adentro. Marca el evento de ordenes; si solo
 * hubiera "payment", `consultar` no encontrara nada y esta ruta devolvera
 * 200 sin hacer dano, pero los pagos diferidos no se acreditaran solos.
 *
 * MIENTRAS MP_WEBHOOK_SECRET ESTE VACIA esta ruta rechaza todo con 401.
 * Es deliberado: sin firma, cualquiera marca pedidos como pagados con un
 * curl. En local eso no molesta porque MP no puede llamar a localhost;
 * ahi la red de seguridad es el boton "Ya pague, revisar".
 */

export const runtime = 'nodejs';
export const preferredRegion = 'iad1';

/** Firma HMAC de Mercado Pago. Sin esto el endpoint es un regalo. */
function firmaValida(req: NextRequest, dataId: string): boolean {
  const secreto = process.env.MP_WEBHOOK_SECRET;
  if (!secreto) {
    console.warn('[webhook] MP_WEBHOOK_SECRET vacia: se rechaza la notificacion.');
    return false;
  }

  const cabecera = req.headers.get('x-signature') ?? '';
  const requestId = req.headers.get('x-request-id') ?? '';
  const partes = Object.fromEntries(
    cabecera
      .split(',')
      .map((p) => p.split('=').map((x) => x.trim()))
      .filter((p): p is [string, string] => p.length === 2)
  );
  const ts = partes['ts'];
  const v1 = partes['v1'];
  if (!ts || !v1) return false;

  const base = `id:${dataId};request-id:${requestId};ts:${ts};`;
  const esperado = crypto.createHmac('sha256', secreto).update(base).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(esperado), Buffer.from(v1));
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  const cuerpo = await req.json().catch(() => ({}) as Record<string, unknown>);
  const dataId =
    url.searchParams.get('data.id') ?? (cuerpo as { data?: { id?: string } }).data?.id ?? '';

  // 200 a proposito: sin id no hay nada que hacer y MP no debe reintentar.
  if (!dataId) return NextResponse.json({ ok: true });

  if (!firmaValida(req, String(dataId))) {
    return NextResponse.json({ error: 'firma invalida' }, { status: 401 });
  }

  // Nunca confiamos en el cuerpo: preguntamos a Mercado Pago.
  const pago = await consultar(String(dataId));
  if (!pago) return NextResponse.json({ ok: true });

  const existente = await buscarPedidoPorPago(pago.id);
  if (existente) {
    await sincronizarPedido(existente.id, existente.estado, pago);
    return NextResponse.json({ ok: true });
  }

  // Caso raro pero real: el navegador murio antes de crear la fila.
  // Antes se reconstruia desde la `metadata` del pago; la Orders API no
  // tiene ese campo, asi que lo que viaja es el id del intento en
  // `external_reference` y los datos se releen de `intentos_pago`. Sale
  // mejor: la bitacora es nuestra y no depende de que MP nos devuelva
  // intacto lo que le mandamos.
  const intento = await buscarIntento(pago.referencia);
  if (pago.clase === 'aprobado' && intento?.comprador_id && intento.plantilla) {
    const sb = supabaseAdmin();
    const { data: plantilla } = await sb
      .from('plantillas')
      .select('tema, precio_centavos, moneda')
      .eq('slug', intento.plantilla)
      .maybeSingle();

    await sb.from('pedidos').upsert(
      {
        ocasion: intento.ocasion || 'cumpleanos',
        slug: nuevoSlug(),
        tema: plantilla?.tema ?? 'correspondencia',
        estado: 'pendiente_datos',
        comprador_id: intento.comprador_id,
        comprador_email: intento.comprador_email ?? pago.emailPagador ?? null,
        precio_centavos: plantilla?.precio_centavos ?? null,
        moneda: plantilla?.moneda ?? 'PEN',
        mp_payment_id: pago.id,
        mp_status: pago.estado,
        pagado_en: new Date().toISOString(),
      },
      { onConflict: 'mp_payment_id' }
    );
  }

  return NextResponse.json({ ok: true });
}

export async function GET() {
  return NextResponse.json({ ok: true });
}
