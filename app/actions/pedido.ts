'use server';

import { revalidatePath } from 'next/cache';
import { supabaseSesion, usuarioActual } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * Acciones del cliente sobre SU pedido.
 *
 * Todas pasan por el cliente con sesion (no por la service_role): asi RLS
 * y el trigger de inmutabilidad son los que mandan. Si alguien cambia el
 * id en la URL, la base responde "0 filas", no hace falta comprobarlo aqui.
 */

export interface Borrador {
  destinatario?: string;
  frase_principal?: string;
  fecha_texto?: string;
  mensaje?: string;
  frase_capitulo?: string;
  frase_brindis?: string;
  frase_final?: string;
  fotos?: string[];
  foto_final?: string | null;
}

/** Guarda el avance. Se llama en cada paso: nada se pierde al cerrar. */
export async function guardarBorrador(pedidoId: string, campos: Borrador) {
  const sb = await supabaseSesion();
  const { error } = await sb.from('pedidos').update(campos).eq('id', pedidoId);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath(`/pedido/${pedidoId}/completar`);
  return { ok: true as const };
}

/** URL firmada para subir una foto directo a Storage. */
export async function urlDeSubida(pedidoId: string, nombre: string) {
  const usuario = await usuarioActual();
  if (!usuario) return { ok: false as const, error: 'Sesion expirada.' };

  const sb = await supabaseSesion();
  const { data: pedido } = await sb
    .from('pedidos')
    .select('id, estado')
    .eq('id', pedidoId)
    .maybeSingle();

  if (!pedido) return { ok: false as const, error: 'Pedido no encontrado.' };
  if (pedido.estado !== 'pendiente_datos') {
    return { ok: false as const, error: 'Este pedido ya no admite cambios.' };
  }

  const limpio = nombre.toLowerCase().replace(/[^a-z0-9.]+/g, '-').slice(-40);
  const ruta = `pedidos/${pedidoId}/${Date.now()}-${limpio}`;

  const { data, error } = await supabaseAdmin()
    .storage.from('media')
    .createSignedUploadUrl(ruta);

  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const, ruta, token: data.token, signedUrl: data.signedUrl };
}

/**
 * El punto sin retorno. Publica y cierra la edicion para el cliente:
 * la politica de UPDATE deja de aplicar en cuanto el estado es 'listo'.
 */
export async function publicarPedido(pedidoId: string) {
  const sb = await supabaseSesion();

  const { data: pedido } = await sb
    .from('pedidos')
    .select('destinatario, frase_principal, mensaje, fotos, estado')
    .eq('id', pedidoId)
    .maybeSingle();

  if (!pedido) return { ok: false as const, error: 'Pedido no encontrado.' };
  if (pedido.estado !== 'pendiente_datos') {
    return { ok: false as const, error: 'Este pedido ya fue publicado.' };
  }

  const faltan: string[] = [];
  if (!pedido.destinatario?.trim()) faltan.push('el nombre de quien lo recibe');
  if (!pedido.frase_principal?.trim()) faltan.push('la frase de portada');
  if (!pedido.mensaje?.trim()) faltan.push('el mensaje de la carta');
  if (!Array.isArray(pedido.fotos) || pedido.fotos.length === 0) faltan.push('al menos una foto');
  if (faltan.length) {
    return { ok: false as const, error: `Todavía falta ${faltan.join(', ')}.` };
  }

  const { error } = await sb
    .from('pedidos')
    .update({ estado: 'listo', completado_en: new Date().toISOString() })
    .eq('id', pedidoId);

  if (error) return { ok: false as const, error: error.message };

  revalidatePath('/mis-pedidos');
  return { ok: true as const };
}
