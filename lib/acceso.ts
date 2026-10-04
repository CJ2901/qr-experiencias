import crypto from 'node:crypto';
import { requerir } from './entorno';

/**
 * El enlace del correo ES la llave. No hay cuentas.
 *
 *   /editar/<pedidoId>/<firma>     firma = HMAC-SHA256(EDICION_SECRETO, "editar:<id>")
 *
 * Por que una firma y no un token aleatorio guardado en la base:
 * es determinista. El cobro, el webhook y "reenviar mi enlace" producen
 * el MISMO enlace sin coordinarse ni guardar nada; un token aleatorio
 * obligaria a decidir quien lo genera cuando el navegador y el webhook
 * llegan a la vez, y el perdedor dejaria un enlace muerto en un correo.
 *
 * 32 caracteres base64url = 192 bits: no se adivina.
 * Rotar EDICION_SECRETO invalida TODOS los enlaces de edicion (no los del
 * regalo publicado, que van por /ocasion/slug).
 *
 * SOLO SERVIDOR: nunca importar desde un componente 'use client'.
 */

export interface Acceso {
  id: string;
  firma: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const LARGO = 32;

export function firmar(id: string): string {
  return crypto
    .createHmac('sha256', requerir('EDICION_SECRETO'))
    .update(`editar:${id}`)
    .digest('base64url')
    .slice(0, LARGO);
}

/** Comparacion en tiempo constante: no filtra cuantos caracteres acertaste. */
export function accesoValido(a: unknown): a is Acceso {
  const x = a as Partial<Acceso> | null;
  if (!x || typeof x.id !== 'string' || typeof x.firma !== 'string') return false;
  if (!UUID.test(x.id) || x.firma.length !== LARGO) return false;
  const esperado = Buffer.from(firmar(x.id));
  const dado = Buffer.from(x.firma);
  return esperado.length === dado.length && crypto.timingSafeEqual(esperado, dado);
}

export function rutaEdicion(id: string): string {
  return `/editar/${id}/${firmar(id)}`;
}
