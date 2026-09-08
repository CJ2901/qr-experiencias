import Link from 'next/link';
import { usuarioActual } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export default async function SinAcceso() {
  const usuario = await usuarioActual();

  return (
    <main className="mx-auto max-w-md px-5 py-20 text-center">
      <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
        Este panel no es para tu cuenta
      </h1>
      <p className="mt-3 text-[15px] leading-relaxed text-stone-600">
        {usuario?.email ? (
          <>
            Entraste como{' '}
            <span className="font-medium text-stone-800">{usuario.email}</span>, y ese
            correo no está autorizado.
          </>
        ) : (
          'No hay una sesión activa.'
        )}
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link
          href="/entrar?destino=/admin"
          className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700"
        >
          Entrar con otra cuenta
        </Link>
        <Link
          href="/"
          className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium hover:bg-stone-50"
        >
          Ir al inicio
        </Link>
      </div>
    </main>
  );
}
