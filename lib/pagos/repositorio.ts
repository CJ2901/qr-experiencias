/**
 * Todo lo que toca Postgres para un pago. Nadie mas escribe en `pedidos`
 * ni en `intentos_pago` durante el cobro.
 *
 * REGLA DE ORO DE LA BITACORA
 * Registrar un intento NUNCA puede tumbar una venta. Si `intentos_pago`
 * no existe todavia (migracion 004 sin correr) o Supabase esta lento, se
 * avisa por consola y se sigue. La bitacora es para nosotros; el cobro es
 * para el cliente.
 */

import { supabaseAdmin } from '@/lib/supabase';
import { nuevoSlug } from '@/lib/slug';
import { errores } from './errores';
import type { PagoRealizado } from './pasarela';
import type { MetodoPago } from './contrato';

export interface AperturaDeIntento {
  compradorEmail: string;
  plantilla: string;
  ocasion: string;
  metodo: MetodoPago;
  montoCentavos: number;
}

export interface CierreDeIntento {
  resultado: 'aprobado' | 'pendiente' | 'rechazado' | 'error';
  paso?: string;
  codigo?: string;
  detalle?: Record<string, unknown>;
  pago?: PagoRealizado | null;
  pedidoId?: string | null;
}

/** Devuelve el id del intento, o '' si la bitacora no esta disponible. */
export async function abrirIntento(d: AperturaDeIntento): Promise<string> {
  const { data, error } = await supabaseAdmin()
    .from('intentos_pago')
    .insert({
      comprador_email: d.compradorEmail,
      plantilla: d.plantilla,
      ocasion: d.ocasion,
      metodo: d.metodo,
      monto_centavos: d.montoCentavos,
      resultado: 'iniciado',
    })
    .select('id')
    .single();

  if (error) {
    console.warn('[pagos] no se pudo abrir el intento:', error.code, error.message);
    return '';
  }
  return String(data.id);
}

export async function cerrarIntento(id: string, c: CierreDeIntento): Promise<void> {
  if (!id) return;
  const { error } = await supabaseAdmin()
    .from('intentos_pago')
    .update({
      resultado: c.resultado,
      paso: c.paso ?? null,
      codigo: c.codigo ?? null,
      detalle: c.detalle ?? {},
      mp_payment_id: c.pago?.id ?? null,
      mp_status: c.pago?.estado ?? null,
      mp_status_detail: c.pago?.detalle ?? null,
      pedido_id: c.pedidoId ?? null,
    })
    .eq('id', id);

  if (error) console.warn('[pagos] no se pudo cerrar el intento:', error.code, error.message);
}

export interface DatosDelPedido {
  ocasion: string;
  tema: string;
  compradorEmail: string;
  precioCentavos: number;
  moneda: string;
}

/**
 * Crea el pedido con el correo del comprador. El `onConflict` sobre
 * mp_payment_id es lo que hace idempotente el reintento del brick y del
 * webhook: dos llegadas del mismo pago = un solo pedido.
 *
 * Lanza ErrorPago si falla: aqui el dinero YA se movio y callarlo seria
 * dejar a alguien pagado y sin pagina.
 */
export async function registrarPedidoPagado(
  pago: PagoRealizado,
  d: DatosDelPedido,
  referencia: string
): Promise<{ id: string; estado: string }> {
  const aprobado = pago.clase === 'aprobado';

  const { data, error } = await supabaseAdmin()
    .from('pedidos')
    .upsert(
      {
        ocasion: d.ocasion,
        slug: nuevoSlug(),
        tema: d.tema,
        estado: aprobado ? 'pendiente_datos' : 'pendiente_pago',
        comprador_email: d.compradorEmail,
        precio_centavos: d.precioCentavos,
        moneda: d.moneda,
        mp_payment_id: pago.id,
        mp_status: pago.estado,
        pagado_en: aprobado ? new Date().toISOString() : null,
      },
      { onConflict: 'mp_payment_id' }
    )
    .select('id, estado')
    .single();

  if (error || !data) {
    console.error('[pagos] PAGO COBRADO SIN PEDIDO', {
      referencia,
      pago: pago.id,
      codigo: error?.code,
      mensaje: error?.message,
      detalle: error?.details,
    });
    throw errores.pedidoNoRegistrado(referencia, {
      mp_payment_id: pago.id,
      codigo: error?.code,
      mensaje: error?.message,
      pista: error?.details,
    });
  }

  return { id: String(data.id), estado: String(data.estado) };
}

/**
 * Lee un intento por su id. Lo usa el webhook: como la Orders API no
 * tiene `metadata`, el id del intento viaja en `external_reference` y de
 * aqui salen el comprador, la plantilla y la ocasion para reconstruir un
 * pedido que el navegador no alcanzo a crear.
 */
export async function buscarIntento(id: string) {
  if (!id) return null;
  const { data } = await supabaseAdmin()
    .from('intentos_pago')
    .select('comprador_email, plantilla, ocasion')
    .eq('id', id)
    .maybeSingle();
  return data as {
    comprador_email: string | null;
    plantilla: string | null;
    ocasion: string | null;
  } | null;
}

export async function buscarPedidoPorPago(mpPaymentId: string) {
  const { data } = await supabaseAdmin()
    .from('pedidos')
    .select('id, estado')
    .eq('mp_payment_id', mpPaymentId)
    .maybeSingle();
  return data as { id: string; estado: string } | null;
}

/**
 * Pone el pedido al dia con lo que dice Mercado Pago.
 * Nunca degrada un pedido que el cliente ya publico.
 */
export async function sincronizarPedido(
  pedidoId: string,
  estadoActual: string,
  pago: PagoRealizado
): Promise<string> {
  if (estadoActual === 'listo' || estadoActual === 'archivado') return estadoActual;

  const aprobado = pago.clase === 'aprobado';
  const nuevo = aprobado ? 'pendiente_datos' : estadoActual;

  const { error } = await supabaseAdmin()
    .from('pedidos')
    .update({
      mp_status: pago.estado,
      estado: nuevo,
      pagado_en: aprobado ? new Date().toISOString() : null,
    })
    .eq('id', pedidoId);

  if (error) {
    console.error('[pagos] no se pudo sincronizar el pedido', pedidoId, error.message);
    return estadoActual;
  }
  return nuevo;
}
