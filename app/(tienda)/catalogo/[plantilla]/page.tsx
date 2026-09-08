import Link from 'next/link';
import { notFound } from 'next/navigation';
import { traerPlantilla, soles } from '@/lib/catalogo';
import { TEMAS } from '@/lib/temas';
import PreviewTema from '@/components/tienda/PreviewTema';

export const revalidate = 600;

type Params = { params: Promise<{ plantilla: string }> };

const INCLUYE = [
  'Carta escrita a mano que se dibuja sola al abrir el sobre',
  'Hasta 4 fotos en el carrusel, más una foto de cierre',
  'Tu página propia con enlace permanente',
  'Código QR listo para imprimir',
];

export default async function DetallePlantilla({ params }: Params) {
  const { plantilla: slug } = await params;
  const p = await traerPlantilla(slug);
  if (!p) notFound();

  const tema = TEMAS[p.tema];

  return (
    <main className="mx-auto max-w-5xl px-5 py-12">
      <Link href="/catalogo" className="text-sm text-stone-500 hover:text-stone-800">
        &larr; Volver al catálogo
      </Link>

      <div className="mt-6 grid gap-10 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div>
          <PreviewTema tema={p.tema} alto={420} />
          <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-400">
                Tipografías
              </dt>
              <dd className="mt-1 text-stone-800">{tema.nombre === p.nombre ? '—' : ''}
                {tema.fuentes.includes('EB+Garamond') && 'EB Garamond · Lora'}
                {tema.fuentes.includes('Fraunces') && 'Fraunces · Karla'}
                {tema.fuentes.includes('Marcellus') && 'Marcellus · Karla'}
                {tema.fuentes.includes('Archivo') && 'Archivo · Karla'}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-400">
                Letra a mano
              </dt>
              <dd className="mt-1 text-stone-800">
                {tema.fuentes.includes('Homemade') && 'Homemade Apple'}
                {tema.fuentes.includes('Caveat') && 'Caveat'}
                {tema.fuentes.includes('Shadows') && 'Shadows Into Light'}
                {tema.fuentes.includes('Nothing') && 'Nothing You Could Do'}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-400">
                Galería
              </dt>
              <dd className="mt-1 capitalize text-stone-800">{tema.carrusel}</dd>
            </div>
          </dl>
        </div>

        <aside className="lg:sticky lg:top-8 lg:self-start">
          <div className="rounded-2xl border border-stone-200 bg-white p-6">
            <h1 className="text-2xl font-semibold tracking-tight text-stone-900">{p.nombre}</h1>
            <p className="mt-2 text-sm leading-relaxed text-stone-600">{p.descripcion}</p>

            <p className="mt-5 text-3xl font-semibold tabular-nums text-stone-900">
              {soles(p.precio_centavos)}
            </p>
            <p className="mt-1 text-xs text-stone-500">Pago único. Sin suscripción.</p>

            <Link
              href={`/checkout/${p.slug}`}
              className="mt-5 block rounded-xl bg-stone-900 px-5 py-3.5 text-center text-sm font-semibold text-white transition hover:bg-stone-700"
            >
              Comprar y personalizar
            </Link>
            <p className="mt-3 text-center text-xs leading-relaxed text-stone-500">
              Primero pagas, después subes tus textos y fotos.
              Si cierras la ventana, tu pedido te espera en «Mis pedidos».
            </p>

            <ul className="mt-6 space-y-2.5 border-t border-stone-100 pt-5 text-sm text-stone-700">
              {INCLUYE.map((i) => (
                <li key={i} className="flex gap-2.5">
                  <span className="mt-[3px] text-rose-600">&#10003;</span>
                  <span className="leading-relaxed">{i}</span>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </main>
  );
}
