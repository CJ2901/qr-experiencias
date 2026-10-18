'use client';

import Experiencia, { type DatosPedido } from '@/components/Experiencia';
import { temaDe, type TemaId } from '@/lib/temas';
import { cortarLineas } from '@/lib/wrap';

/**
 * El regalo tal cual lo vera quien lo reciba, con lo escrito hasta ahora.
 * Usa el MISMO componente que la pagina publica: si algo se ve mal aqui,
 * se veria mal alla. Al cerrar se desmonta y la musica se detiene sola.
 */
export default function VistaPrevia({
  tema,
  pedido,
  mensaje,
  fotos,
  fotoFinal,
  onCerrar,
}: {
  tema: TemaId;
  pedido: DatosPedido;
  mensaje: string;
  fotos: string[];
  fotoFinal: string | null;
  onCerrar: () => void;
}) {
  const t = temaDe(tema);
  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto bg-black" role="dialog" aria-modal="true" aria-label="Vista previa">
      <link rel="stylesheet" href={t.fuentes} />
      <div className="sticky top-0 z-[80] flex items-center justify-between gap-3 bg-stone-900/95 px-4 py-2.5 text-white backdrop-blur">
        <span className="text-xs font-medium">Vista previa · así lo verá</span>
        <button
          type="button"
          onClick={onCerrar}
          className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-stone-900"
        >
          Cerrar
        </button>
      </div>
      <Experiencia
        pedido={pedido}
        tema={t}
        lineas={cortarLineas(mensaje || ' ', t.maxChars)}
        fotos={fotos}
        fotoFinal={fotoFinal}
        vistaPrevia
      />
    </div>
  );
}
