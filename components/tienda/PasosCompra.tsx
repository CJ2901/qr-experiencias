/**
 * Guia rapida de la compra: el comprador ve de un vistazo que le toca
 * ahora y que viene despues. Informativa, no es un formulario por pasos.
 */

const PASOS = [
  { t: 'Tu correo', d: 'Escríbelo 2 veces' },
  { t: 'Pagas', d: 'Tarjeta o Yape' },
  { t: 'Escribes', d: 'Carta, fotos y canción' },
  { t: 'Recibes tu QR', d: 'En tu correo' },
];

export default function PasosCompra({ actual }: { actual: number }) {
  return (
    <ol className="grid grid-cols-4 gap-1.5" aria-label="Cómo funciona la compra">
      {PASOS.map((p, i) => {
        const hecho = i < actual;
        const ahora = i === actual;
        return (
          <li key={p.t} className="flex flex-col items-center text-center" aria-current={ahora ? 'step' : undefined}>
            <div className="flex w-full items-center">
              <span className={`h-0.5 flex-1 ${i === 0 ? 'opacity-0' : hecho || ahora ? 'bg-rose-700' : 'bg-stone-200'}`} />
              <span
                className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-semibold transition ${
                  hecho
                    ? 'bg-rose-700 text-white'
                    : ahora
                      ? 'bg-rose-700 text-white ring-4 ring-rose-100'
                      : 'bg-stone-100 text-stone-400'
                }`}
              >
                {hecho ? '✓' : i + 1}
              </span>
              <span className={`h-0.5 flex-1 ${i === PASOS.length - 1 ? 'opacity-0' : hecho ? 'bg-rose-700' : 'bg-stone-200'}`} />
            </div>
            <span className={`mt-1.5 text-[12px] font-semibold leading-tight ${ahora ? 'text-stone-900' : hecho ? 'text-stone-700' : 'text-stone-400'}`}>
              {p.t}
            </span>
            <span className="mt-0.5 hidden text-[11px] leading-tight text-stone-500 sm:block">{p.d}</span>
          </li>
        );
      })}
    </ol>
  );
}
