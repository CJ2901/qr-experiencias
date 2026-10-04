/**
 * El unico camino del navegador hacia /api/pagar.
 *
 * EL BUG QUE ESTE ARCHIVO EXISTE PARA MATAR
 * Antes cada componente hacia su propio `fetch` + `await r.json()` dentro
 * de un try/catch. Si el servidor devolvia un 500 en HTML (por ejemplo,
 * una variable de entorno faltante), `r.json()` lanzaba, caia en el catch
 * de red y el comprador leia "Se corto la conexion" cuando la conexion
 * estaba perfecta. Aqui se distinguen los tres casos y NUNCA se lanza:
 * quien llama siempre recibe un mensaje que puede mostrar tal cual.
 */

export interface RespuestaPago {
  ok: boolean;
  /** Listo para pintar en pantalla. Siempre viene algo. */
  mensaje: string;
  /** A donde mandar al comprador cuando ok === true. */
  siguiente?: string;
  /** Codigo que el comprador nos dicta si hay que reclamar. */
  referencia?: string | null;
  codigo?: string;
  /** true = reintentar con el mismo medio no va a funcionar. */
  cambiarMedio?: boolean;
}

const SIN_RESPUESTA =
  'No pudimos comunicarnos con el servidor. Revisa tu correo antes de volver a intentar: si el cobro pasó, ahí está tu enlace.';

const RESPUESTA_ROTA =
  'El servidor respondió algo que no entendimos. Revisa tu correo antes de volver a intentar.';

export async function enviarPago(cuerpo: Record<string, unknown>): Promise<RespuestaPago> {
  let r: Response;
  try {
    r = await fetch('/api/pagar', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo),
    });
  } catch {
    // Aqui SI se corto la conexion. Es el unico caso donde decirlo es cierto.
    return { ok: false, mensaje: SIN_RESPUESTA, codigo: 'sin_red' };
  }

  let datos: Record<string, unknown> | null = null;
  try {
    datos = (await r.json()) as Record<string, unknown>;
  } catch {
    return {
      ok: false,
      mensaje: RESPUESTA_ROTA,
      codigo: `respuesta_no_json_${r.status}`,
    };
  }

  const mensaje =
    (typeof datos?.mensaje === 'string' && datos.mensaje) ||
    (typeof datos?.error === 'string' && datos.error) ||
    (r.ok ? 'Pago procesado.' : RESPUESTA_ROTA);

  return {
    ok: r.ok && datos?.ok !== false,
    mensaje,
    siguiente: typeof datos?.siguiente === 'string' ? datos.siguiente : undefined,
    referencia: typeof datos?.referencia === 'string' ? datos.referencia : null,
    codigo: typeof datos?.codigo === 'string' ? datos.codigo : undefined,
    cambiarMedio: datos?.cambiarMedio === true,
  };
}
