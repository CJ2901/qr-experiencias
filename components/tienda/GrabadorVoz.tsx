'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * La voz del comprador leyendo su carta (gratis): grabar con el microfono
 * del celular o subir una nota de voz que ya tenga.
 *
 * Formato: se pide audio/mp4 (AAC) cuando el navegador puede grabarlo,
 * porque es lo unico que suena en TODOS los celulares, iPhone incluido.
 * Si solo hay webm (algunos Android antiguos), se usa webm.
 *
 * Este componente no sube nada: entrega el archivo a `onListo` y el
 * formulario lo sube con la misma URL firmada que las fotos.
 */

interface Props {
  /** URL para escuchar la voz ya guardada (firmada o local). */
  actual: string | null;
  onListo: (audio: Blob, nombre: string) => Promise<void>;
  onQuitar: () => void;
}

const MAX_SEG = 180;
const MAX_MB = 15;

function formatoGrabacion(): { mime: string; ext: string } | null {
  if (typeof MediaRecorder === 'undefined') return null;
  for (const [mime, ext] of [
    ['audio/mp4', 'm4a'],
    ['audio/webm;codecs=opus', 'webm'],
    ['audio/webm', 'webm'],
  ] as const) {
    if (MediaRecorder.isTypeSupported(mime)) return { mime, ext };
  }
  return null;
}

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

export default function GrabadorVoz({ actual, onListo, onQuitar }: Props) {
  const [grabando, setGrabando] = useState(false);
  const [seg, setSeg] = useState(0);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const grabador = useRef<MediaRecorder | null>(null);
  const flujo = useRef<MediaStream | null>(null);
  const reloj = useRef<ReturnType<typeof setInterval> | null>(null);

  // Al salir de esta parte: soltar el microfono y el reloj.
  useEffect(
    () => () => {
      if (reloj.current) clearInterval(reloj.current);
      flujo.current?.getTracks().forEach((t) => t.stop());
    },
    []
  );

  async function grabar() {
    setError('');
    const formato = formatoGrabacion();
    if (!formato || !navigator.mediaDevices?.getUserMedia) {
      setError('Este navegador no permite grabar. Puedes subir una nota de voz grabada en tu celular.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      flujo.current = stream;
      const partes: Blob[] = [];
      const rec = new MediaRecorder(stream, { mimeType: formato.mime });
      rec.ondataavailable = (e) => e.data.size && partes.push(e.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        if (reloj.current) clearInterval(reloj.current);
        setGrabando(false);
        const audio = new Blob(partes, { type: formato.mime.split(';')[0] });
        if (audio.size < 2000) return setError('La grabación quedó vacía. Inténtalo otra vez.');
        setGuardando(true);
        try {
          await onListo(audio, `voz.${formato.ext}`);
        } finally {
          setGuardando(false);
        }
      };
      grabador.current = rec;
      rec.start(1000);
      setSeg(0);
      setGrabando(true);
      reloj.current = setInterval(() => {
        setSeg((s) => {
          if (s + 1 >= MAX_SEG) rec.state === 'recording' && rec.stop();
          return s + 1;
        });
      }, 1000);
    } catch {
      setError('No pudimos usar el micrófono. Revisa el permiso del navegador o sube una nota de voz.');
    }
  }

  const detener = () => grabador.current?.state === 'recording' && grabador.current.stop();

  async function subirArchivo(f: File | undefined) {
    if (!f) return;
    setError('');
    if (!f.type.startsWith('audio/')) return setError('Ese archivo no es un audio.');
    if (f.size > MAX_MB * 1024 * 1024) return setError(`El audio pesa más de ${MAX_MB} MB. Recórtalo o grábalo aquí.`);
    setGuardando(true);
    try {
      await onListo(f, f.name);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4">
      <p className="text-sm font-medium text-stone-900">
        Tu voz leyendo la carta <span className="font-normal text-stone-400">(opcional · gratis)</span>
      </p>
      <p className="mt-1 text-xs leading-relaxed text-stone-500">
        Aparece un botón ▶ junto a la carta y, mientras suena tu voz, la música baja. Máximo {MAX_SEG / 60} minutos.
      </p>

      {actual && !grabando && (
        <div className="mt-3 flex items-center gap-3">
          <audio src={actual} controls preload="none" className="h-10 flex-1" />
          <button type="button" onClick={onQuitar} className="text-xs font-medium text-rose-700 hover:underline">
            Quitar
          </button>
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {grabando ? (
          <button
            type="button"
            onClick={detener}
            className="flex items-center gap-2 rounded-xl bg-rose-700 px-4 py-2.5 text-sm font-semibold text-white"
          >
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-white" /> Detener · {mmss(seg)}
          </button>
        ) : (
          <button
            type="button"
            onClick={grabar}
            disabled={guardando}
            className="rounded-xl bg-stone-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {guardando ? 'Guardando…' : actual ? '🎙 Grabar de nuevo' : '🎙 Grabar mi voz'}
          </button>
        )}
        {!grabando && (
          <label className="cursor-pointer rounded-xl border border-stone-300 px-4 py-2.5 text-sm font-medium text-stone-700 hover:bg-stone-50">
            Subir nota de voz
            <input
              type="file"
              accept="audio/*"
              className="hidden"
              disabled={guardando}
              onChange={(e) => {
                subirArchivo(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
          </label>
        )}
      </div>

      {error && <p className="mt-2 text-xs text-rose-700" role="alert">{error}</p>}
    </div>
  );
}
