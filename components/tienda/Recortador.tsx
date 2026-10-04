'use client';

import { useState } from 'react';
import Cropper from 'react-easy-crop';
import { recortar, type Area } from '@/lib/imagen';

/**
 * Ajustar el encuadre de una foto: arrastrar para mover, pellizcar o usar
 * la barra para hacer zoom. El marco tiene la MISMA forma con la que la
 * plantilla va a mostrar la foto, asi lo que ves aqui es lo que se vera.
 */

interface Props {
  src: string;
  aspecto: number;
  forma: string;
  onListo: (recorte: Blob) => Promise<void> | void;
  onCancelar: () => void;
}

export default function Recortador({ src, aspecto, forma, onListo, onCancelar }: Props) {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<Area | null>(null);
  const [guardando, setGuardando] = useState(false);

  async function usar() {
    if (!area) return;
    setGuardando(true);
    try {
      await onListo(await recortar(src, area));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-stone-950" role="dialog" aria-modal="true" aria-label="Ajustar foto">
      <div className="relative flex-1">
        <Cropper
          image={src}
          crop={pos}
          zoom={zoom}
          maxZoom={4}
          aspect={aspecto}
          onCropChange={setPos}
          onZoomChange={setZoom}
          onCropComplete={(_, px) => setArea(px)}
          objectFit="contain"
          showGrid={false}
        />
      </div>

      <div className="space-y-4 bg-stone-950 px-5 pb-[max(20px,env(safe-area-inset-bottom))] pt-4 text-white">
        <p className="text-center text-xs text-stone-400">
          Arrastra para mover · pellizca o usa la barra para acercar. Se verá en forma {forma}.
        </p>
        <label className="flex items-center gap-3 text-sm">
          <span aria-hidden>−</span>
          <input
            type="range"
            min={1}
            max={4}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="flex-1 accent-rose-500"
            aria-label="Zoom"
          />
          <span aria-hidden>+</span>
        </label>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancelar}
            disabled={guardando}
            className="flex-1 rounded-xl border border-stone-700 px-4 py-3 text-sm font-medium text-stone-200"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={usar}
            disabled={guardando || !area}
            className="flex-1 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-stone-900 disabled:opacity-50"
          >
            {guardando ? 'Guardando…' : 'Usar este encuadre'}
          </button>
        </div>
      </div>
    </div>
  );
}
