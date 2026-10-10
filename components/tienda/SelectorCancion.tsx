'use client';

import { useEffect, useRef, useState } from 'react';
import { CANCIONES } from '@/lib/canciones';

/**
 * Elegir la cancion del regalo, escuchandola antes. Solo suena una a la
 * vez y se detiene al salir de esta parte del formulario.
 */
export default function SelectorCancion({
  valor,
  onCambiar,
}: {
  valor: string | null;
  onCambiar: (id: string | null) => void;
}) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [sonando, setSonando] = useState<string | null>(null);
  const [faltan, setFaltan] = useState<Set<string>>(new Set());

  useEffect(() => () => audio.current?.pause(), []);

  function escuchar(id: string) {
    audio.current?.pause();
    if (sonando === id) return setSonando(null);
    const a = new Audio(`/canciones/${id}.mp3`);
    a.volume = 0.7;
    a.onended = () => setSonando(null);
    audio.current = a;
    setSonando(id);
    a.play().catch(() => {
      setSonando(null);
      setFaltan((prev) => new Set(prev).add(id));
    });
  }

  const opcion = (id: string | null, titulo: string, detalle: string) => {
    const elegida = valor === id;
    const noDisponible = id !== null && faltan.has(id);
    return (
      <div
        key={id ?? 'ninguna'}
        className={`flex items-center gap-3 rounded-xl border p-3 transition ${
          elegida ? 'border-stone-900 bg-white shadow-sm' : 'border-stone-200 bg-white/60'
        } ${noDisponible ? 'opacity-50' : ''}`}
      >
        {id ? (
          <button
            type="button"
            onClick={() => escuchar(id)}
            disabled={noDisponible}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-stone-900 text-sm text-white disabled:bg-stone-300"
            aria-label={sonando === id ? `Pausar ${titulo}` : `Escuchar ${titulo}`}
          >
            {sonando === id ? '❚❚' : '▶'}
          </button>
        ) : (
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-stone-100 text-stone-400" aria-hidden>
            ∅
          </span>
        )}
        <button
          type="button"
          onClick={() => !noDisponible && onCambiar(id)}
          className="flex flex-1 items-center justify-between gap-3 text-left"
          aria-pressed={elegida}
          disabled={noDisponible}
        >
          <span>
            <span className="block text-sm font-medium text-stone-900">{titulo}</span>
            <span className="block text-xs text-stone-500">{noDisponible ? 'No disponible por ahora' : detalle}</span>
          </span>
          <span
            className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border ${
              elegida ? 'border-stone-900 bg-stone-900 text-[10px] text-white' : 'border-stone-300'
            }`}
            aria-hidden
          >
            {elegida ? '✓' : ''}
          </span>
        </button>
      </div>
    );
  };

  return (
    <div className="space-y-2.5">
      {CANCIONES.map((c) => opcion(c.id, c.titulo, c.ambiente))}
      {opcion(null, 'Sin música', 'El regalo se abre en silencio')}
    </div>
  );
}
