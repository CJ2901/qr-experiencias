'use client';

import { useEffect, useRef, useState } from 'react';
import type { Carrusel } from '@/lib/temas';

interface Props {
  /** URLs ya firmadas por el servidor. Puede venir vacio (fotos archivadas). */
  fotos: string[];
  pies?: string[];
}

function fondo(url?: string) {
  return url ? { backgroundImage: `url(${url})` } : undefined;
}

/* ------------------------------------------------------ A · baraja */
export function Baraja({ fotos, pies = [] }: Props) {
  const [idx, setIdx] = useState(0);
  const n = fotos.length;
  return (
    <>
      <div className="baraja">
        {fotos.map((src, k) => {
          const d = (k - idx + n) % n;
          return (
            <button
              key={k}
              className="carta-f"
              onClick={() => setIdx((v) => (v + 1) % n)}
              aria-label={`Foto ${k + 1} de ${n}`}
              style={{
                zIndex: n - d,
                opacity: d > 2 ? 0 : 1,
                transform:
                  `translateX(-50%) translate(${d * 9}px, ${d * 7}px) ` +
                  `rotate(${(d % 2 ? 1 : -1) * (1.6 + d * 1.1)}deg) scale(${1 - d * 0.035})`,
              }}
            >
              <span className="foto" style={fondo(src)} />
              {pies[k] ? <span className="pie">{pies[k]}</span> : null}
            </button>
          );
        })}
      </div>
      <p className="pista">toca la foto de arriba para pasar</p>
    </>
  );
}

/* --------------------------------------------------- C · coverflow */
export function Coverflow({ fotos }: Props) {
  const [idx, setIdx] = useState(Math.min(1, fotos.length - 1));
  return (
    <>
      <div className="coverflow">
        {fotos.map((src, k) => {
          const d = k - idx;
          const ad = Math.abs(d);
          return (
            <button
              key={k}
              className="cv"
              onClick={() => setIdx(k)}
              aria-label={`Foto ${k + 1} de ${fotos.length}`}
              style={{
                zIndex: 10 - ad,
                opacity: ad > 2 ? 0 : 1 - ad * 0.22,
                filter: ad ? 'brightness(.6)' : 'none',
                transform:
                  `translateX(-50%) translateX(${d * 82}px) rotateY(${-d * 36}deg) scale(${1 - ad * 0.16})`,
              }}
            >
              <span className="foto" style={fondo(src)} />
            </button>
          );
        })}
      </div>
      <div className="puntos">
        {fotos.map((_, k) => (
          <span key={k} data-on={k === idx} onClick={() => setIdx(k)} />
        ))}
      </div>
    </>
  );
}

/* ----------------------------------------------------- D · abanico */
export function Abanico({ fotos }: Props) {
  const [idx, setIdx] = useState(Math.min(1, fotos.length - 1));
  return (
    <>
      <div className="abanico">
        {fotos.map((src, k) => {
          const d = k - idx;
          return (
            <button
              key={k}
              className="fc"
              data-on={k === idx}
              onClick={() => setIdx(k)}
              aria-label={`Foto ${k + 1} de ${fotos.length}`}
              style={{
                zIndex: k === idx ? 10 : 5 - Math.abs(d),
                transform:
                  `translateX(-50%) rotate(${d * 15}deg) translateY(${k === idx ? -22 : 0}px) ` +
                  `scale(${k === idx ? 1.04 : 0.94})`,
              }}
            >
              <span className="foto" style={fondo(src)} />
            </button>
          );
        })}
      </div>
      <p className="pista">toca una carta del abanico</p>
    </>
  );
}

/* -------------------------------------------------------- E · tira */
export function Tira({ fotos }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState(0);
  const ancho = 100 / Math.max(fotos.length, 1);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onScroll = () => {
      const max = el.scrollWidth - el.clientWidth;
      setPos(max ? (el.scrollLeft / max) * (100 - ancho) : 0);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [ancho]);

  return (
    <>
      <div className="tira" ref={ref}>
        {fotos.map((src, k) => (
          <div className="ts" key={k}>
            <span className="foto" style={fondo(src)} />
            <b>{String(k + 1).padStart(2, '0')}</b>
          </div>
        ))}
      </div>
      <div className="riel">
        <i style={{ left: `${pos}%`, width: `${ancho}%` }} />
      </div>
    </>
  );
}

/* --------------------------------------------------------- selector */
export default function CarruselTema({ tipo, fotos, pies }: Props & { tipo: Carrusel }) {
  if (!fotos.length) return null;
  if (tipo === 'coverflow') return <Coverflow fotos={fotos} />;
  if (tipo === 'abanico') return <Abanico fotos={fotos} />;
  if (tipo === 'tira') return <Tira fotos={fotos} />;
  return <Baraja fotos={fotos} pies={pies} />;
}
