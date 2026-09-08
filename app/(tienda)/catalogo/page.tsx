import Link from 'next/link';
import { listarPlantillas, soles } from '@/lib/catalogo';
import PreviewTema from '@/components/tienda/PreviewTema';

export const revalidate = 600;

export const metadata = {
  title: 'Catálogo · Experiencias QR',
  description: 'Elige cómo se va a ver tu regalo. El contenido lo pones después.',
};

export default async function Catalogo() {
  const plantillas = await listarPlantillas();

  return (
    <main className="mx-auto max-w-5xl px-5 py-12">
      <header className="max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-rose-700">
          Paso 1 de 3
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-stone-900 sm:text-4xl">
          Elige cómo se va a ver
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-stone-600">
          Los cuatro llevan lo mismo: carta escrita a mano que se dibuja sola, sobre lacrado,
          galería de fotos y tu página propia con QR. Lo que cambia es el mundo visual.
          Tus textos y tus fotos los subes después de pagar, con calma.
        </p>
      </header>

      <div className="mt-10 grid gap-6 sm:grid-cols-2">
        {plantillas.map((p) => (
          <Link
            key={p.slug}
            href={`/catalogo/${p.slug}`}
            className="group relative flex flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white transition hover:border-stone-300 hover:shadow-lg hover:shadow-stone-200/60"
          >
            {p.destacada && (
              <span className="absolute right-3 top-3 z-10 rounded-full bg-stone-900 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-white">
                La más pedida
              </span>
            )}

            <PreviewTema tema={p.tema} alto={210} />

            <div className="flex flex-1 flex-col p-5">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="text-lg font-semibold tracking-tight text-stone-900">
                  {p.nombre}
                </h2>
                <span className="shrink-0 text-base font-semibold tabular-nums text-stone-900">
                  {soles(p.precio_centavos)}
                </span>
              </div>
              <p className="mt-1.5 flex-1 text-sm leading-relaxed text-stone-600">
                {p.descripcion}
              </p>
              <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-rose-700">
                Ver cómo queda
                <span className="transition group-hover:translate-x-0.5">&rarr;</span>
              </span>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
