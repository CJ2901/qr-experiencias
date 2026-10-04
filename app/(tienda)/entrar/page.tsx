import { supabaseSesion, usuarioActual } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { baseDelSitio } from '@/lib/sitio';

/**
 * Magic link. Sin contrasena: el cliente compra una vez al ano, no va a
 * recordar una clave. El correo es ademas donde le reenviamos su enlace.
 *
 * POR QUE EL ERROR TIENE CODIGO Y NO ES UN 1
 * Antes esto redirigia con `?error=1` pasara lo que pasara, y el motivo
 * que devuelve Supabase se perdia. Con eso, "no pudimos enviar el enlace"
 * podia ser el limite de correos por hora del SMTP de prueba, una URL de
 * retorno que no esta en la lista blanca, o un correo mal escrito — tres
 * cosas con tres soluciones distintas, y ninguna forma de distinguirlas.
 * Ahora el motivo se registra en el servidor (visible en los Runtime Logs
 * de Vercel) y viaja un codigo corto en la URL para poder decirle al
 * comprador algo que sirva.
 */

const MENSAJES: Record<string, string> = {
  limite:
    'Se alcanzó el límite de correos por hora. Espera unos minutos y vuelve a intentar.',
  correo: 'Ese correo no parece válido. Revísalo y vuelve a intentar.',
  configuracion:
    'La tienda no está bien configurada para enviar el enlace. Ya lo estamos viendo, escríbenos.',
  envio: 'No pudimos enviar el enlace. Revisa el correo y vuelve a intentar.',
};

/** Traduce lo que devuelve Supabase a uno de los codigos de arriba. */
function codigoDe(e: { status?: number; code?: string; message?: string }): string {
  const m = (e.message ?? '').toLowerCase();
  if (e.status === 429 || m.includes('rate limit') || m.includes('security purposes')) return 'limite';
  if (m.includes('invalid') && m.includes('email')) return 'correo';
  if (m.includes('redirect') || m.includes('url')) return 'configuracion';
  return 'envio';
}

type Props = { searchParams: Promise<{ destino?: string; enviado?: string; error?: string }> };

export default async function Entrar({ searchParams }: Props) {
  const { destino = '/admin', enviado, error } = await searchParams;
  if (await usuarioActual()) redirect(destino);

  async function enviarEnlace(formData: FormData) {
    'use server';
    const email = String(formData.get('email') ?? '').trim();
    const dest = String(formData.get('destino') ?? '/admin');
    if (!email) redirect(`/entrar?error=correo&destino=${encodeURIComponent(dest)}`);

    // El destino va en cookie, no en la URL del enlace: ver auth/callback/route.ts.
    const store = await cookies();
    store.set('destino_login', dest, { path: '/', maxAge: 600, httpOnly: true, sameSite: 'lax' });

    const base = await baseDelSitio();
    if (!base) {
      console.error('[entrar] no hay NEXT_PUBLIC_SITE_URL ni host en la petición.');
      redirect(`/entrar?error=configuracion&destino=${encodeURIComponent(dest)}`);
    }

    const sb = await supabaseSesion();
    const { error: e } = await sb.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${base}/auth/callback` },
    });

    if (e) {
      // Lo unico que queda cuando esto falla en produccion. Sin el mensaje
      // crudo no hay diagnostico posible: el navegador solo ve el codigo.
      console.error('[entrar] signInWithOtp falló', {
        status: e.status,
        code: e.code,
        mensaje: e.message,
        emailRedirectTo: `${base}/auth/callback`,
      });
      redirect(`/entrar?error=${codigoDe(e)}&destino=${encodeURIComponent(dest)}`);
    }
    redirect(`/entrar?enviado=1&destino=${encodeURIComponent(dest)}`);
  }

  return (
    <main className="mx-auto flex max-w-md flex-col justify-center px-5 py-20">
      <h1 className="text-2xl font-semibold tracking-tight text-stone-900">Entra con tu correo</h1>
      <p className="mt-2 text-sm leading-relaxed text-stone-600">
        Te mandamos un enlace. No hay contraseña que recordar, y a ese mismo correo
        te llega después el enlace de tu experiencia.
      </p>

      {enviado ? (
        <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          Listo. Revisa tu correo y abre el enlace desde este mismo dispositivo.
        </div>
      ) : (
        <form action={enviarEnlace} className="mt-6 space-y-3">
          <input type="hidden" name="destino" value={destino} />
          <input
            type="email"
            name="email"
            required
            autoFocus
            placeholder="tucorreo@ejemplo.com"
            className="w-full rounded-xl border border-stone-300 px-4 py-3 text-[15px] outline-none focus:border-stone-900"
          />
          {error && (
            <p className="text-sm text-rose-700">{MENSAJES[error] ?? MENSAJES.envio}</p>
          )}
          <button className="w-full rounded-xl bg-stone-900 px-5 py-3 text-sm font-semibold text-white hover:bg-stone-700">
            Enviarme el enlace
          </button>
        </form>
      )}
    </main>
  );
}
