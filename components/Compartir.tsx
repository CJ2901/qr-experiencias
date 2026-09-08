'use client';

import { useEffect, useState } from 'react';

/**
 * "Compartir este momento".
 *
 * Tres caminos, en este orden:
 *  1. el menu nativo del sistema (navigator.share) — en movil es el bueno;
 *  2. WhatsApp directo, que es por donde se comparte esto en Peru;
 *  3. copiar el enlace, que es el que nunca falla.
 *
 * El enlace se lee de window.location en el navegador y no se pasa desde
 * el servidor: asi funciona igual en localhost, en la preview de Vercel y
 * en el dominio final, sin depender de NEXT_PUBLIC_SITE_URL.
 */

export default function Compartir({
  etiqueta,
  titulo,
}: {
  etiqueta: string;
  titulo: string;
}) {
  const [url, setUrl] = useState('');
  const [abierto, setAbierto] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [hayNativo, setHayNativo] = useState(false);

  useEffect(() => {
    setUrl(window.location.href);
    setHayNativo(typeof navigator !== 'undefined' && !!navigator.share);
  }, []);

  const texto = `${titulo} — mira lo que hice para ti`;

  async function compartir() {
    if (hayNativo) {
      try {
        await navigator.share({ title: titulo, text: texto, url });
        return;
      } catch {
        // El usuario cerro el menu: caemos a las opciones de abajo.
      }
    }
    setAbierto((v) => !v);
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Safari sin permiso de portapapeles: al menos lo dejamos seleccionable.
      const campo = document.createElement('textarea');
      campo.value = url;
      document.body.appendChild(campo);
      campo.select();
      document.execCommand('copy');
      campo.remove();
    }
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2200);
  }

  return (
    <div className="compartir">
      <button className="guardar" onClick={compartir}>
        {etiqueta}
      </button>

      {abierto && (
        <div className="compartir-menu">
          <a
            className="compartir-op"
            href={`https://wa.me/?text=${encodeURIComponent(`${texto}\n${url}`)}`}
            target="_blank"
            rel="noreferrer"
          >
            <span className="compartir-ic" aria-hidden>
              <svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor">
                <path d="M12 2a10 10 0 0 0-8.6 15l-1.3 4.7 4.8-1.3A10 10 0 1 0 12 2Zm5.8 14.2c-.2.7-1.2 1.3-1.9 1.4-.5.1-1.2.2-3.5-.7-2.9-1.2-4.8-4.2-5-4.4-.1-.2-1.1-1.5-1.1-2.9s.7-2 1-2.3c.2-.3.5-.4.7-.4h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.4 0 .5l-.3.5-.3.3c-.1.1-.2.3-.1.5.2.3.8 1.3 1.7 2.1 1.1 1 2 1.3 2.3 1.4.2.1.4.1.5-.1l.8-1c.2-.2.3-.2.5-.1l2 .9c.2.1.4.2.4.3.1.2.1.7-.1 1.5Z" />
              </svg>
            </span>
            Enviar por WhatsApp
          </a>

          <button className="compartir-op" onClick={copiar}>
            <span className="compartir-ic" aria-hidden>
              <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8">
                <rect x="9" y="9" width="11" height="11" rx="2" />
                <path d="M5 15V5a2 2 0 0 1 2-2h10" />
              </svg>
            </span>
            {copiado ? '¡Enlace copiado!' : 'Copiar el enlace'}
          </button>
        </div>
      )}
    </div>
  );
}
