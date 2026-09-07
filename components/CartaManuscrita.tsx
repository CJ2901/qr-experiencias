'use client';

import { useEffect, useRef } from 'react';

/**
 * Carta manuscrita en SVG.
 *
 * Lo que la hace creible y no una fuente "de imitacion" pegada en un div:
 *  1. cada palabra es su propio <text>, con angulo, desvio vertical y
 *     opacidad de tinta propios  ->  la linea base deja de ser perfecta;
 *  2. se revelan de a una, con pausas irregulares entre ellas;
 *  3. la punta de la pluma sube y baja mientras avanza dentro de cada palabra.
 *
 * Siguiente escalon (trazo real, la pluma dibujando el contorno de cada
 * letra): fuente monolineal -> rutas con opentype.js -> stroke-dashoffset.
 * No hace falta cambiar nada de este componente salvo como se pintan las
 * palabras; la secuencia de animacion ya queda servida.
 */

interface Props {
  /** Renglones ya cortados en el servidor por lib/wrap.ts */
  lineas: string[];
  /** Tamano de la letra en unidades SVG. Lo define el tema. */
  size: number;
  /** Cuando pasa a true, arranca la escritura. */
  escribir: boolean;
}

const ANCHO = 292;

interface Palabra {
  text: SVGTextElement;
  rect: SVGRectElement;
  linea: number;
  baseY: number;
  x: number;
  w: number;
  y: number;
}

export default function CartaManuscrita({ lineas, size, escribir }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const palabrasRef = useRef<Palabra[]>([]);
  const nibRef = useRef<SVGEllipseElement | null>(null);
  const yaEscribio = useRef(false);

  const LH = Math.round(size * 1.85);
  const Y0 = size + 8;
  const alto = Y0 + (lineas.length - 1) * LH + size;

  /* -------- construir el SVG y medir cuando la fuente ya cargo -------- */
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const NS = 'http://www.w3.org/2000/svg';
    svg.innerHTML = '';
    const defs = document.createElementNS(NS, 'defs');
    svg.appendChild(defs);

    const palabras: Palabra[] = [];
    const uid = Math.random().toString(36).slice(2, 8);

    lineas.forEach((linea, li) => {
      if (!linea) return;
      const baseY = Y0 + li * LH;
      linea.split(' ').forEach((w) => {
        const id = `cp-${uid}-${palabras.length}`;

        const clip = document.createElementNS(NS, 'clipPath');
        clip.setAttribute('id', id);
        const rect = document.createElementNS(NS, 'rect');
        rect.setAttribute('height', String(LH));
        rect.setAttribute('width', '0');
        clip.appendChild(rect);
        defs.appendChild(clip);

        const g = document.createElementNS(NS, 'g');
        g.setAttribute('clip-path', `url(#${id})`);
        const text = document.createElementNS(NS, 'text');
        text.setAttribute('class', 'hw');
        text.setAttribute('font-size', String(size));
        text.textContent = w;
        g.appendChild(text);
        svg.appendChild(g);

        palabras.push({ text, rect, linea: li, baseY, x: 0, w: 0, y: baseY });
      });
    });

    const nib = document.createElementNS(NS, 'ellipse');
    nib.setAttribute('class', 'nib');
    nib.setAttribute('rx', '1.5');
    nib.setAttribute('ry', String(size * 0.16));
    svg.appendChild(nib);
    nibRef.current = nib;
    palabrasRef.current = palabras;

    // ruido reproducible: la misma carta se ve igual en cada visita
    let seed = 11;
    const rnd = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };

    const colocar = () => {
      const porLinea = new Map<number, Palabra[]>();
      palabras.forEach((p) => {
        const arr = porLinea.get(p.linea) ?? [];
        arr.push(p);
        porLinea.set(p.linea, arr);
      });
      seed = 11;
      porLinea.forEach((arr) => {
        let cursor = 5;
        arr.forEach((p) => {
          let w = 40;
          try { w = p.text.getComputedTextLength() || 40; } catch { /* sin layout aun */ }
          const dy = (rnd() - 0.5) * (size * 0.14);
          const ang = (rnd() - 0.5) * 2.4;
          const tinta = 0.86 + rnd() * 0.14;
          const y = p.baseY + dy;

          p.text.setAttribute('x', cursor.toFixed(1));
          p.text.setAttribute('y', y.toFixed(1));
          p.text.setAttribute('opacity', tinta.toFixed(2));
          p.text.setAttribute('transform', `rotate(${ang.toFixed(2)} ${(cursor + w / 2).toFixed(1)} ${y.toFixed(1)})`);
          p.rect.setAttribute('x', (cursor - 3).toFixed(1));
          p.rect.setAttribute('y', (y - size - 4).toFixed(1));

          p.x = cursor; p.w = w; p.y = y;
          cursor += w + size * 0.3;
        });
      });
    };

    // la fuente manuscrita casi nunca esta lista en el primer render
    document.fonts?.ready.then(colocar).catch(() => {});
    const t1 = setTimeout(colocar, 700);
    const t2 = setTimeout(colocar, 1800);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [lineas, size, LH, Y0]);

  /* ----------------------------- animar ----------------------------- */
  useEffect(() => {
    if (!escribir || yaEscribio.current) return;
    yaEscribio.current = true;

    const palabras = palabrasRef.current;
    const nib = nibRef.current;
    if (!palabras.length || !nib) return;

    const quieto = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (quieto) {
      palabras.forEach((p) => p.rect.setAttribute('width', String((p.w || ANCHO) + 8)));
      return;
    }

    nib.setAttribute('fill', getComputedStyle(document.documentElement).getPropertyValue('--ink').trim() || '#333');
    palabras.forEach((p) => p.rect.setAttribute('width', '0'));

    let i = 0;
    let raf = 0;
    let timer: ReturnType<typeof setTimeout>;

    const siguiente = () => {
      if (i >= palabras.length) { nib.style.opacity = '0'; return; }
      const p = palabras[i];
      if (!p.w) { p.rect.setAttribute('width', String(ANCHO)); i++; return siguiente(); }

      const dur = Math.max(150, p.w * 21);
      const t0 = performance.now();
      nib.style.opacity = '0.8';

      const paso = (ahora: number) => {
        const t = Math.min(1, (ahora - t0) / dur);
        p.rect.setAttribute('width', (p.w * t + 5).toFixed(1));
        nib.setAttribute('cx', (p.x + p.w * t).toFixed(1));
        // el vaiven vertical es lo que vuelve creible el trazo
        nib.setAttribute('cy', (p.y - 2 + Math.sin(t * Math.PI * 2.2) * (size * 0.14)).toFixed(1));
        if (t < 1) raf = requestAnimationFrame(paso);
        else { i++; timer = setTimeout(siguiente, 55 + Math.random() * 70); }
      };
      raf = requestAnimationFrame(paso);
    };
    siguiente();

    return () => { cancelAnimationFrame(raf); clearTimeout(timer); };
  }, [escribir, size]);

  return (
    <svg
      ref={svgRef}
      className="hw-svg"
      viewBox={`0 0 ${ANCHO} ${alto}`}
      role="img"
      aria-label={lineas.filter(Boolean).join(' ')}
    />
  );
}
