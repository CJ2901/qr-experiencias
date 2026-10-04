import { notFound } from 'next/navigation';
import Link from 'next/link';
import { traerPlantilla } from '@/lib/catalogo';
import PreviewTema from '@/components/tienda/PreviewTema';
import Precio from '@/components/tienda/Precio';
import PanelPago from '@/components/tienda/PanelPago';
import { MP_ES_PRUEBA } from '@/lib/mp';
import { PAGOS_SIMULADOS } from '@/lib/pagos/cobrar';
import { OCASIONES } from '@/lib/ocasiones';

type Params = { params: Promise<{ plantilla: string }> };

export const dynamic = 'force-dynamic';

// Yape solo se ofrece si la cuenta de Mercado Pago lo tiene aprovisionado.
// Mientras no lo este, la pestana ni aparece: mejor un medio menos que un
// boton que falla al final del checkout.
const YAPE_HABILITADO = process.env.NEXT_PUBLIC_MP_YAPE === '1';

/**
 * Checkout sin cuenta. El comprador escribe su correo dos veces: es la
 * unica forma de devolverle el enlace de su regalo.
 */
export default async function Checkout({ params }: Params) {
  const { plantilla: slug } = await params;
  const p = await traerPlantilla(slug);
  if (!p) notFound();

  return (
    <main className="mx-auto max-w-5xl px-5 py-10">
      <Link href={`/catalogo/${p.slug}`} className="text-sm text-stone-500 hover:text-stone-800">
        &larr; Volver
      </Link>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-semibold tracking-tight text-stone-900">Pagar</h1>
        {MP_ES_PRUEBA && (
          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-amber-900">
            Modo prueba · no se cobra
          </span>
        )}
      </div>
      <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-stone-600">
        Apenas se apruebe, escribes tu dedicatoria aquí mismo. También te enviamos
        el enlace a tu correo, por si quieres terminarla después.
      </p>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        <aside className="order-first lg:order-last lg:sticky lg:top-8">
          <div className="rounded-2xl border border-stone-200 bg-white p-5">
            <PreviewTema tema={p.tema} alto={150} />
            <div className="mt-4 flex items-end justify-between gap-3">
              <span className="font-medium text-stone-900">{p.nombre}</span>
              <Precio p={p} />
            </div>
          </div>
        </aside>

        <div>
          <PanelPago
            plantilla={p.slug}
            montoSoles={p.precio_centavos / 100}
            ocasiones={OCASIONES}
            yapeHabilitado={YAPE_HABILITADO}
            simulado={PAGOS_SIMULADOS}
          />
        </div>
      </div>
    </main>
  );
}
