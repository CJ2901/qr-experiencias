'use client';

import { useEffect, useRef } from 'react';

/**
 * Carta manuscrita en SVG.
 *
 * Lo que la hace creible y no una fuente "de imitacion" pegada en un div:
 *  1. cada palabra es su propio <text>, con angulo, desvio vertical y
 *     opacidad de tinta propios  ->  la linea base deja de ser perfecta;
 *  2. cada renglon tiene ademas su propia deriva: la mano no vuelve nunca
 *     al mismo punto de partida;
 *  3. se revelan de a una, con pausas irregulares, mas largas al terminar
 *     un renglon;
 *  4. la punta de la pluma sube y baja mientras avanza dentro de cada palabra.
 *
 * POR QUE LOS RENGLONES SE VUELVEN A CORTAR AQUI
 * lib/wrap.ts corta por numero de caracteres, pensando en la serif del
 * tema. Una manuscrita es mucho mas ancha y muy irregular —"illa" ocupa un
 * tercio que "mamá"—, asi que ese corte dejaba renglones al 60% del papel
 * y un margen derecho enorme. Contar caracteres no puede saber cuanto mide
 * una palabra; medirla, si. Aqui se rearman los parrafos, se mide cada
 * palabra CON LA FUENTE YA CARGADA y se empaqueta cada renglon hasta donde
 * de el papel. El corte del servidor sigue sirviendo de reserva para el
 * primer pintado y para quien no cargue la fuente.
 *
 * Y despues se CENTRA cada renglon. Justificar seria lo otro, pero
 * estirar los espacios hasta cuadrar los dos bordes es exactamente lo que
 * una mano no hace: el borde derecho irregular es parte de que parezca
 * escrito. Centrando, el sobrante se reparte a los dos lados y la mancha
 * de texto queda equilibrada en la hoja.
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
/** Igual a los dos lados: el texto va centrado, no alineado a la izquierda. */
const MARGEN = 16;
const USABLE = ANCHO - MARGEN * 2;

interface Palabra {
  text: SVGTextElement;
  rect: SVGRectElement;
  linea: number;
  x: number;
  w: number;
  y: number;
  /** Compresion del renglon; la pluma tiene que respetarla. */
  esc: number;
}

export default function CartaManuscrita({ lineas, size, escribir }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const palabrasRef = useRef<Palabra[]>([]);
  const nibRef = useRef<SVGEllipseElement | null>(null);
  const arrancarRef = useRef<(() => void) | null>(null);
  const escribirRef = useRef(escribir);
  const yaEscribio = useRef(false);
  const revelado = useRef(false);

  escribirRef.current = escribir;

  const LH = Math.round(size * 1.85);
  const Y0 = size + 10;
  const altoEstimado = Y0 + Math.max(0, lineas.length - 1) * LH + Math.round(size * 1.15);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    let vivo = true;

    const NS = 'http://www.w3.org/2000/svg';

    /* ---- los parrafos, tal como los escribio quien regala ----
       Una cadena vacia en `lineas` es un salto de parrafo; el resto se
       vuelve a unir porque el corte por caracteres ya no nos sirve. */
    const parrafos: string[][] = [];
    let actual: string[] = [];
    lineas.forEach((l) => {
      if (!l.trim()) {
        if (actual.length) parrafos.push(actual);
        actual = [];
        return;
      }
      actual.push(...l.trim().split(/\s+/));
    });
    if (actual.length) parrafos.push(actual);

    const construir = async () => {
      /* ---- 1 · esperar la manuscrita de verdad ----
         Sin esto la primera medicion sale con la serif de reserva y todos
         los renglones quedan cortos: getComputedTextLength no sabe que la
         fuente buena todavia viene en camino. */
      const familia = getComputedStyle(svg).getPropertyValue('--hand').trim();
      const primera = familia.split(',')[0].trim() || 'cursive';
      try {
        await document.fonts?.load(`${size}px ${primera}`);
        await document.fonts?.ready;
      } catch {
        /* sin document.fonts se mide con lo que haya */
      }
      if (!vivo) return;

      /* ---- 2 · medir cada palabra ---- */
      svg.innerHTML = '';
      const regla = document.createElementNS(NS, 'text');
      regla.setAttribute('class', 'hw');
      regla.setAttribute('font-size', String(size));
      regla.setAttribute('visibility', 'hidden');
      svg.appendChild(regla);

      const medir = (t: string) => {
        regla.textContent = t;
        try {
          return regla.getComputedTextLength() || t.length * size * 0.5;
        } catch {
          return t.length * size * 0.5;
        }
      };

      const cache = new Map<string, number>();
      const ancho = (p: string) => {
        const v = cache.get(p);
        if (v !== undefined) return v;
        const w = medir(p);
        cache.set(p, w);
        return w;
      };

      // el espacio de una manuscrita es mas angosto que el de una serif
      const espacio = Math.max(size * 0.16, medir('n n') - 2 * medir('n'));

      /* ---- 3 · rearmar los renglones hasta donde da el papel ---- */
      type Renglon = { palabras: string[]; ancho: number } | null;
      const renglones: Renglon[] = [];

      parrafos.forEach((palabras, i) => {
        if (i > 0) renglones.push(null); // el aire entre parrafos
        let linea: string[] = [];
        let w = 0;
        palabras.forEach((p) => {
          const wp = ancho(p);
          const conEste = linea.length ? w + espacio + wp : wp;
          if (linea.length && conEste > USABLE) {
            renglones.push({ palabras: linea, ancho: w });
            linea = [p];
            w = wp;
          } else {
            linea.push(p);
            w = conEste;
          }
        });
        if (linea.length) renglones.push({ palabras: linea, ancho: w });
      });

      svg.removeChild(regla);
      if (!renglones.length) return;

      /* ---- 4 · el papel, ya con el alto real ---- */
      const alto = Y0 + (renglones.length - 1) * LH + Math.round(size * 1.15);
      svg.setAttribute('viewBox', `0 0 ${ANCHO} ${alto}`);

      const defs = document.createElementNS(NS, 'defs');
      svg.appendChild(defs);

      const papel = document.createElementNS(NS, 'g');
      papel.setAttribute('aria-hidden', 'true');
      renglones.forEach((_, li) => {
        const y = Y0 + li * LH + size * 0.22;
        const l = document.createElementNS(NS, 'line');
        l.setAttribute('class', 'regla');
        l.setAttribute('x1', String(MARGEN - 8));
        l.setAttribute('x2', String(ANCHO - MARGEN + 8));
        l.setAttribute('y1', y.toFixed(1));
        l.setAttribute('y2', y.toFixed(1));
        papel.appendChild(l);
      });
      svg.appendChild(papel);

      /* ---- 5 · colocar las palabras, cada renglon centrado ---- */
      // ruido reproducible: la misma carta se ve igual en cada visita
      let seed = 11;
      const rnd = () => {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        return seed / 0x7fffffff;
      };

      const palabras: Palabra[] = [];
      const uid = Math.random().toString(36).slice(2, 8);

      renglones.forEach((r, li) => {
        if (!r) return;
        const baseY = Y0 + li * LH;

        const g = document.createElementNS(NS, 'g');
        svg.appendChild(g);

        // Si un renglon se pasa (una palabra sola mas larga que el papel),
        // se aprieta. Apretar al final de la linea es de mano; salirse de
        // la hoja, no.
        const esc = r.ancho > USABLE ? Math.max(0.72, USABLE / r.ancho) : 1;
        if (esc !== 1) {
          g.setAttribute('transform', `translate(${MARGEN} 0) scale(${esc.toFixed(4)} 1) translate(${-MARGEN} 0)`);
        }

        // centrado, con una pizca de desvio: dos renglones no arrancan
        // nunca exactamente en el mismo punto
        const sobra = Math.max(0, USABLE - r.ancho);
        let cursor = MARGEN + sobra / 2 + (rnd() - 0.5) * Math.min(sobra, size * 0.5);
        const deriva = (rnd() - 0.5) * (size * 0.12);

        r.palabras.forEach((p) => {
          const id = `cp-${uid}-${palabras.length}`;
          const w = ancho(p);
          const dy = (rnd() - 0.5) * (size * 0.14);
          const ang = (rnd() - 0.5) * 2.4;
          const tinta = 0.84 + rnd() * 0.16;
          const y = baseY + deriva + dy;

          const clip = document.createElementNS(NS, 'clipPath');
          clip.setAttribute('id', id);
          const rect = document.createElementNS(NS, 'rect');
          rect.setAttribute('x', (cursor - 4).toFixed(1));
          rect.setAttribute('y', (y - size * 1.15).toFixed(1));
          rect.setAttribute('height', String(size * 1.95));
          rect.setAttribute('width', revelado.current ? String(w + 10) : '0');
          clip.appendChild(rect);
          defs.appendChild(clip);

          const gp = document.createElementNS(NS, 'g');
          gp.setAttribute('clip-path', `url(#${id})`);
          const text = document.createElementNS(NS, 'text');
          text.setAttribute('class', 'hw');
          text.setAttribute('font-size', String(size));
          text.setAttribute('x', cursor.toFixed(1));
          text.setAttribute('y', y.toFixed(1));
          text.setAttribute('opacity', tinta.toFixed(2));
          text.setAttribute('transform', `rotate(${ang.toFixed(2)} ${(cursor + w / 2).toFixed(1)} ${y.toFixed(1)})`);
          text.textContent = p;
          gp.appendChild(text);
          g.appendChild(gp);

          palabras.push({ text, rect, linea: li, x: cursor, w, y, esc });
          cursor += w + espacio;
        });
      });

      const nib = document.createElementNS(NS, 'ellipse');
      nib.setAttribute('class', 'nib');
      nib.setAttribute('rx', '1.4');
      nib.setAttribute('ry', String(size * 0.16));
      nib.style.opacity = '0';
      svg.appendChild(nib);

      nibRef.current = nib;
      palabrasRef.current = palabras;

      // La medicion tarda: puede que el sobre ya se haya abierto.
      if (escribirRef.current && !yaEscribio.current) arrancarRef.current?.();
    };

    construir();
    return () => { vivo = false; };
  }, [lineas, size, LH, Y0]);

  /* ----------------------------- animar ----------------------------- */
  useEffect(() => {
    let raf = 0;
    let timer: ReturnType<typeof setTimeout>;

    const arrancar = () => {
      if (yaEscribio.current) return;
      const palabras = palabrasRef.current;
      const nib = nibRef.current;
      if (!palabras.length || !nib) return; // aun midiendo; construir() reintenta
      yaEscribio.current = true;

      const revelar = (p: Palabra) => p.rect.setAttribute('width', String(p.w + 10));

      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        revelado.current = true;
        palabras.forEach(revelar);
        return;
      }

      const raiz = getComputedStyle(document.documentElement);
      nib.setAttribute(
        'fill',
        raiz.getPropertyValue('--tinta').trim() || raiz.getPropertyValue('--ink').trim() || '#333'
      );
      palabras.forEach((p) => p.rect.setAttribute('width', '0'));

      let i = 0;
      const siguiente = () => {
        if (i >= palabras.length) {
          revelado.current = true;
          nib.style.opacity = '0';
          return;
        }
        const p = palabras[i];
        if (!p.w) { revelar(p); i++; return siguiente(); }

        const dur = Math.max(150, p.w * 21);
        const t0 = performance.now();
        nib.style.opacity = '0.75';

        const paso = (ahora: number) => {
          const t = Math.min(1, (ahora - t0) / dur);
          p.rect.setAttribute('width', (p.w * t + 6).toFixed(1));
          // la pluma vive fuera del grupo del renglon: si el renglon se
          // comprimio, hay que aplicarle a mano la misma compresion
          nib.setAttribute('cx', (MARGEN + (p.x + p.w * t - MARGEN) * p.esc).toFixed(1));
          // el vaiven vertical es lo que vuelve creible el trazo
          nib.setAttribute('cy', (p.y - 2 + Math.sin(t * Math.PI * 2.2) * (size * 0.14)).toFixed(1));
          if (t < 1) raf = requestAnimationFrame(paso);
          else {
            revelar(p);
            i++;
            const finDeRenglon = palabras[i] && palabras[i].linea !== p.linea;
            timer = setTimeout(siguiente, (finDeRenglon ? 190 : 55) + Math.random() * 70);
          }
        };
        raf = requestAnimationFrame(paso);
      };
      siguiente();
    };

    arrancarRef.current = arrancar;
    if (escribir) arrancar();

    return () => { cancelAnimationFrame(raf); clearTimeout(timer); };
  }, [escribir, size]);

  return (
    <svg
      ref={svgRef}
      className="hw-svg"
      viewBox={`0 0 ${ANCHO} ${altoEstimado}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={lineas.filter(Boolean).join(' ')}
    />
  );
}
