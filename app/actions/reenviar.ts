'use server';

import { supabaseAdmin } from '@/lib/supabase';
import { baseDelSitio } from '@/lib/sitio';
import { rutaEdicion } from '@/lib/acceso';
import { enviarCorreo } from '@/lib/correo/enviar';
import { correoReenvio } from '@/lib/correo/plantillas';

/**
 * "Reenviar mi enlace". Reemplaza a «Mis pedidos»: sin cuentas, el correo
 * es la identidad.
 *
 * Dos reglas de seguridad:
 *  - la respuesta es SIEMPRE la misma, exista o no el correo. Si dijera
 *    "no encontramos pedidos", serviria para averiguar quien compro;
 *  - maximo un reenvio cada 10 minutos por pedido, para que nadie use
 *    este formulario para llenarle la bandeja a otra persona.
 */

const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const ESPERA_MS = 10 * 60 * 1000;
const RESPUESTA_REENVIO =
  'Si ese correo tiene pedidos, te acabamos de enviar sus enlaces. Revisa también la carpeta de spam.';

export async function reenviarEnlaces(_prev: string, form: FormData): Promise<string> {
  const email = String(form.get('email') ?? '').trim().toLowerCase();
  if (!CORREO.test(email)) return 'Escribe un correo válido.';

  const sb = supabaseAdmin();
  const { data: pedidos } = await sb
    .from('pedidos')
    .select('id, ocasion, slug, estado, destinatario, correo_reenvio_en')
    // eq y no ilike: en ilike el "_" (comun en correos) es comodin y
    // podria devolver pedidos de OTRA persona. Los correos se guardan en minusculas.
    .eq('comprador_email', email)
    .in('estado', ['pendiente_pago', 'pendiente_datos', 'listo'])
    .order('creado_en', { ascending: false })
    .limit(5);

  const ahora = Date.now();
  const elegibles = (pedidos ?? []).filter(
    (p) => !p.correo_reenvio_en || ahora - new Date(p.correo_reenvio_en).getTime() > ESPERA_MS
  );
  if (!elegibles.length) return RESPUESTA_REENVIO;

  const base = await baseDelSitio();
  const enlaces = elegibles.map((p) =>
    p.estado === 'listo'
      ? { titulo: `Regalo publicado${p.destinatario ? ` para ${p.destinatario}` : ''}`, url: `${base}/${p.ocasion}/${p.slug}` }
      : { titulo: `Escribir mi dedicatoria${p.destinatario ? ` para ${p.destinatario}` : ''}`, url: `${base}${rutaEdicion(p.id)}` }
  );

  const ok = await enviarCorreo({ para: email, ...correoReenvio({ enlaces }) });
  if (ok) {
    await sb
      .from('pedidos')
      .update({ correo_reenvio_en: new Date().toISOString() })
      .in('id', elegibles.map((p) => p.id));
  }
  return RESPUESTA_REENVIO;
}
