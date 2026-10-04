import { supabaseAdmin } from '@/lib/supabase';
import { baseDelSitio } from '@/lib/sitio';
import { rutaEdicion } from '@/lib/acceso';
import { enviarCorreo } from '@/lib/correo/enviar';
import { correoEnlace, correoPublicado } from '@/lib/correo/plantillas';
import { qrPng } from '@/lib/qr';

/**
 * Los dos correos del flujo. Cada uno se envia UNA sola vez aunque lo
 * pidan a la vez el navegador, el webhook y "ya pague, revisar":
 *
 *   1. se RECLAMA la fila con un UPDATE condicional (`... is null`);
 *      solo uno de los que llegan a la vez obtiene la fila de vuelta;
 *   2. se envia;
 *   3. si el envio falla, se suelta la marca para que otro lo reintente.
 *
 * Nunca lanzan: un correo caido no puede deshacer un cobro ni una
 * publicacion. Lo peor que pasa es que el cliente use "Reenviar mi enlace".
 */

async function nombrePlantilla(tema: string | null): Promise<string> {
  if (!tema) return 'tu plantilla';
  const { data } = await supabaseAdmin().from('plantillas').select('nombre').eq('tema', tema).maybeSingle();
  return (data?.nombre as string) ?? 'tu plantilla';
}

/** Correo 1: el enlace para editar. Solo si el pago ya esta aprobado. */
export async function avisarEnlace(pedidoId: string): Promise<void> {
  try {
    const sb = supabaseAdmin();
    const { data: p, error } = await sb
      .from('pedidos')
      .update({ correo_enlace_en: new Date().toISOString() })
      .eq('id', pedidoId)
      .eq('estado', 'pendiente_datos')
      .is('correo_enlace_en', null)
      .not('comprador_email', 'is', null)
      .select('id, tema, comprador_email')
      .maybeSingle();

    if (error) return void console.warn('[avisos] enlace: no se pudo reclamar', pedidoId, error.message);
    if (!p) return; // ya enviado, sin correo, o el pago aun no se aprueba

    const base = await baseDelSitio();
    const correo = correoEnlace({
      url: `${base}${rutaEdicion(p.id)}`,
      plantilla: await nombrePlantilla(p.tema),
    });
    const ok = await enviarCorreo({ para: p.comprador_email, ...correo });
    if (!ok) await sb.from('pedidos').update({ correo_enlace_en: null }).eq('id', pedidoId);
  } catch (e) {
    console.error('[avisos] enlace', pedidoId, e);
  }
}

/** Correo 2: el regalo publicado, con el QR visible y adjunto. */
export async function avisarPublicado(pedidoId: string): Promise<void> {
  try {
    const sb = supabaseAdmin();
    const { data: p, error } = await sb
      .from('pedidos')
      .update({ correo_qr_en: new Date().toISOString() })
      .eq('id', pedidoId)
      .eq('estado', 'listo')
      .is('correo_qr_en', null)
      .not('comprador_email', 'is', null)
      .select('id, ocasion, slug, destinatario, comprador_email')
      .maybeSingle();

    if (error) return void console.warn('[avisos] publicado: no se pudo reclamar', pedidoId, error.message);
    if (!p) return;

    const base = await baseDelSitio();
    const url = `${base}/${p.ocasion}/${p.slug}`;
    const png = await qrPng(url);
    const correo = correoPublicado({
      url,
      // Gmail no muestra imagenes en base64: el QR se sirve desde una URL.
      urlQr: `${base}/api/qr/${p.ocasion}/${p.slug}`,
      destinatario: p.destinatario ?? '',
    });
    const ok = await enviarCorreo({
      para: p.comprador_email,
      ...correo,
      adjuntos: [{ filename: `qr-${p.slug}.png`, content: png.toString('base64') }],
    });
    if (!ok) await sb.from('pedidos').update({ correo_qr_en: null }).eq('id', pedidoId);
  } catch (e) {
    console.error('[avisos] publicado', pedidoId, e);
  }
}
