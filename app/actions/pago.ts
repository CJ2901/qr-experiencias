'use server';

import { supabaseAdmin } from '@/lib/supabase';
import { accesoValido, type Acceso } from '@/lib/acceso';
import { consultar } from '@/lib/pagos/pasarela';
import { sincronizarPedido } from '@/lib/pagos/repositorio';
import { explicarPendiente, explicarRechazo } from '@/lib/pagos/mensajes';
import { avisarEnlace } from '@/lib/notificaciones';

/**
 * "Ya pague, revisar": le pregunta a Mercado Pago como quedo el pago y
 * pone el pedido al dia.
 *
 * Existe por dos razones:
 *  - en local no hay webhook posible (MP no puede llamar a localhost),
 *    asi que sin esto un pago pendiente nunca avanza;
 *  - en produccion es la red de seguridad: los webhooks se pierden,
 *    llegan tarde o los rechaza un despliegue a medias.
 *
 * Sin cuentas, la autorizacion es el enlace firmado: sin firma valida,
 * el pedido "no existe".
 */

export type RevisionDePago =
  | { ok: true; estado: string; mensaje: string; listoParaCompletar: boolean }
  | { ok: false; mensaje: string };

export async function revisarPago(acceso: Acceso): Promise<RevisionDePago> {
  if (!accesoValido(acceso)) return { ok: false, mensaje: 'Este enlace no es válido.' };

  const { data: pedido } = await supabaseAdmin()
    .from('pedidos')
    .select('id, estado, mp_payment_id')
    .eq('id', acceso.id)
    .maybeSingle();

  if (!pedido) return { ok: false, mensaje: 'No encontramos ese pedido.' };

  if (pedido.estado !== 'pendiente_pago') {
    return {
      ok: true,
      estado: pedido.estado,
      mensaje: 'Este pedido ya no está esperando el pago.',
      listoParaCompletar: pedido.estado === 'pendiente_datos',
    };
  }

  if (!pedido.mp_payment_id) {
    return { ok: false, mensaje: 'Este pedido no tiene un pago asociado. Escríbenos y lo revisamos.' };
  }

  const pago = await consultar(String(pedido.mp_payment_id));
  if (!pago) {
    return { ok: false, mensaje: 'No pudimos consultar el pago en Mercado Pago. Inténtalo en unos minutos.' };
  }

  const estado = await sincronizarPedido(pedido.id, pedido.estado, pago);

  if (pago.clase === 'aprobado') {
    await avisarEnlace(pedido.id);
    return { ok: true, estado, mensaje: 'Pago confirmado. Ya puedes escribir tu dedicatoria.', listoParaCompletar: true };
  }

  return {
    ok: true,
    estado,
    mensaje: pago.clase === 'pendiente' ? explicarPendiente(pago.detalle) : explicarRechazo(pago.detalle).mensaje,
    listoParaCompletar: false,
  };
}
