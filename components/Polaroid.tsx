'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Carrusel en forma de polaroid: una sola foto a la vez dentro de un
 * marco de papel, puntos para saber cuantas hay y una guirnalda debajo.
 *
 *  - pasa sola cada 4 s; si la persona desliza o toca un punto, se detiene
 *    un rato para no pelearle el control;
 *  - deslizar con el dedo pasa de foto (si el gesto es mas horizontal que
 *    vertical: no le roba el scroll a la pagina);
 *  - tocar la foto la abre en grande (onAbrir).
 *
 * Los colores salen de las variables del tema (--paper, --acc, --acc2),
 * asi la misma polaroid se ve bien en las cuatro plantillas y en el landing.
 */

interface Props {
  fotos: string[];
  onAbrir?: (indice: number) => void;
  /** Etiqueta accesible del carrusel. */
  titulo?: string;
}

const CADA_MS = 4000;
const PAUSA_MS = 9000;

// El degradado queda DEBAJO de la foto: se ve mientras carga, o si falta.
const fondo = (src: string) => ({
  backgroundImage: `url(${src}), linear-gradient(140deg, var(--acc2), var(--acc))`,
});

export default function Polaroid({ fotos, onAbrir, titulo = 'Galería de fotos' }: Props) {
  const [idx, setIdx] = useState(0);
  const n = fotos.length;
  const pausadoHasta = useRef(0);
  const desde = useRef<{ x: number; y: number } | null>(null);
  const deslizo = useRef(false);

  useEffect(() => {
    if (n < 2) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const t = setInterval(() => {
      if (Date.now() > pausadoHasta.current) setIdx((v) => (v + 1) % n);
    }, CADA_MS);
    return () => clearInterval(t);
  }, [n]);

  const ir = (k: number) => {
    pausadoHasta.current = Date.now() + PAUSA_MS;
    setIdx(((k % n) + n) % n);
  };

  if (!n) return null;

  return (
    <div className="polaroid" role="group" aria-roledescription="carrusel" aria-label={titulo}>
      <div
        className="pl-ventana"
        onPointerDown={(e) => {
          desde.current = { x: e.clientX, y: e.clientY };
          deslizo.current = false;
        }}
        onPointerUp={(e) => {
          const p = desde.current;
          desde.current = null;
          if (!p) return;
          const dx = e.clientX - p.x;
          const dy = e.clientY - p.y;
          if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy)) return;
          deslizo.current = true;
          ir(idx + (dx < 0 ? 1 : -1));
        }}
        onClickCapture={(e) => {
          // tras deslizar, el navegador dispara un click: no abrir el visor
          if (deslizo.current) {
            e.stopPropagation();
            e.preventDefault();
            deslizo.current = false;
          }
        }}
      >
        <div className="pl-pista" style={{ transform: `translateX(-${idx * 100}%)` }}>
          {fotos.map((src, k) => (
            <button
              key={k}
              type="button"
              className="pl-slide"
              onClick={() => onAbrir?.(k)}
              aria-label={`Foto ${k + 1} de ${n}. Toca para ampliar`}
              aria-hidden={k !== idx}
              tabIndex={k === idx ? 0 : -1}
            >
              <span className="foto" style={fondo(src)} />
            </button>
          ))}
        </div>
      </div>

      {n > 1 && (
        <div className="pl-puntos">
          {fotos.map((_, k) => (
            <button
              key={k}
              type="button"
              data-on={k === idx}
              onClick={() => ir(k)}
              aria-label={`Ver foto ${k + 1}`}
            />
          ))}
        </div>
      )}

      <Guirnalda />
    </div>
  );
}

/** Dos destellos a los lados y una guirnalda de banderines al centro. */
function Guirnalda() {
  const rayos = (cx: number) =>
    [0, 45, 90, 135, 180, 225, 270, 315].map((g) => {
      const r = (g * Math.PI) / 180;
      const a = g % 90 === 0 ? 17 : 13; // rayos rectos un poco mas largos
      return (
        <line
          key={g}
          x1={cx + Math.cos(r) * 6}
          y1={28 + Math.sin(r) * 6}
          x2={cx + Math.cos(r) * a}
          y2={28 + Math.sin(r) * a}
        />
      );
    });

  const colores = ['var(--acc)', '#5dbf9f', '#e2a95a', '#8a80d8', 'var(--acc2)', '#5dbf9f', '#e2a95a'];
  const banderines = colores.map((c, i) => {
    const x = 74 + i * 15.5;
    // siguen la curva de la cuerda: mas bajos al centro
    const y = 10 + Math.sin((i / (colores.length - 1)) * Math.PI) * 11;
    return <path key={i} d={`M${x} ${y} h10 l-5 12 z`} fill={c} opacity={0.88} />;
  });

  return (
    <svg className="pl-deco" viewBox="0 0 240 56" aria-hidden>
      <g className="pl-chispa" stroke="var(--acc)" strokeWidth="1.3" strokeLinecap="round">
        {rayos(30)}
      </g>
      <g className="pl-chispa b" stroke="var(--acc2)" strokeWidth="1.3" strokeLinecap="round">
        {rayos(210)}
      </g>
      <path d="M70 9 Q120 36 170 9" stroke="currentColor" strokeWidth="1" fill="none" opacity="0.35" />
      {banderines}
    </svg>
  );
}
