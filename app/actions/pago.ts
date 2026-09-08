'use server';

import { revalidatePath } from 'next/cache';
import { supabaseSesion, usuarioActual } from '@/lib/supabase-server';
import { consultar } from '@/lib/pagos/pasarela';
import { sincronizarPedido } from '@/lib/pagos/repositorio';
import { explicarPendiente, explicarRechazo } from '@/lib/pagos/mensajes';

/**
 * "Ya pague, revisa": le pregunta a Mercado Pago como quedo el pago y
 * pone el pedido al dia.
 *
 * Existe por dos razones:
 *  - en local no hay webhook posible (MP no puede llamar a localhost),
 *    asi que sin esto un pago pendiente nunca avanza;
 *  - en produccion es la red de seguridad: los webhooks se pierden,
 *    llegan tarde o los rechaza un despliegue a medias.
 *
 * La LECTURA va con la sesion del usuario (RLS comprueba que el pedido es
 * suyo). La ESCRITURA va con service_role, porque la politica de UPDATE
 * del cliente solo cubre 'pendiente_datos' y aqui venimos de
 * 'pendiente_pago'. Esa asimetria es intencional.
 */

export type RevisionDePago =
  | { ok: true; estado: string; mensaje: string; listoParaCompletar: boolean }
  | { ok: false; mensaje: string };

export async function revisarPago(pedidoId: string): Promise<RevisionDePago> {
  const usuario = await usuarioActual();
  if (!usuario) return { ok: false, mensaje: 'Se cerró tu sesión. Vuelve a entrar.' };

  const sb = await supabaseSesion();
  const { data: pedido } = await sb
    .from('pedidos')
    .select('id, estado, mp_payment_id')
    .eq('id', pedidoId)
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
    return {
      ok: false,
      mensaje: 'Este pedido no tiene un pago asociado. Escríbenos y lo revisamos.',
    };
  }

  const pago = await consultar(String(pedido.mp_payment_id));
  if (!pago) {
    return {
      ok: false,
      mensaje: 'No pudimos consultar el pago en Mercado Pago. Inténtalo en unos minutos.',
    };
  }

  const estado = await sincronizarPedido(pedidoId, pedido.estado, pago);
  revalidatePath('/mis-pedidos');

  if (pago.clase === 'aprobado') {
    return {
      ok: true,
      estado,
      mensaje: 'Pago confirmado. Ya puedes completar tu experiencia.',
      listoParaCompletar: true,
    };
  }

  return {
    ok: true,
    estado,
    mensaje:
      pago.clase === 'pendiente'
        ? explicarPendiente(pago.detalle)
        : explicarRechazo(pago.detalle).mensaje,
    listoParaCompletar: false,
  };
}
