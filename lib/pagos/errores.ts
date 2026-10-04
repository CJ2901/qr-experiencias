/**
 * Un unico tipo de error para todo el cobro.
 *
 * POR QUE EXISTE
 * Un `catch` que devuelve 500 con "algo salio mal" cuesta horas de
 * depuracion y deja al comprador sin saber si le cobraron. Aqui cada
 * fallo lleva tres cosas, separadas a proposito:
 *
 *   publico  → lo que ve el comprador. Nunca revela nada interno.
 *   codigo   → lo que buscas en la tabla intentos_pago y en el log.
 *   detalle  → la causa cruda de Mercado Pago o de Postgres. Solo servidor.
 *
 * Un pago RECHAZADO no es un error de este tipo: es un resultado valido
 * del negocio y viaja como dato, no como excepcion. Ver lib/pagos/cobrar.ts.
 */

/** En que capa murio. Es la primera pregunta al leer un intento fallido. */
export type PasoPago =
  | 'configuracion'
  | 'sesion'
  | 'entrada'
  | 'catalogo'
  | 'pasarela'
  | 'base_de_datos';

interface Args {
  paso: PasoPago;
  codigo: string;
  publico: string;
  http: number;
  detalle?: Record<string, unknown>;
}

export class ErrorPago extends Error {
  readonly paso: PasoPago;
  readonly codigo: string;
  readonly publico: string;
  readonly http: number;
  readonly detalle: Record<string, unknown>;

  constructor({ paso, codigo, publico, http, detalle = {} }: Args) {
    super(`[${paso}/${codigo}] ${publico}`);
    this.name = 'ErrorPago';
    this.paso = paso;
    this.codigo = codigo;
    this.publico = publico;
    this.http = http;
    this.detalle = detalle;
  }

  /**
   * Lo unico que puede cruzar al navegador.
   * `referencia` es el id del intento: es lo que el comprador nos dicta
   * por WhatsApp y lo que nosotros buscamos en la base.
   */
  cuerpo(referencia?: string | null) {
    const ref =
      referencia ??
      (typeof this.detalle.referencia === 'string' ? this.detalle.referencia : null);
    return {
      ok: false as const,
      error: this.publico,
      mensaje: this.publico,
      codigo: this.codigo,
      paso: this.paso,
      referencia: ref,
      // La causa cruda solo en desarrollo: en produccion filtraria
      // nombres de columnas y mensajes de Mercado Pago al navegador.
      causa:
        process.env.NODE_ENV === 'development'
          ? JSON.stringify(this.detalle).slice(0, 400)
          : undefined,
    };
  }
}

export function esErrorPago(e: unknown): e is ErrorPago {
  return e instanceof ErrorPago;
}

/**
 * Fabricas. Existen para que ningun `throw` en el resto del codigo tenga
 * que acordarse del codigo HTTP ni redactar el mensaje al comprador.
 */
export const errores = {
  sinConfigurar(variable: string) {
    return new ErrorPago({
      paso: 'configuracion',
      codigo: 'falta_variable',
      publico: 'La tienda no está lista para cobrar. Escríbenos, ya lo estamos viendo.',
      http: 503,
      detalle: { variable },
    });
  },

  sinSesion() {
    return new ErrorPago({
      paso: 'sesion',
      codigo: 'sin_sesion',
      publico: 'Se cerró tu sesión. Vuelve a entrar y reintenta: no se cobró nada.',
      http: 401,
    });
  },

  entradaInvalida(faltan: string[], recibidos: string[]) {
    return new ErrorPago({
      paso: 'entrada',
      codigo: 'campos_faltantes',
      publico:
        'El formulario de pago no envió todos los datos. Recarga la página e intenta de nuevo.',
      http: 400,
      detalle: { faltan, recibidos },
    });
  },

  correoInvalido() {
    return new ErrorPago({
      paso: 'entrada',
      codigo: 'correo_invalido',
      publico: 'Revisa tu correo: tiene que estar bien escrito y ser igual en los dos campos.',
      http: 400,
    });
  },

  metodoNoSoportado(metodo: string) {
    return new ErrorPago({
      paso: 'entrada',
      codigo: 'metodo_no_soportado',
      publico: 'Ese medio de pago no está habilitado todavía. Prueba con tarjeta.',
      http: 400,
      detalle: { metodo },
    });
  },

  plantillaNoDisponible(slug: string) {
    return new ErrorPago({
      paso: 'catalogo',
      codigo: 'plantilla_no_disponible',
      publico: 'Esa plantilla ya no está disponible. Elige otra del catálogo.',
      http: 409,
      detalle: { slug },
    });
  },

  pasarela(codigo: string, publico: string, detalle: Record<string, unknown>) {
    return new ErrorPago({
      paso: 'pasarela',
      codigo,
      publico,
      // 502: el fallo es de un tercero, no del cliente ni nuestro.
      http: 502,
      detalle,
    });
  },

  /** El dinero ya se movio y la fila no se escribio. Nunca se traga. */
  pedidoNoRegistrado(referencia: string, detalle: Record<string, unknown>) {
    return new ErrorPago({
      paso: 'base_de_datos',
      codigo: 'pedido_no_registrado',
      publico:
        `Tu pago se procesó pero no pudimos crear el pedido. No vuelvas a pagar: ` +
        `escríbenos con el código ${referencia} y lo resolvemos hoy mismo.`,
      http: 500,
      detalle: { referencia, ...detalle },
    });
  },
};
