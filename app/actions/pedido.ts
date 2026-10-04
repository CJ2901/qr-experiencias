'use server';

import { supabaseAdmin } from '@/lib/supabase';
import { accesoValido, type Acceso } from '@/lib/acceso';
import { avisarPublicado } from '@/lib/notificaciones';
import { aHtmlSeguro } from '@/lib/texto';

/**
 * Acciones del comprador sobre SU pedido, sin cuenta.
 *
 * La autorizacion es el enlace firmado (lib/acceso.ts): sin firma valida
 * nada se lee ni se escribe. Como ya no hay RLS por usuario, todo va con
 * la service_role y por eso cada accion comprueba aqui tres cosas que
 * antes hacia la base:
 *   1. la firma;
 *   2. que el pedido siga en 'pendiente_datos' (el filtro va en el UPDATE,
 *      no en un SELECT previo: asi no hay carrera con "publicar");
 *   3. que solo se escriban los campos de la carta, nunca precio, pago,
 *      correo ni estado. Una server action recibe lo que el navegador
 *      quiera mandar, no lo que el formulario dice que manda.
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

type Resultado = { ok: true } | { ok: false; error: string };

const LIMITES: Record<string, number> = {
  destinatario: 60,
  frase_principal: 160,
  fecha_texto: 60,
  mensaje: 4000,
  frase_capitulo: 200,
  frase_brindis: 200,
  frase_final: 200,
};

const NO_AUTORIZADO = { ok: false as const, error: 'Este enlace no es válido.' };
const CERRADO = { ok: false as const, error: 'Este regalo ya fue publicado y no admite cambios.' };

/**
 * Las frases se pintan con innerHTML en la pagina del regalo (para permitir
 * <br>). Sin escaparlas, un comprador podria guardar `<img onerror=...>` y
 * ese codigo correria en el navegador de quien abra el regalo — o del admin.
 */
const CON_HTML = new Set(['frase_principal', 'frase_capitulo', 'frase_brindis', 'frase_final']);

/** Ruta de la foto dentro de la carpeta de ESTE pedido (y nada de "..") */
const esPropia = (id: string, r: unknown): r is string =>
  typeof r === 'string' && r.startsWith(`pedidos/${id}/`) && !r.includes('..');

/**
 * Convencion de nombres para no perder el original al recortar:
 *   pedidos/<id>/1696…-foto.jpg              original (reducido, sin EXIF)
 *   pedidos/<id>/1696…-foto.jpg__r1697….jpg  recorte de ese original
 * OJO: Supabase Storage rechaza con 400 ("Invalid key") nombres con
 * caracteres como "~". El separador es "__r": los originales nunca llevan
 * "_" porque su nombre pasa por el limpiador de abajo.
 *
 * Al volver a ajustar se parte SIEMPRE del original, no del recorte: asi
 * se puede alejar el zoom otra vez sin perder calidad.
 */
const original = (ruta: string) => ruta.split('__r')[0];

/** Lista blanca + limites. Las rutas de fotos solo pueden ser de ESTE pedido. */
function limpiar(id: string, c: Borrador): Record<string, unknown> {
  const fila: Record<string, unknown> = {};
  for (const [k, max] of Object.entries(LIMITES)) {
    const v = (c as Record<string, unknown>)[k];
    if (typeof v === 'string') fila[k] = CON_HTML.has(k) ? aHtmlSeguro(v.slice(0, max)) : v.slice(0, max);
  }
  const propia = (r: unknown): r is string => esPropia(id, r);
  if (Array.isArray(c.fotos)) fila.fotos = c.fotos.filter(propia).slice(0, 12);
  if (c.foto_final === null || propia(c.foto_final)) fila.foto_final = c.foto_final;
  return fila;
}

/** Guarda el avance. Se llama en cada paso: nada se pierde al cerrar. */
export async function guardarBorrador(acceso: Acceso, campos: Borrador): Promise<Resultado> {
  if (!accesoValido(acceso)) return NO_AUTORIZADO;
  const fila = limpiar(acceso.id, campos);
  if (!Object.keys(fila).length) return { ok: true };

  const { data, error } = await supabaseAdmin()
    .from('pedidos')
    .update(fila)
    .eq('id', acceso.id)
    .eq('estado', 'pendiente_datos')
    .select('id');

  if (error) return { ok: false, error: 'No se pudo guardar. Inténtalo de nuevo.' };
  if (!data?.length) return CERRADO;
  return { ok: true };
}

/**
 * URL firmada para subir una foto directo a Storage (no pasa por Vercel).
 * Con `recorteDe`, la ruta queda ligada a ese original (ver `original`).
 */
export async function urlDeSubida(acceso: Acceso, nombre: string, recorteDe?: string) {
  if (!accesoValido(acceso)) return NO_AUTORIZADO;

  const sb = supabaseAdmin();
  const { data: pedido } = await sb
    .from('pedidos')
    .select('estado')
    .eq('id', acceso.id)
    .maybeSingle();
  if (!pedido) return NO_AUTORIZADO;
  if (pedido.estado !== 'pendiente_datos') return CERRADO;

  let ruta: string;
  if (recorteDe !== undefined) {
    if (!esPropia(acceso.id, recorteDe)) return NO_AUTORIZADO;
    ruta = `${original(recorteDe)}__r${Date.now()}.jpg`;
  } else {
    const limpio = String(nombre).toLowerCase().replace(/[^a-z0-9.]+/g, '-').slice(-40);
    ruta = `pedidos/${acceso.id}/${Date.now()}-${limpio}`;
  }

  const { data, error } = await sb.storage.from('media').createSignedUploadUrl(ruta);
  if (error) return { ok: false as const, error: 'No se pudo preparar la subida.' };
  return { ok: true as const, ruta, token: data.token, signedUrl: data.signedUrl };
}

/**
 * URL firmada (10 min) del ORIGINAL de una foto, para volver a encuadrarla.
 * El bucket es privado: sin esto el navegador no puede leerla.
 */
export async function urlDelOriginal(acceso: Acceso, ruta: string) {
  if (!accesoValido(acceso) || !esPropia(acceso.id, ruta)) return NO_AUTORIZADO;
  const { data, error } = await supabaseAdmin()
    .storage.from('media')
    .createSignedUrl(original(ruta), 600);
  if (error || !data) return { ok: false as const, error: 'No se pudo abrir la foto original.' };
  return { ok: true as const, url: data.signedUrl };
}

/**
 * El punto sin retorno. Publica, cierra la edicion y dispara el correo 2
 * (QR + enlace del regalo).
 */
export async function publicarPedido(acceso: Acceso): Promise<Resultado> {
  if (!accesoValido(acceso)) return NO_AUTORIZADO;

  const sb = supabaseAdmin();
  const { data: pedido } = await sb
    .from('pedidos')
    .select('destinatario, frase_principal, mensaje, fotos, estado')
    .eq('id', acceso.id)
    .maybeSingle();

  if (!pedido) return NO_AUTORIZADO;
  if (pedido.estado !== 'pendiente_datos') return CERRADO;

  const faltan: string[] = [];
  if (!pedido.destinatario?.trim()) faltan.push('el nombre de quien lo recibe');
  if (!pedido.frase_principal?.trim()) faltan.push('la frase de portada');
  if (!pedido.mensaje?.trim()) faltan.push('el mensaje de la carta');
  if (!Array.isArray(pedido.fotos) || pedido.fotos.length === 0) faltan.push('al menos una foto');
  if (faltan.length) return { ok: false, error: `Todavía falta ${faltan.join(', ')}.` };

  const { data, error } = await sb
    .from('pedidos')
    .update({ estado: 'listo', completado_en: new Date().toISOString() })
    .eq('id', acceso.id)
    .eq('estado', 'pendiente_datos')
    .select('id');

  if (error) return { ok: false, error: 'No se pudo publicar. Inténtalo de nuevo.' };
  if (!data?.length) return CERRADO;

  await avisarPublicado(acceso.id);
  return { ok: true };
}
