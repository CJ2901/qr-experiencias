/**
 * Mercado Pago, y solo Mercado Pago.
 *
 * Este archivo es la unica parte del proyecto que sabe como se llaman los
 * campos de la API de MP. Si manana cambiamos de pasarela, se reescribe
 * este archivo y nada mas: el caso de uso habla de `OrdenDeCobro` y
 * `PagoRealizado`, no de `transaction_amount` ni de `status_detail`.
 */

import { MercadoPagoConfig, Payment } from 'mercadopago';
import { errores, ErrorPago } from './errores';
import { clasificar, type ClaseDeEstado } from './mensajes';

// El ambiente (prueba vs produccion) y quien figura como pagador siguen
// viviendo en lib/mp.ts: es lo que tambien consulta la pagina de checkout.
export { MP_ES_PRUEBA, emailPagador } from '@/lib/mp';

/**
 * Perezoso a proposito. Construirlo al importar el modulo hace que, si
 * falta MP_ACCESS_TOKEN, Next devuelva un 500 en HTML sin cuerpo JSON:
 * el navegador falla al parsearlo y el comprador ve "se corto la conexion"
 * cuando el problema real era una variable de entorno.
 */
let cliente: MercadoPagoConfig | null = null;
function config(): MercadoPagoConfig {
  const token = process.env.MP_ACCESS_TOKEN;
  if (!token) throw errores.sinConfigurar('MP_ACCESS_TOKEN');
  if (!cliente) cliente = new MercadoPagoConfig({ accessToken: token });
  return cliente;
}

export interface OrdenDeCobro {
  /** En soles, con decimales. Sale del catalogo, nunca del navegador. */
  monto: number;
  descripcion: string;
  token: string;
  metodoId: string;
  cuotas: number;
  /** Llega como texto desde el Brick; la API lo quiere numerico. */
  emisorId?: string;
  emailPagador: string;
  identificacion?: { type: string; number: string };
  metadata: Record<string, string>;
  /** MP no cobra dos veces la misma clave: protege contra el doble clic. */
  claveIdempotencia: string;
}

export interface PagoRealizado {
  id: string;
  estado: string;
  detalle: string;
  clase: ClaseDeEstado;
  metodoId?: string;
  emailPagador?: string;
  metadata: Record<string, string>;
}

interface FilaCruda {
  id?: number | string;
  status?: string | null;
  status_detail?: string | null;
  payment_method_id?: string | null;
  payer?: { email?: string | null } | null;
  metadata?: Record<string, unknown> | null;
}

function normalizar(p: FilaCruda): PagoRealizado {
  return {
    id: String(p.id ?? ''),
    estado: p.status ?? 'unknown',
    detalle: p.status_detail ?? '',
    clase: clasificar(p.status),
    metodoId: p.payment_method_id ?? undefined,
    emailPagador: p.payer?.email ?? undefined,
    metadata: Object.fromEntries(
      Object.entries(p.metadata ?? {}).map(([k, v]) => [k, String(v ?? '')])
    ),
  };
}

/**
 * El SDK lanza objetos con forma variable segun donde reviente. Aplanarlo
 * aqui es lo que permite guardar un codigo util en `intentos_pago` en vez
 * de un "Internal error" que no dice nada.
 */
function aplanarError(e: unknown): {
  codigo: string;
  descripcion: string;
  codigoMp?: string;
  http?: number;
} {
  const err = e as {
    message?: string;
    status?: number;
    error?: string;
    cause?: unknown;
    apiResponse?: { status?: number; data?: unknown };
  };

  const causa = Array.isArray(err?.cause) ? (err.cause[0] as Record<string, unknown>) : null;
  const codigo =
    (causa?.code !== undefined && String(causa.code)) ||
    err?.error ||
    (err?.status ? `http_${err.status}` : '') ||
    'error_desconocido';

  const descripcion =
    (typeof causa?.description === 'string' && causa.description) ||
    err?.message ||
    'Mercado Pago no dio detalle.';

  // El code numerico de MP (p. ej. 4390 = payer email forbidden) es lo que
  // se puede buscar en su documentacion; el texto cambia, el numero no.
  const codigoMp = causa?.code !== undefined ? String(causa.code) : undefined;
  return { codigo, descripcion, codigoMp, http: err?.status ?? err?.apiResponse?.status };
}

/** Traduce el fallo de infraestructura a algo accionable para el comprador. */
function publicoDe(codigo: string, http?: number, descripcion = ''): string {
  // 403 con "payer email forbidden" NO es autenticacion: es que ese correo
  // no puede pagarle a esta cuenta (normalmente, es la cuenta misma).
  if (http === 403 && /payer.*email/i.test(descripcion)) {
    return 'Ese correo no puede pagar en esta tienda. Escríbenos: no se te cobró nada.';
  }
  if (http === 401 || http === 403) {
    return 'La tienda no pudo autenticarse con Mercado Pago. Escríbenos: no se te cobró nada.';
  }
  if (http === 400) {
    return 'Mercado Pago rechazó los datos del pago. Revisa la tarjeta o prueba con otro medio.';
  }
  if (codigo.includes('timeout') || codigo.includes('ETIMEDOUT') || codigo.includes('fetch')) {
    return 'Mercado Pago no respondió a tiempo. Revisa «Mis pedidos» antes de volver a intentar.';
  }
  return 'Mercado Pago no pudo procesar el pago en este momento. Inténtalo en unos minutos; no se te cobró nada.';
}

export async function cobrar(orden: OrdenDeCobro): Promise<PagoRealizado> {
  try {
    const pago = await new Payment(config()).create({
      body: {
        transaction_amount: orden.monto,
        token: orden.token,
        description: orden.descripcion,
        installments: orden.cuotas,
        payment_method_id: orden.metodoId,
        // El Brick manda el emisor como texto y el SDK lo tipa numerico.
        // Si no es un numero, se omite: mandarlo mal es un 400 seguro.
        ...(Number.isFinite(Number(orden.emisorId)) && orden.emisorId
          ? { issuer_id: Number(orden.emisorId) }
          : {}),
        payer: {
          email: orden.emailPagador,
          ...(orden.identificacion ? { identification: orden.identificacion } : {}),
        },
        metadata: orden.metadata,
      },
      requestOptions: { idempotencyKey: orden.claveIdempotencia },
    });
    return normalizar(pago as FilaCruda);
  } catch (e) {
    if (e instanceof ErrorPago) throw e;
    const { codigo, descripcion, codigoMp, http } = aplanarError(e);
    throw errores.pasarela(codigo, publicoDe(codigo, http, descripcion), {
      descripcion,
      http,
      ...(codigoMp ? { code_mp: codigoMp } : {}),
    });
  }
}

/** Consulta el estado real. Devuelve null si MP no sabe de ese pago. */
export async function consultar(id: string): Promise<PagoRealizado | null> {
  try {
    const pago = await new Payment(config()).get({ id });
    return normalizar(pago as FilaCruda);
  } catch (e) {
    if (e instanceof ErrorPago) throw e;
    return null;
  }
}
