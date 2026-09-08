import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { traerPlantilla, soles } from '@/lib/catalogo';
import { usuarioActual } from '@/lib/supabase-server';
import PreviewTema from '@/components/tienda/PreviewTema';
import PanelPago from '@/components/tienda/PanelPago';
import { emailPagador, MP_ES_PRUEBA } from '@/lib/mp';
import { OCASIONES } from '@/lib/ocasiones';

type Params = { params: Promise<{ plantilla: string }> };

// Yape solo se ofrece si la cuenta de Mercado Pago lo tiene aprovisionado.
// Mientras no lo este, la pestana ni aparece: mejor un medio menos que un
// boton que falla al final del checkout.
const YAPE_HABILITADO = process.env.NEXT_PUBLIC_MP_YAPE === '1';

export default async function Checkout({ params }: Params) {
  const { plantilla: slug } = await params;
  const p = await traerPlantilla(slug);
  if (!p) notFound();

  // Pagar sin sesion deja el pedido huerfano: no habria "Mis pedidos".
  const usuario = await usuarioActual();
  if (!usuario) redirect(`/entrar?destino=${encodeURIComponent(`/checkout/${slug}`)}`);

  return (
    <main className="mx-auto max-w-5xl px-5 py-12">
      <Link href={`/catalogo/${p.slug}`} className="text-sm text-stone-500 hover:text-stone-800">
        &larr; Volver
      </Link>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-rose-700">
          Paso 2 de 3
        </p>
        {MP_ES_PRUEBA && (
          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-amber-900">
            Modo prueba · no se cobra
          </span>
        )}
      </div>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-stone-900">Pagar</h1>
      <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-stone-600">
        Tus textos y tus fotos los subes en el siguiente paso, sin apuro.
        Nada se pierde si cierras la ventana.
      </p>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        <aside className="order-first lg:order-last lg:sticky lg:top-8">
          <div className="rounded-2xl border border-stone-200 bg-white p-5">
            <PreviewTema tema={p.tema} alto={150} />
            <div className="mt-4 flex items-baseline justify-between">
              <span className="font-medium text-stone-900">{p.nombre}</span>
              <span className="text-xl font-semibold tabular-nums">{soles(p.precio_centavos)}</span>
            </div>
            <p className="mt-3 border-t border-stone-100 pt-3 text-xs leading-relaxed text-stone-500">
              El monto lo calcula nuestro servidor a partir del catálogo. Comprando como{' '}
              <span className="font-medium text-stone-700">{usuario.email}</span>.
            </p>
          </div>
        </aside>

        <div>
          <PanelPago
            plantilla={p.slug}
            montoSoles={p.precio_centavos / 100}
            email={emailPagador(usuario.email)}
            ocasiones={OCASIONES}
            yapeHabilitado={YAPE_HABILITADO}
          />
        </div>
      </div>
    </main>
  );
}
