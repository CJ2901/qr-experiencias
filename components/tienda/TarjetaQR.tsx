'use client';

import { useRef, useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';

/**
 * Tarjeta imprimible con el QR.
 *
 * La vista es HTML (nitida, seleccionable, responsive) y la descarga se
 * compone aparte en un <canvas> a 1080x1620 px. Componer en canvas y no
 * rasterizar el HTML evita la trampa clasica: al convertir un SVG a PNG
 * el navegador no embebe las fuentes y el texto sale con la tipografia
 * equivocada o directamente vacio.
 */

interface Props {
  url: string;
  destinatario: string;
  /** Frase impresa bajo el codigo. */
  invitacion?: string;
}

const ANCHO = 1080;
const ALTO = 1620;

export default function TarjetaQR({ url, destinatario, invitacion = 'Escanea para descubrir tu sorpresa' }: Props) {
  const oculto = useRef<HTMLDivElement>(null);
  const [copiado, setCopiado] = useState(false);
  const [generando, setGenerando] = useState(false);

  async function descargar() {
    const fuente = oculto.current?.querySelector('canvas') as HTMLCanvasElement | null;
    if (!fuente) return;
    setGenerando(true);
    try {
      await document.fonts.ready;

      const c = document.createElement('canvas');
      c.width = ANCHO;
      c.height = ALTO;
      const x = c.getContext('2d');
      if (!x) return;

      // fondo crema con un halo calido arriba
      x.fillStyle = '#F5F0E6';
      x.fillRect(0, 0, ANCHO, ALTO);
      const halo = x.createRadialGradient(ANCHO / 2, 120, 40, ANCHO / 2, 120, 760);
      halo.addColorStop(0, 'rgba(192,120,90,0.16)');
      halo.addColorStop(1, 'rgba(192,120,90,0)');
      x.fillStyle = halo;
      x.fillRect(0, 0, ANCHO, ALTO);

      // filete interior
      x.strokeStyle = 'rgba(123,45,38,0.35)';
      x.lineWidth = 3;
      x.strokeRect(54, 54, ANCHO - 108, ALTO - 108);

      x.textAlign = 'center';

      x.fillStyle = '#7B2D26';
      x.font = '500 34px Georgia, serif';
      x.fillText('P A R A', ANCHO / 2, 260);

      x.fillStyle = '#232019';
      x.font = 'italic 500 104px Georgia, serif';
      x.fillText(destinatario, ANCHO / 2, 380);

      // marco blanco del codigo
      const q = 620;
      const qx = (ANCHO - q) / 2;
      const qy = 500;
      x.fillStyle = '#FFFFFF';
      x.fillRect(qx - 36, qy - 36, q + 72, q + 72);
      x.drawImage(fuente, qx, qy, q, q);

      x.fillStyle = '#5A5045';
      x.font = '400 36px Georgia, serif';
      envolver(x, invitacion, ANCHO / 2, qy + q + 130, ANCHO - 260, 50);

      x.fillStyle = 'rgba(90,80,69,0.55)';
      x.font = '400 24px ui-monospace, Menlo, monospace';
      x.fillText(url.replace(/^https?:\/\//, ''), ANCHO / 2, ALTO - 130);

      const a = document.createElement('a');
      a.download = `qr-${destinatario.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`;
      a.href = c.toDataURL('image/png');
      a.click();
    } finally {
      setGenerando(false);
    }
  }

  function envolver(x: CanvasRenderingContext2D, texto: string, cx: number, cy: number, max: number, alto: number) {
    const palabras = texto.split(' ');
    const lineas: string[] = [];
    let actual = '';
    for (const p of palabras) {
      const prueba = actual ? `${actual} ${p}` : p;
      if (x.measureText(prueba).width > max && actual) {
        lineas.push(actual);
        actual = p;
      } else actual = prueba;
    }
    if (actual) lineas.push(actual);
    lineas.forEach((l, i) => x.fillText(l, cx, cy + i * alto));
  }

  async function copiar() {
    await navigator.clipboard.writeText(url);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  return (
    <div>
      {/* vista en pantalla */}
      <div className="mx-auto w-full max-w-xs rounded-2xl border-2 border-[#7B2D26]/25 bg-[#F5F0E6] px-8 py-10 text-center shadow-lg shadow-stone-300/40">
        <p className="text-[11px] font-medium tracking-[0.42em] text-[#7B2D26]">P A R A</p>
        <p className="mt-3 font-serif text-3xl italic text-[#232019]">{destinatario}</p>
        <div className="mx-auto mt-7 w-fit bg-white p-3.5 shadow-sm">
          <QRCodeCanvas value={url} size={168} level="M" marginSize={0} fgColor="#232019" bgColor="#FFFFFF" />
        </div>
        <p className="mt-6 font-serif text-sm leading-relaxed text-stone-600">{invitacion}</p>
        <p className="mt-5 break-all font-mono text-[10px] text-stone-400">
          {url.replace(/^https?:\/\//, '')}
        </p>
      </div>

      {/* copia a 1080 px que se dibuja en el PNG */}
      <div ref={oculto} className="pointer-events-none fixed -left-[9999px] top-0" aria-hidden>
        <QRCodeCanvas value={url} size={620} level="M" marginSize={0} fgColor="#232019" bgColor="#FFFFFF" />
      </div>

      <div className="mx-auto mt-6 flex max-w-xs flex-col gap-2.5">
        <button
          onClick={descargar}
          disabled={generando}
          className="rounded-xl bg-stone-900 px-5 py-3 text-sm font-semibold text-white hover:bg-stone-700 disabled:opacity-50"
        >
          {generando ? 'Generando…' : 'Descargar tarjeta (PNG)'}
        </button>
        <button
          onClick={copiar}
          className="rounded-xl border border-stone-300 px-5 py-3 text-sm font-medium hover:bg-stone-50"
        >
          {copiado ? 'Enlace copiado' : 'Copiar enlace'}
        </button>
      </div>

      <p className="mx-auto mt-3 max-w-xs text-center text-xs leading-relaxed text-stone-500">
        El PNG sale a 1080 × 1620 px: suficiente para imprimirlo en tarjeta de 10 × 15 cm.
      </p>
    </div>
  );
}
