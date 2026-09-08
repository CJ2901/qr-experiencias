import { supabaseSesion, usuarioActual } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';

/**
 * Magic link. Sin contrasena: el cliente compra una vez al ano, no va a
 * recordar una clave. El correo es ademas donde le reenviamos su enlace.
 */

type Props = { searchParams: Promise<{ destino?: string; enviado?: string; error?: string }> };

export default async function Entrar({ searchParams }: Props) {
  const { destino = '/mis-pedidos', enviado, error } = await searchParams;
  if (await usuarioActual()) redirect(destino);

  async function enviarEnlace(formData: FormData) {
    'use server';
    const email = String(formData.get('email') ?? '').trim();
    const dest = String(formData.get('destino') ?? '/mis-pedidos');
    if (!email) redirect(`/entrar?error=1&destino=${encodeURIComponent(dest)}`);

    const sb = await supabaseSesion();
    const base = (process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/+$/, '');
    const { error: e } = await sb.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${base}/auth/callback?destino=${encodeURIComponent(dest)}` },
    });
    redirect(
      e
        ? `/entrar?error=1&destino=${encodeURIComponent(dest)}`
        : `/entrar?enviado=1&destino=${encodeURIComponent(dest)}`
    );
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
          {error && <p className="text-sm text-rose-700">No pudimos enviar el enlace. Revisa el correo.</p>}
          <button className="w-full rounded-xl bg-stone-900 px-5 py-3 text-sm font-semibold text-white hover:bg-stone-700">
            Enviarme el enlace
          </button>
        </form>
      )}
    </main>
  );
}
