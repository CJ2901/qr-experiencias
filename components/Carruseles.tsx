'use client';

import { useEffect, useRef, useState } from 'react';
import type { Carrusel } from '@/lib/temas';

interface Props {
  /** URLs ya firmadas por el servidor. Puede venir vacio (fotos archivadas). */
  fotos: string[];
  pies?: string[];
  /** Abre el visor a pantalla completa en esa foto. */
  onAbrir?: (indice: number) => void;
}

function fondo(url?: string) {
  return url ? { backgroundImage: `url(${url})` } : undefined;
}

/**
 * Deslizar con el dedo.
 *
 * Antes solo se podia tocar, que en movil es el gesto equivocado: la mano
 * ya viene entrenada para arrastrar. Se descarta el gesto si el
 * movimiento es mas vertical que horizontal, para no robarle el scroll a
 * la pagina.
 */
function useDeslizar(alPasar: (paso: number) => void) {
  const desde = useRef<{ x: number; y: number } | null>(null);
  const huboDeslizamiento = useRef(false);

  return {
    onPointerDown: (e: React.PointerEvent) => {
      desde.current = { x: e.clientX, y: e.clientY };
      huboDeslizamiento.current = false;
    },
    onPointerUp: (e: React.PointerEvent) => {
      const p = desde.current;
      desde.current = null;
      if (!p) return;
      const dx = e.clientX - p.x;
      const dy = e.clientY - p.y;
      if (Math.abs(dx) < 45 || Math.abs(dx) < Math.abs(dy)) return;
      huboDeslizamiento.current = true;
      alPasar(dx < 0 ? 1 : -1);
    },
    // Tras un deslizamiento el navegador dispara ademas un click sobre la
    // foto. Sin tragarlo, deslizar abriria el visor sin querer.
    onClickCapture: (e: React.MouseEvent) => {
      if (huboDeslizamiento.current) {
        e.stopPropagation();
        e.preventDefault();
        huboDeslizamiento.current = false;
      }
    },
  };
}

/** Toca la foto activa → se abre. Toca otra → se enfoca. */
function alTocar(k: number, idx: number, setIdx: (n: number) => void, onAbrir?: (i: number) => void) {
  if (k === idx) onAbrir?.(k);
  else setIdx(k);
}

/* ------------------------------------------------------ A · baraja */
export function Baraja({ fotos, pies = [], onAbrir }: Props) {
  const [idx, setIdx] = useState(0);
  const n = fotos.length;
  const deslizar = useDeslizar((paso) => setIdx((v) => (v + paso + n) % n));

  return (
    <>
      <div className="baraja" {...deslizar}>
        {fotos.map((src, k) => {
          const d = (k - idx + n) % n;
          return (
            <button
              key={k}
              className="carta-f"
              onClick={() => (d === 0 ? onAbrir?.(k) : setIdx((v) => (v + 1) % n))}
              aria-label={d === 0 ? `Ampliar foto ${k + 1}` : `Foto ${k + 1} de ${n}`}
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
      <p className="pista">desliza para pasar · toca para ampliar</p>
    </>
  );
}

/* --------------------------------------------------- C · coverflow */
export function Coverflow({ fotos, onAbrir }: Props) {
  const [idx, setIdx] = useState(Math.min(1, fotos.length - 1));
  const deslizar = useDeslizar((paso) =>
    setIdx((v) => Math.min(fotos.length - 1, Math.max(0, v + paso)))
  );

  return (
    <>
      <div className="coverflow" {...deslizar}>
        {fotos.map((src, k) => {
          const d = k - idx;
          const ad = Math.abs(d);
          return (
            <button
              key={k}
              className="cv"
              onClick={() => alTocar(k, idx, setIdx, onAbrir)}
              aria-label={k === idx ? `Ampliar foto ${k + 1}` : `Foto ${k + 1} de ${fotos.length}`}
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
      <p className="pista">desliza para pasar · toca para ampliar</p>
    </>
  );
}

/* ----------------------------------------------------- D · abanico */
export function Abanico({ fotos, onAbrir }: Props) {
  const [idx, setIdx] = useState(Math.min(1, fotos.length - 1));
  const deslizar = useDeslizar((paso) =>
    setIdx((v) => Math.min(fotos.length - 1, Math.max(0, v + paso)))
  );

  return (
    <>
      <div className="abanico" {...deslizar}>
        {fotos.map((src, k) => {
          const d = k - idx;
          return (
            <button
              key={k}
              className="fc"
              data-on={k === idx}
              onClick={() => alTocar(k, idx, setIdx, onAbrir)}
              aria-label={k === idx ? `Ampliar foto ${k + 1}` : `Foto ${k + 1} de ${fotos.length}`}
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
      <p className="pista">desliza el abanico · toca para ampliar</p>
    </>
  );
}

/* -------------------------------------------------------- E · tira */
export function Tira({ fotos, onAbrir }: Props) {
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

  // La tira ya se desliza sola: es scroll nativo con scroll-snap.
  return (
    <>
      <div className="tira" ref={ref}>
        {fotos.map((src, k) => (
          <button className="ts" key={k} onClick={() => onAbrir?.(k)} aria-label={`Ampliar foto ${k + 1}`}>
            <span className="foto" style={fondo(src)} />
            <b>{String(k + 1).padStart(2, '0')}</b>
          </button>
        ))}
      </div>
      <div className="riel">
        <i style={{ left: `${pos}%`, width: `${ancho}%` }} />
      </div>
    </>
  );
}

/* --------------------------------------------------------- selector */
export default function CarruselTema({
  tipo,
  fotos,
  pies,
  onAbrir,
}: Props & { tipo: Carrusel }) {
  if (!fotos.length) return null;
  if (tipo === 'coverflow') return <Coverflow fotos={fotos} onAbrir={onAbrir} />;
  if (tipo === 'abanico') return <Abanico fotos={fotos} onAbrir={onAbrir} />;
  if (tipo === 'tira') return <Tira fotos={fotos} onAbrir={onAbrir} />;
  return <Baraja fotos={fotos} pies={pies} onAbrir={onAbrir} />;
}
