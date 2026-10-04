/**
 * Envio por Resend (API HTTP, sin SDK).
 *
 * Un correo que falla NUNCA tumba un cobro ni una publicacion: devuelve
 * false, deja el motivo en los logs y quien llama decide si reintenta.
 *
 *   RESEND_API_KEY     obligatoria para enviar (sin ella solo se registra)
 *   CORREO_REMITENTE   "Dile.pe <hola@envios.meliydani.com>" por defecto
 *   CORREO_RESPUESTA   opcional: a donde llegan las respuestas del cliente
 */

export interface Adjunto {
  filename: string;
  /** base64 */
  content: string;
}

export interface Correo {
  para: string;
  asunto: string;
  html: string;
  texto: string;
  adjuntos?: Adjunto[];
}

const REMITENTE_POR_DEFECTO = 'Dile.pe <hola@envios.meliydani.com>';

export async function enviarCorreo(c: Correo): Promise<boolean> {
  const clave = process.env.RESEND_API_KEY;
  if (!clave) {
    console.warn(`[correo] RESEND_API_KEY vacia: NO se envio "${c.asunto}" a ${c.para}`);
    return false;
  }

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${clave}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.CORREO_REMITENTE || REMITENTE_POR_DEFECTO,
        to: [c.para],
        subject: c.asunto,
        html: c.html,
        text: c.texto,
        ...(process.env.CORREO_RESPUESTA ? { reply_to: process.env.CORREO_RESPUESTA } : {}),
        ...(c.adjuntos?.length ? { attachments: c.adjuntos } : {}),
      }),
    });
    if (!r.ok) {
      console.error('[correo] Resend respondio', r.status, await r.text().catch(() => ''));
      return false;
    }
    return true;
  } catch (e) {
    console.error('[correo] sin conexion con Resend', e);
    return false;
  }
}
