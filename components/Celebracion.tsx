'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

/**
 * El estallido al abrir la carta. Cada tema celebra a su manera:
 * papelitos en Correspondencia, chispas en Luz de vela, petalos en
 * Herbario, y confeti duro en Editorial.
 *
 * Sin librerias ni canvas: son ~40 particulas con transform y opacity,
 * que es lo unico que el navegador anima sin repintar. Se generan dentro
 * de useEffect (no al renderizar) porque usan Math.random y en el
 * servidor darian un HTML distinto al del cliente.
 */

type Forma = 'confeti' | 'chispa' | 'petalo';

const PALETAS: Record<string, { colores: string[]; forma: Forma }> = {
  correspondencia: { colores: ['#B22626', '#E8C89A', '#FDF8EC', '#8A6A3F'], forma: 'confeti' },
  'luz-de-vela': { colores: ['#E8A94E', '#FFD9A0', '#FFF3D6', '#C2762A'], forma: 'chispa' },
  herbario: { colores: ['#6B7A5E', '#A8BE9A', '#D9C2C2', '#F2EEE2'], forma: 'petalo' },
  editorial: { colores: ['#FF5A4E', '#111111', '#FFFFFF', '#FFC9C4'], forma: 'confeti' },
};

const CANTIDAD = 42;
const DURACION = 2400;

interface Particula {
  x: number;
  y: number;
  giro: number;
  demora: number;
  escala: number;
  color: string;
}

export default function Celebracion({ tema, onFin }: { tema: string; onFin?: () => void }) {
  const [vivas, setVivas] = useState<Particula[]>([]);
  const { colores, forma } = useMemo(
    () => PALETAS[tema] ?? PALETAS.correspondencia,
    [tema]
  );

  // `onFin` es una lambda nueva en cada render del padre. Sin este ref
  // entraria en las dependencias del efecto y el estallido se reiniciaria
  // cada vez que el padre cambia de estado (p. ej. al empezar a escribir).
  const alTerminar = useRef(onFin);
  alTerminar.current = onFin;

  useEffect(() => {
    // Quien pidió menos movimiento en su sistema no recibe la explosión.
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      alTerminar.current?.();
      return;
    }

    const nuevas: Particula[] = Array.from({ length: CANTIDAD }, () => {
      const angulo = Math.random() * Math.PI * 2;
      // Sesgo hacia arriba: caer se ve mejor que subir.
      const fuerza = 90 + Math.random() * 210;
      return {
        x: Math.cos(angulo) * fuerza,
        y: Math.sin(angulo) * fuerza - 60,
        giro: (Math.random() - 0.5) * 720,
        demora: Math.random() * 220,
        escala: 0.6 + Math.random() * 0.8,
        color: colores[Math.floor(Math.random() * colores.length)],
      };
    });
    setVivas(nuevas);

    const t = setTimeout(() => {
      setVivas([]);
      alTerminar.current?.();
    }, DURACION);
    return () => clearTimeout(t);
  }, [colores]);

  if (!vivas.length) return null;

  return (
    <div className="celebra" aria-hidden>
      {vivas.map((p, k) => (
        <i
          key={k}
          className={`chispa chispa-${forma}`}
          style={
            {
              '--x': `${p.x}px`,
              '--y': `${p.y}px`,
              '--giro': `${p.giro}deg`,
              '--esc': p.escala,
              animationDelay: `${p.demora}ms`,
              background: p.color,
              boxShadow: forma === 'chispa' ? `0 0 8px ${p.color}` : undefined,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
