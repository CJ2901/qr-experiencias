import { descuento, soles, type Plantilla } from '@/lib/catalogo';

/**
 * Precio de oferta con el precio regular tachado.
 *
 * El "precio regular" es real (precios_historial lo registra cada vez que
 * cambia): por eso se rotula como "Precio regular" y no como "Antes".
 */
export default function Precio({
  p,
  tamano = 'md',
}: {
  p: Pick<Plantilla, 'precio_centavos' | 'precio_regular_centavos'>;
  tamano?: 'md' | 'lg';
}) {
  const pct = descuento(p);
  const grande = tamano === 'lg';

  return (
    <div>
      {pct > 0 && (
        <p className="flex items-center gap-2 text-xs text-stone-500">
          <span>
            Precio regular{' '}
            <s className="tabular-nums decoration-stone-400">{soles(p.precio_regular_centavos)}</s>
          </span>
          <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-semibold text-rose-800">
            −{pct}%
          </span>
        </p>
      )}
      <p className={`mt-0.5 font-semibold tabular-nums text-stone-900 ${grande ? 'text-3xl' : 'text-xl'}`}>
        {soles(p.precio_centavos)}
      </p>
    </div>
  );
}
