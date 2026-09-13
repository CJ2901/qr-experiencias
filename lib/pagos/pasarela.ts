/**
 * Mercado Pago, y solo Mercado Pago.
 *
 * Este archivo es la unica parte del proyecto que sabe como se llaman los
 * campos de la API de MP. Si manana cambiamos de pasarela, se reescribe
 * este archivo y nada mas: el caso de uso habla de `OrdenDeCobro` y
 * `PagoRealizado`, no de `transaction_amount` ni de `status_detail`.
 *
 * POR QUE ORDERS Y NO /v1/payments  (set. 2026)
 * En el sandbox de Peru —credenciales APP_USR- de un usuario de prueba,
 * que es el unico sandbox que MP soporta— el endpoint viejo no tiene
 * NINGUNA combinacion que funcione. Medido, las cuatro:
 *
 *   token sin cabecera + pago sin X-Test-Token .... 401 code 7
 *   token sin cabecera + pago CON X-Test-Token .... 400 code 2006
 *   token CON cabecera + pago CON X-Test-Token .... 500 internal_error
 *   token CON cabecera + pago sin cabecera ........ 401 code 7
 *
 * POST /v1/orders con el mismo token cobra `processed / accredited`, con
 * y sin la cabecera. Ver scripts/probar-orden-token.mjs, que deja la
 * matriz completa por escrito.
 *
 * DOS COSAS QUE LA ORDERS API NO TIENE, Y COMO SE RESUELVEN AQUI
 *  - `metadata`: no existe. Lo que antes viajaba ahi (usuario, plantilla,
 *    ocasion) ya vive en `intentos_pago`, asi que se manda solo el id del
 *    intento en `external_reference` y el webhook lo usa para reconstruir.
 *  - `issuer_id`: tampoco. MP lo deduce del token, que es lo que hacia de
 *    todas formas cuando el Brick no lo mandaba.
 */

import { MercadoPagoConfig, Order } from 'mercadopago';
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
 *
 * Y UNO NUEVO POR LLAMADA, NO UN SINGLETON. El SDK v3 hace esto en
 * Order.create:
 *
 *   this.config.options = { ...this.config.options, ...requestOptions }
 *
 * o sea, MUTA la config compartida. Con una instancia de modulo, la clave
 * de idempotencia de un comprador se quedaba pegada y el siguiente cobro
 * la heredaba: dos personas distintas, la misma clave, y MP devolviendo el
 * pago del primero. Construirlo por llamada cuesta un objeto y cierra eso.
 */
function config(): MercadoPagoConfig {
  const token = process.env.MP_ACCESS_TOKEN;
  if (!token) throw errores.sinConfigurar('MP_ACCESS_TOKEN');
  return new MercadoPagoConfig({ accessToken: token });
}

export interface OrdenDeCobro {
  /** En soles, con decimales. Sale del catalogo, nunca del navegador. */
  monto: number;
  descripcion: string;
  token: string;
  metodoId: string;
  cuotas: number;
  emailPagador: string;
  identificacion?: { type: string; number: string };
  /** Id del intento. Viaja como external_reference y vuelve en el webhook. */
  referencia: string;
  /** MP no cobra dos veces la misma clave: protege contra el doble clic. */
  claveIdempotencia: string;
}

export interface PagoRealizado {
  /** Id de la ORDEN (ORD…). Es lo que se guarda en pedidos.mp_payment_id. */
  id: string;
  estado: string;
  detalle: string;
  clase: ClaseDeEstado;
  metodoId?: string;
  emailPagador?: string;
  /** external_reference: el id del intento que abrio este cobro. */
  referencia: string;
}

interface OrdenCruda {
  id?: string;
  status?: string | null;
  status_detail?: string | null;
  external_reference?: string | null;
  payer?: { email?: string | null } | null;
  transactions?: {
    payments?: Array<{
      status?: string | null;
      status_detail?: string | null;
      payment_method?: { id?: string | null } | null;
    }> | null;
  } | null;
}

/**
 * El estado de la orden y el del pago de adentro no siempre coinciden: la
 * orden puede quedar `processed` con el pago `pending`. Manda el del pago
 * cuando existe, porque es el que trae el status_detail que el comprador
 * necesita leer (`cc_rejected_*`, `pending_*`).
 */
function normalizar(o: OrdenCruda): PagoRealizado {
  const pago = o.transactions?.payments?.[0];
  const estado = pago?.status ?? o.status ?? 'unknown';
  return {
    id: String(o.id ?? ''),
    estado,
    detalle: pago?.status_detail ?? o.status_detail ?? '',
    clase: clasificar(estado),
    metodoId: pago?.payment_method?.id ?? undefined,
    emailPagador: o.payer?.email ?? undefined,
    referencia: o.external_reference ?? '',
  };
}

/**
 * La Orders API pide el TIPO del medio, que el Brick no manda: solo da el
 * `payment_method_id` ("visa", "debmaster", "yape"). Se deduce del prefijo.
 * Equivocarse aqui es un 400 con causa clara, no un cobro mal hecho.
 */
function tipoDeMedio(metodoId: string): string {
  if (metodoId === 'yape') return 'bank_transfer';
  if (metodoId.startsWith('deb')) return 'debit_card';
  if (metodoId.startsWith('pagoefectivo')) return 'ticket';
  return 'credit_card';
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
    // El SDK v3 aplana el `cause` de la API en `causes`. Leer solo `cause`
    // hacia que el codigo numerico de MP (4390 = payer email forbidden, y
    // cualquier otro) se perdiera SIEMPRE: quedaba `http_403` a secas en
    // intentos_pago, que es justo el dato que no sirve para diagnosticar.
    cause?: unknown;
    causes?: unknown;
    errors?: unknown[];
    apiResponse?: { status?: number; data?: unknown };
  };

  // La Orders API no usa `cause`: devuelve `errors: [{code, message,
  // details}]`. Sin esto, un "invalid_card_token" se registraba como
  // http_402 pelado y no habia forma de saber que habia pasado.
  const lista = Array.isArray(err?.causes)
    ? err.causes
    : Array.isArray(err?.cause)
      ? err.cause
      : Array.isArray(err?.errors)
        ? err.errors.map((x) => {
            const o = x as Record<string, unknown>;
            const det = Array.isArray(o.details) ? o.details.join(', ') : undefined;
            return { code: o.code, description: det ?? o.message };
          })
        : [];
  const causa = (lista[0] as Record<string, unknown> | undefined) ?? null;
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
  // La Orders API quiere los importes como TEXTO con dos decimales, y el
  // total tiene que ser exactamente la suma de los pagos. Mandarlos
  // numericos es un 400 "invalid_parameter".
  const importe = orden.monto.toFixed(2);

  try {
    const creada = await new Order(config()).create({
      body: {
        type: 'online',
        processing_mode: 'automatic',
        total_amount: importe,
        description: orden.descripcion,
        external_reference: orden.referencia,
        payer: {
          email: orden.emailPagador,
          ...(orden.identificacion ? { identification: orden.identificacion } : {}),
        },
        transactions: {
          payments: [
            {
              amount: importe,
              payment_method: {
                id: orden.metodoId,
                type: tipoDeMedio(orden.metodoId),
                token: orden.token,
                installments: orden.cuotas,
              },
            },
          ],
        },
      },
      requestOptions: {
        idempotencyKey: orden.claveIdempotencia,
        // El SDK reintenta los 5xx tres veces con 60 s de timeout cada una:
        // con MP fallando, el comprador se queda cuatro minutos mirando el
        // boton. Un reintento basta para un 500 transitorio; si es
        // persistente, mas intentos no lo arreglan y si arruinan el
        // checkout. La clave de idempotencia impide cobrar dos veces.
        maxRetries: 1,
        timeout: 20_000,
      } as never,
    });
    return normalizar(creada as OrdenCruda);
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

/** Consulta el estado real. Devuelve null si MP no sabe de esa orden. */
export async function consultar(id: string): Promise<PagoRealizado | null> {
  try {
    const orden = await new Order(config()).get({ id });
    return normalizar(orden as OrdenCruda);
  } catch (e) {
    if (e instanceof ErrorPago) throw e;
    return null;
  }
}
