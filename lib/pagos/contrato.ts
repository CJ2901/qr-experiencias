/**
 * La frontera. Todo lo que entra por HTTP pasa por aqui y sale tipado.
 *
 * Dos cosas que este archivo hace y ningun otro debe repetir:
 *  1. NO acepta el monto. El precio sale del catalogo, siempre. Si el
 *     monto viajara en el cuerpo, cualquiera compra con `curl` a S/ 1.
 *  2. Valida la ocasion contra la lista, no contra la base: descubrir
 *     que la ocasion no existe DESPUES de cobrar es el peor momento.
 *  3. Exige el correo DOS veces y que coincidan. Sin cuentas, el correo es
 *     la unica forma de devolverle el enlace al comprador: un typo aqui es
 *     un regalo pagado que nadie puede editar.
 */

import { errores } from './errores';
import { esOcasionValida, OCASION_POR_DEFECTO } from '@/lib/ocasiones';

/** `simulado` solo existe en prueba con PAGOS_SIMULADOS=1 (ver cobrar.ts). */
export type MetodoPago = 'tarjeta' | 'yape' | 'simulado';

export interface SolicitudPago {
  metodo: MetodoPago;
  plantilla: string;
  ocasion: string;
  /** Token de un solo uso. Ni el numero de tarjeta ni el OTP llegan aqui. */
  token: string;
  /** visa, master, yape... lo decide la pasarela, no nosotros. */
  metodoId: string;
  cuotas: number;
  emisorId?: string;
  emailPagador?: string;
  identificacion?: { type: string; number: string };
  /** El del comprador, ya validado y en minusculas. A el le llegan los correos. */
  email: string;
}

const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const SLUG = /^[a-z0-9-]{2,40}$/;

function texto(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined;
}

/**
 * Convierte el cuerpo crudo en una solicitud valida o lanza ErrorPago.
 * Nunca devuelve algo a medias: si vuelve, se puede cobrar.
 */
export function leerSolicitud(crudo: unknown): SolicitudPago {
  const b = (crudo ?? {}) as Record<string, unknown>;
  const recibidos = Object.keys(b);

  const metodo: MetodoPago =
    b.metodo === 'yape' ? 'yape' : b.metodo === 'simulado' ? 'simulado' : 'tarjeta';

  const email = texto(b.email)?.toLowerCase();
  const confirmacion = texto(b.email_confirmacion)?.toLowerCase();
  if (!email || !CORREO.test(email) || email !== confirmacion) {
    throw errores.correoInvalido();
  }

  const plantilla = texto(b.plantilla);
  const token = metodo === 'simulado' ? 'simulado' : texto(b.token);
  const metodoId =
    metodo === 'yape' ? 'yape' : metodo === 'simulado' ? 'simulado' : texto(b.payment_method_id);

  const faltan: string[] = [];
  if (!plantilla) faltan.push('plantilla');
  if (!token) faltan.push('token');
  if (!metodoId) faltan.push('payment_method_id');
  if (faltan.length) throw errores.entradaInvalida(faltan, recibidos);

  if (!SLUG.test(plantilla!)) {
    throw errores.entradaInvalida(['plantilla (formato)'], recibidos);
  }

  const pagador = (b.payer ?? {}) as Record<string, unknown>;
  const ident = (pagador.identification ?? {}) as Record<string, unknown>;
  const tipoDoc = texto(ident.type);
  const numDoc = texto(ident.number);

  // Yape es debito: cuotas siempre 1, lo mande el navegador o no.
  const cuotas = metodo === 'tarjeta' ? Math.max(1, Number(b.installments) || 1) : 1;

  return {
    metodo,
    plantilla: plantilla!,
    ocasion: esOcasionValida(b.ocasion) ? b.ocasion : OCASION_POR_DEFECTO,
    token: token!,
    metodoId: metodoId!,
    cuotas,
    emisorId: metodo === 'tarjeta' ? texto(b.issuer_id) : undefined,
    emailPagador: texto(pagador.email),
    identificacion: tipoDoc && numDoc ? { type: tipoDoc, number: numDoc } : undefined,
    email,
  };
}
