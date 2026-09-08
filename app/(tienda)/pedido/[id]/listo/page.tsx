import Link from 'next/link';
import { redirect, notFound } from 'next/navigation';
import { supabaseSesion, usuarioActual } from '@/lib/supabase-server';
import TarjetaQR from '@/components/tienda/TarjetaQR';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

export default async function Listo({ params }: Params) {
  const { id } = await params;

  const usuario = await usuarioActual();
  if (!usuario) redirect(`/entrar?destino=${encodeURIComponent(`/pedido/${id}/listo`)}`);

  const sb = await supabaseSesion();
  const { data: p } = await sb
    .from('pedidos')
    .select('id, ocasion, slug, destinatario, estado')
    .eq('id', id)
    .maybeSingle();

  if (!p) notFound();
  if (p.estado === 'pendiente_datos') redirect(`/pedido/${id}/completar`);

  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/+$/, '');
  const url = `${base}/${p.ocasion}/${p.slug}`;

  return (
    <main className="mx-auto max-w-xl px-5 py-14 text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700">Listo</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-stone-900">
        Tu experiencia ya vive
      </h1>
      <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-stone-600">
        Imprime la tarjeta, o manda el enlace directo. Al escanear se abre lo que escribiste.
      </p>

      <div className="mt-10">
        <TarjetaQR url={url} destinatario={p.destinatario ?? ''} />
      </div>

      <div className="mt-10 flex flex-wrap justify-center gap-3 text-sm">
        <Link
          href={`/${p.ocasion}/${p.slug}`}
          className="rounded-xl border border-stone-300 px-5 py-2.5 font-medium hover:bg-stone-50"
        >
          Ver cómo quedó
        </Link>
        <Link href="/mis-pedidos" className="rounded-xl px-5 py-2.5 text-stone-600 hover:text-stone-900">
          Mis pedidos
        </Link>
      </div>

      <p className="mx-auto mt-10 max-w-md text-xs leading-relaxed text-stone-500">
        ¿Se te pasó un error? Escríbenos con este código y lo corregimos:{' '}
        <span className="font-mono text-stone-700">{p.slug}</span>
      </p>
    </main>
  );
}
