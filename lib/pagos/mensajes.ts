/**
 * Lo que el comprador lee cuando algo pasa con su pago.
 *
 * POR QUE ESTA SEPARADO
 * Mercado Pago devuelve `status_detail` en ingles y en jerga de adquirente
 * ("cc_rejected_call_for_authorize"). Mostrar eso, o esconderlo detras de
 * "no pudimos procesar el pago", son las dos formas de perder la venta:
 * en la primera el comprador no entiende, en la segunda no sabe que hacer.
 *
 * Regla de este archivo: cada mensaje termina en una ACCION concreta.
 */

export type ClaseDeEstado = 'aprobado' | 'pendiente' | 'rechazado';

/**
 * De que se cobro o no, en tres palabras.
 *
 * Hay que entender DOS vocabularios porque conviven: el de /v1/payments
 * (approved, in_process, rejected) y el de la Orders API (processed,
 * action_required, failed), que es la que usamos desde set. 2026. Un
 * estado desconocido cae en 'rechazado' a proposito: es el unico lado
 * seguro en el que equivocarse — deja al comprador reintentando en vez de
 * darle un pedido por el que nadie pago.
 */
const APROBADOS = new Set(['approved', 'authorized', 'processed']);
const PENDIENTES_ = new Set([
  'in_process',
  'pending',
  'processing',
  'action_required',
  'created',
]);

export function clasificar(estado?: string | null): ClaseDeEstado {
  if (APROBADOS.has(estado ?? '')) return 'aprobado';
  if (PENDIENTES_.has(estado ?? '')) return 'pendiente';
  return 'rechazado';
}

interface Explicacion {
  /** Frase para el comprador. Siempre dice que hacer. */
  mensaje: string;
  /** true = reintentar con lo mismo no sirve; hay que cambiar de tarjeta o de medio. */
  cambiarMedio: boolean;
}

const RECHAZOS: Record<string, Explicacion> = {
  cc_rejected_bad_filled_card_number: {
    mensaje: 'El número de la tarjeta no coincide. Revísalo y vuelve a intentar.',
    cambiarMedio: false,
  },
  cc_rejected_bad_filled_date: {
    mensaje: 'La fecha de vencimiento no coincide. Revísala y vuelve a intentar.',
    cambiarMedio: false,
  },
  cc_rejected_bad_filled_security_code: {
    mensaje: 'El código de seguridad no coincide. Revísalo y vuelve a intentar.',
    cambiarMedio: false,
  },
  cc_rejected_bad_filled_other: {
    mensaje: 'Alguno de los datos de la tarjeta no coincide. Revísalos y vuelve a intentar.',
    cambiarMedio: false,
  },
  cc_rejected_insufficient_amount: {
    mensaje: 'La tarjeta no tiene fondos suficientes. Usa otra tarjeta o paga con Yape.',
    cambiarMedio: true,
  },
  cc_rejected_call_for_authorize: {
    mensaje:
      'Tu banco necesita autorizar este monto. Llámalos, autoriza el consumo y vuelve a intentar.',
    cambiarMedio: false,
  },
  cc_rejected_card_disabled: {
    mensaje: 'Tu tarjeta está inhabilitada para compras por internet. Actívala con tu banco.',
    cambiarMedio: true,
  },
  cc_rejected_card_error: {
    mensaje: 'El banco no pudo procesar la tarjeta. Espera un minuto y vuelve a intentar.',
    cambiarMedio: false,
  },
  cc_rejected_duplicated_payment: {
    mensaje:
      'Ya hay un pago idéntico en curso. Revisa «Mis pedidos» antes de pagar otra vez.',
    cambiarMedio: true,
  },
  cc_rejected_high_risk: {
    mensaje: 'Mercado Pago rechazó el pago por seguridad. Prueba con otro medio de pago.',
    cambiarMedio: true,
  },
  cc_rejected_max_attempts: {
    mensaje: 'Se alcanzó el límite de intentos con esa tarjeta. Usa otra o paga con Yape.',
    cambiarMedio: true,
  },
  cc_rejected_invalid_installments: {
    mensaje: 'Tu tarjeta no acepta ese número de cuotas. Elige otra cantidad.',
    cambiarMedio: false,
  },
  cc_rejected_blacklist: {
    mensaje: 'No podemos procesar esa tarjeta. Prueba con otra o paga con Yape.',
    cambiarMedio: true,
  },
  cc_rejected_other_reason: {
    mensaje: 'Tu banco rechazó el pago sin darnos un motivo. Prueba con otra tarjeta.',
    cambiarMedio: true,
  },
  // Yape reutiliza los codigos cc_ de arriba y agrega los suyos:
  cc_rejected_bad_filled_otp: {
    mensaje: 'El código de aprobación de Yape no coincide. Genera uno nuevo en la app.',
    cambiarMedio: false,
  },
};

const PENDIENTES: Record<string, string> = {
  pending_contingency:
    'Mercado Pago está revisando tu pago. Suele tardar unos minutos: te avisamos apenas se acredite.',
  pending_review_manual:
    'Tu pago quedó en revisión manual. Puede tardar hasta 2 días hábiles; te avisamos por correo.',
  pending_waiting_payment:
    'Falta que completes el pago en tu app. Cuando lo hagas, entra a «Mis pedidos» y toca «Ya pagué».',
  pending_waiting_transfer:
    'Estamos esperando la transferencia. Cuando llegue, tu pedido se desbloquea solo.',
  pending_challenge:
    'Tu banco pidió una verificación extra. Complétala y vuelve a «Mis pedidos».',
};

/** Que le decimos al comprador ante un pago que NO quedo aprobado. */
export function explicarRechazo(detalle?: string | null): Explicacion {
  return (
    RECHAZOS[detalle ?? ''] ?? {
      mensaje:
        'El pago no se completó y no se te cobró nada. Prueba con otra tarjeta o con Yape.',
      cambiarMedio: true,
    }
  );
}

/** Que le decimos ante un pago que quedo en el aire. */
export function explicarPendiente(detalle?: string | null): string {
  return (
    PENDIENTES[detalle ?? ''] ??
    'Tu pago quedó en revisión. Te avisamos apenas se acredite; también puedes revisarlo desde «Mis pedidos».'
  );
}

export const MENSAJE_APROBADO =
  'Pago aprobado. Te llevamos a personalizar tu experiencia.';
