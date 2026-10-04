import Link from 'next/link';
import { listarPlantillas } from '@/lib/catalogo';
import { MARCA } from '@/lib/marca';
import PreviewTema from '@/components/tienda/PreviewTema';
import Precio from '@/components/tienda/Precio';

/**
 * El landing ES el catalogo. Quien llega desde un anuncio ve de inmediato
 * que se vende, cuanto cuesta y como se ve: sin pasos numerados ni
 * pantallas intermedias.
 */

export const revalidate = 600;

export const metadata = {
  title: `${MARCA} · Dedicatorias que se abren con un QR`,
  description:
    'Una carta escrita a mano que se dibuja sola, tus fotos y un QR para regalar. Lista en minutos.',
};

const INCLUYE = [
  { t: 'Carta escrita a mano', d: 'Tu mensaje se dibuja letra por letra al abrir el sobre.' },
  { t: 'Galería de recuerdos', d: 'Tus fotos favoritas, en un carrusel que se recorre con el dedo.' },
  { t: 'Un QR para regalar', d: 'Lo imprimes o lo envías. Al escanearlo, se abre la sorpresa.' },
  { t: 'Dura 5 años', d: 'El enlace sigue funcionando para volver a leerlo cuando quieran.' },
];

const COMO = [
  { t: 'Elige la dedicatoria', d: 'Cuatro estilos, el mismo cariño.' },
  { t: 'Paga en un minuto', d: 'Tarjeta de débito, crédito o Yape. Sin crear cuenta.' },
  { t: 'Escribe y sube tus fotos', d: 'En la misma pantalla. Te dejamos el enlace en tu correo.' },
  { t: 'Recibe tu QR', d: 'Llega a tu correo listo para imprimir o compartir.' },
];

export default async function Inicio() {
  const plantillas = await listarPlantillas();

  return (
    <main>
      {/* ---------- portada ---------- */}
      <section className="mx-auto max-w-5xl px-5 pb-6 pt-12 sm:pt-16">
        <h1 className="max-w-2xl text-[2.1rem] font-semibold leading-[1.1] tracking-tight text-stone-900 sm:text-5xl">
          Dilo con una carta que se escribe sola.
        </h1>
        <p className="mt-4 max-w-xl text-[16px] leading-relaxed text-stone-600">
          Tu mensaje escrito a mano, tus fotos y un QR para regalar. Lo armas en
          minutos desde el celular y llega como una sorpresa que se abre al escanear.
        </p>
        <a
          href="#dedicatorias"
          className="mt-7 inline-flex rounded-xl bg-stone-900 px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-stone-700"
        >
          Ver dedicatorias
        </a>
      </section>

      {/* ---------- catalogo ---------- */}
      <section id="dedicatorias" className="mx-auto max-w-5xl scroll-mt-6 px-5 py-10">
        <h2 className="text-xl font-semibold tracking-tight text-stone-900">Elige cómo se va a ver</h2>
        <p className="mt-1.5 text-sm text-stone-600">
          Todas incluyen lo mismo. Lo que cambia es el estilo.
        </p>

        <div className="mt-6 grid gap-5 sm:grid-cols-2">
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
              <PreviewTema tema={p.tema} alto={200} />
              <div className="flex flex-1 flex-col p-5">
                <h3 className="text-lg font-semibold tracking-tight text-stone-900">{p.nombre}</h3>
                <p className="mt-1.5 flex-1 text-sm leading-relaxed text-stone-600">{p.descripcion}</p>
                <div className="mt-4 flex items-end justify-between gap-3">
                  <Precio p={p} />
                  <span className="inline-flex items-center gap-1.5 text-sm font-medium text-rose-700">
                    Ver
                    <span className="transition group-hover:translate-x-0.5">&rarr;</span>
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ---------- que incluye ---------- */}
      <section className="mx-auto max-w-5xl px-5 py-10">
        <h2 className="text-xl font-semibold tracking-tight text-stone-900">Qué incluye cada dedicatoria</h2>
        <ul className="mt-6 grid gap-4 sm:grid-cols-2">
          {INCLUYE.map((i) => (
            <li key={i.t} className="rounded-2xl border border-stone-200 bg-white p-5">
              <p className="font-medium text-stone-900">{i.t}</p>
              <p className="mt-1 text-sm leading-relaxed text-stone-600">{i.d}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* ---------- como funciona (sin numerar, a proposito) ---------- */}
      <section className="mx-auto max-w-5xl px-5 py-10">
        <h2 className="text-xl font-semibold tracking-tight text-stone-900">Así de simple</h2>
        <ul className="mt-6 grid gap-x-6 gap-y-5 sm:grid-cols-4">
          {COMO.map((c) => (
            <li key={c.t} className="border-l-2 border-rose-200 pl-4">
              <p className="font-medium text-stone-900">{c.t}</p>
              <p className="mt-1 text-sm leading-relaxed text-stone-600">{c.d}</p>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
