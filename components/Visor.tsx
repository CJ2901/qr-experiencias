'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Visor a pantalla completa. Se abre al tocar una foto.
 *
 * Gestos, todos con Pointer Events (un solo camino para dedo y raton):
 *   - arrastrar de lado           → foto anterior / siguiente
 *   - pellizcar con dos dedos     → zoom continuo
 *   - doble toque                 → alterna 1x / 2.6x en el punto tocado
 *   - arrastrar con zoom          → desplazar dentro de la foto
 *   - Esc, flechas, o el botón ✕  → teclado
 *
 * Por que no una libreria: son ~120 lineas, no arrastra dependencias y el
 * comportamiento tiene que sentirse igual en los cuatro temas.
 */

const ZOOM_MAX = 4;
const ZOOM_DOBLE_TOQUE = 2.6;
const UMBRAL_SWIPE = 60;

interface Props {
  fotos: string[];
  /** Foto por la que abre. */
  inicial: number;
  onCerrar: () => void;
}

export default function Visor({ fotos, inicial, onCerrar }: Props) {
  const [idx, setIdx] = useState(inicial);
  const [escala, setEscala] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [arrastre, setArrastre] = useState(0);

  const punteros = useRef(new Map<number, { x: number; y: number }>());
  const inicio = useRef({ x: 0, y: 0, px: 0, py: 0 });
  const distanciaInicial = useRef(0);
  const escalaInicial = useRef(1);
  const ultimoToque = useRef(0);

  const reiniciar = useCallback(() => {
    setEscala(1);
    setPos({ x: 0, y: 0 });
    setArrastre(0);
  }, []);

  const ir = useCallback(
    (paso: number) => {
      setIdx((v) => {
        const n = v + paso;
        return n < 0 || n >= fotos.length ? v : n;
      });
      reiniciar();
    },
    [fotos.length, reiniciar]
  );

  /* -------------------------------------------------------- teclado */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCerrar();
      if (e.key === 'ArrowLeft') ir(-1);
      if (e.key === 'ArrowRight') ir(1);
    };
    window.addEventListener('keydown', onKey);
    // Mientras el visor esta abierto la pagina de atras no debe moverse.
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [ir, onCerrar]);

  /* --------------------------------------------------------- gestos */
  function distancia() {
    const [a, b] = [...punteros.current.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function onDown(e: React.PointerEvent) {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    punteros.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (punteros.current.size === 2) {
      distanciaInicial.current = distancia();
      escalaInicial.current = escala;
      return;
    }

    inicio.current = { x: e.clientX, y: e.clientY, px: pos.x, py: pos.y };

    const ahora = Date.now();
    if (ahora - ultimoToque.current < 300) {
      // doble toque: si ya hay zoom, se sale; si no, se entra
      if (escala > 1) reiniciar();
      else setEscala(ZOOM_DOBLE_TOQUE);
      ultimoToque.current = 0;
    } else {
      ultimoToque.current = ahora;
    }
  }

  function onMove(e: React.PointerEvent) {
    if (!punteros.current.has(e.pointerId)) return;
    punteros.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (punteros.current.size === 2 && distanciaInicial.current) {
      const factor = distancia() / distanciaInicial.current;
      setEscala(Math.min(ZOOM_MAX, Math.max(1, escalaInicial.current * factor)));
      return;
    }

    const dx = e.clientX - inicio.current.x;
    const dy = e.clientY - inicio.current.y;

    if (escala > 1) {
      setPos({ x: inicio.current.px + dx, y: inicio.current.py + dy });
    } else {
      setArrastre(dx);
    }
  }

  function onUp(e: React.PointerEvent) {
    punteros.current.delete(e.pointerId);

    if (punteros.current.size === 0) {
      if (escala <= 1) {
        if (arrastre < -UMBRAL_SWIPE) ir(1);
        else if (arrastre > UMBRAL_SWIPE) ir(-1);
        setArrastre(0);
      }
      // Al soltar el pellizco por debajo de 1x, la foto vuelve a su sitio.
      if (escala <= 1.02) reiniciar();
      distanciaInicial.current = 0;
    }
  }

  const foto = fotos[idx];
  if (!foto) return null;

  return (
    <div className="visor" role="dialog" aria-modal="true" aria-label="Foto ampliada">
      <button className="visor-x" onClick={onCerrar} aria-label="Cerrar">
        ✕
      </button>

      <div
        className="visor-lienzo"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={foto}
          alt=""
          draggable={false}
          style={{
            transform: `translate(${pos.x + arrastre}px, ${pos.y}px) scale(${escala})`,
            transition: punteros.current.size ? 'none' : 'transform .25s ease',
          }}
        />
      </div>

      {fotos.length > 1 && (
        <>
          <button
            className="visor-nav visor-nav-izq"
            onClick={() => ir(-1)}
            disabled={idx === 0}
            aria-label="Foto anterior"
          >
            ‹
          </button>
          <button
            className="visor-nav visor-nav-der"
            onClick={() => ir(1)}
            disabled={idx === fotos.length - 1}
            aria-label="Foto siguiente"
          >
            ›
          </button>
          <div className="visor-puntos">
            {fotos.map((_, k) => (
              <span key={k} data-on={k === idx} />
            ))}
          </div>
        </>
      )}

      <p className="visor-pista">
        {escala > 1 ? 'Arrastra para mover · doble toque para salir' : 'Pellizca o toca dos veces para acercar'}
      </p>
    </div>
  );
}
