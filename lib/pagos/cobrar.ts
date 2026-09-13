/**
 * El caso de uso. Es el unico archivo que cuenta la HISTORIA de un cobro;
 * los demas solo saben hacer su parte.
 *
 *   contrato   → que entro
 *   catalogo   → cuanto cuesta de verdad
 *   repositorio→ deja rastro antes de tocar plata
 *   pasarela   → cobra
 *   repositorio→ crea el pedido y cierra el rastro
 *
 * Un pago RECHAZADO vuelve como dato (`ok: false`), no como excepcion:
 * el sistema funciono perfecto, fue el banco el que dijo que no, y el
 * comprador merece leer por que.
 */

import { traerPlantilla } from '@/lib/catalogo';
import { errores, ErrorPago } from './errores';
import { leerSolicitud, type SolicitudPago } from './contrato';
import { cobrar as cobrarEnPasarela, emailPagador, type PagoRealizado } from './pasarela';
import {
  abrirIntento,
  cerrarIntento,
  registrarPedidoPagado,
} from './repositorio';
import { explicarPendiente, explicarRechazo, MENSAJE_APROBADO } from './mensajes';

export interface Comprador {
  id: string;
  email?: string | null;
}

export type Cobro =
  | {
      ok: true;
      clase: 'aprobado' | 'pendiente';
      mensaje: string;
      pedidoId: string;
      siguiente: string;
      referencia: string;
      pagoId: string;
    }
  | {
      ok: false;
      clase: 'rechazado';
      mensaje: string;
      cambiarMedio: boolean;
      referencia: string;
      pagoId: string;
    };

export async function procesarCobro(crudo: unknown, comprador: Comprador): Promise<Cobro> {
  const solicitud: SolicitudPago = leerSolicitud(crudo);

  // --- el precio, SIEMPRE desde el servidor ---
  const plantilla = await traerPlantilla(solicitud.plantilla);
  if (!plantilla) throw errores.plantillaNoDisponible(solicitud.plantilla);

  // --- rastro antes de mover plata ---
  const intento = await abrirIntento({
    compradorId: comprador.id,
    compradorEmail: comprador.email,
    plantilla: plantilla.slug,
    ocasion: solicitud.ocasion,
    metodo: solicitud.metodo,
    montoCentavos: plantilla.precio_centavos,
  });

  // Se calcula ANTES del try para poder guardarlo en la bitacora si falla:
  // "que correo mandamos" es la primera pregunta ante un 403 de MP.
  const correoPagador = emailPagador(solicitud.emailPagador ?? comprador.email);

  let pago: PagoRealizado;
  try {
    pago = await cobrarEnPasarela({
      monto: plantilla.precio_centavos / 100,
      descripcion: `Experiencia QR · ${plantilla.nombre}`,
      token: solicitud.token,
      metodoId: solicitud.metodoId,
      cuotas: solicitud.cuotas,
      // En prueba va el correo del usuario de prueba: con el correo dueno
      // de la cuenta, MP nunca aprueba (nadie puede pagarse a si mismo).
      emailPagador: correoPagador,
      identificacion: solicitud.identificacion,
      // La Orders API no tiene `metadata`. Lo que antes viajaba ahi
      // (usuario, plantilla, ocasion) ya esta en `intentos_pago`, asi que
      // basta con mandar su id: el webhook lo lee de vuelta y reconstruye.
      referencia: intento,
      claveIdempotencia: `${comprador.id}:${solicitud.token}`,
    });
  } catch (e) {
    const err = e as ErrorPago;
    await cerrarIntento(intento, {
      resultado: 'error',
      paso: err.paso ?? 'pasarela',
      codigo: err.codigo ?? 'excepcion',
      detalle: { pagador: correoPagador, ...(err.detalle ?? { mensaje: String(e) }) },
    });
    throw e;
  }

  const referencia = intento || pago.id;

  // --- el banco dijo que no ---
  if (pago.clase === 'rechazado') {
    const { mensaje, cambiarMedio } = explicarRechazo(pago.detalle);
    await cerrarIntento(intento, {
      resultado: 'rechazado',
      paso: 'pasarela',
      codigo: pago.detalle || pago.estado,
      pago,
    });
    return { ok: false, clase: 'rechazado', mensaje, cambiarMedio, referencia, pagoId: pago.id };
  }

  // --- el dinero se movio: de aqui en adelante nada se traga ---
  let pedido: { id: string; estado: string };
  try {
    pedido = await registrarPedidoPagado(
      pago,
      {
        ocasion: solicitud.ocasion,
        tema: plantilla.tema,
        compradorId: comprador.id,
        compradorEmail: comprador.email,
        precioCentavos: plantilla.precio_centavos,
        moneda: plantilla.moneda,
      },
      referencia
    );
  } catch (e) {
    const err = e as ErrorPago;
    await cerrarIntento(intento, {
      resultado: 'error',
      paso: 'base_de_datos',
      codigo: err.codigo ?? 'excepcion',
      detalle: err.detalle ?? { mensaje: String(e) },
      pago,
    });
    throw e;
  }

  const aprobado = pago.clase === 'aprobado';
  await cerrarIntento(intento, {
    resultado: aprobado ? 'aprobado' : 'pendiente',
    paso: 'pasarela',
    codigo: pago.detalle || pago.estado,
    pago,
    pedidoId: pedido.id,
  });

  return {
    ok: true,
    clase: aprobado ? 'aprobado' : 'pendiente',
    mensaje: aprobado ? MENSAJE_APROBADO : explicarPendiente(pago.detalle),
    pedidoId: pedido.id,
    siguiente: aprobado ? `/pedido/${pedido.id}/completar` : '/mis-pedidos',
    referencia,
    pagoId: pago.id,
  };
}
