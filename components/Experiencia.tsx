'use client';

import { useState } from 'react';
import CartaManuscrita from './CartaManuscrita';
import CarruselTema from './Carruseles';
import type { Tema } from '@/lib/temas';

export interface DatosPedido {
  ocasion: string;
  slug: string;
  destinatario: string;
  pareja: string | null;
  frase_principal: string;
  fecha_texto: string | null;
  frase_capitulo: string | null;
  frase_brindis: string | null;
  frase_final: string | null;
  emojis: string | null;
  texto_boton: string;
  voz_url: string | null;
  cancion_url: string | null;
  media_expira_en: string | null;
}

interface Props {
  pedido: DatosPedido;
  tema: Tema;
  /** Mensaje ya cortado en renglones por el servidor. */
  lineas: string[];
  /** URLs firmadas de la galeria. Vacio si la media ya se archivo. */
  fotos: string[];
  fotoFinal: string | null;
  /** true cuando media_expira_en ya paso: se muestra el rescate. */
  archivada: boolean;
}

const FRASES = [
  'Otra vez',
  'Algo se está encendiendo…',
  'Sigue, que esto se calienta',
  'Un poquito más',
  'No pares ahora',
  '¡La última vez!',
];
const TOTAL = FRASES.length;

export default function Experiencia({ pedido, tema, lineas, fotos, fotoFinal, archivada }: Props) {
  const [toques, setToques] = useState(0);
  const [abierto, setAbierto] = useState(false);
  const [pop, setPop] = useState(false);
  const [sobreAbierto, setSobreAbierto] = useState(false);
  const [escribiendo, setEscribiendo] = useState(false);
  const [guardado, setGuardado] = useState(false);

  const nivel = Math.min(100, (toques / TOTAL) * 100);

  function tocar() {
    if (abierto) return;
    const n = toques + 1;
    setToques(n);
    setPop(true);
    setTimeout(() => setPop(false), 130);
    if (n >= TOTAL) {
      setTimeout(() => {
        setAbierto(true);
        // el gesto del usuario es lo que habilita el audio en movil
        if (pedido.cancion_url) {
          const a = new Audio(pedido.cancion_url);
          a.volume = 0.6;
          a.loop = true;
          a.play().catch(() => {});
        }
      }, 420);
    }
  }

  function abrirSobre() {
    if (sobreAbierto) return;
    setSobreAbierto(true);
    // la carta tarda 1.1 s en aparecer (transicion CSS); escribimos despues
    setTimeout(() => setEscribiendo(true), 1250);
  }

  return (
    <div className="stage" data-tema={tema.id}>
      {/* ---------------------------------------------------- intro */}
      <div className="intro" data-fuera={abierto}>
        <p className="intro-nm">{pedido.destinatario}</p>
        <p className="intro-ms">{toques === 0 ? 'Toca el corazón' : FRASES[toques - 1]}</p>
        <button className="corazon" data-pop={pop} onClick={tocar} aria-label="Toca el corazón">
          ♥
        </button>
        <div className="barra"><i style={{ width: `${nivel}%` }} /></div>
        <p className="pct">{Math.round(nivel)}%</p>
      </div>

      {/* ------------------------------------------------ contenido */}
      <div className="frame" style={{ opacity: abierto ? 1 : 0, transition: 'opacity .7s ease' }}>
        {tema.deco === 'matasellos' && (
          <div className="matasellos" aria-hidden>
            <svg viewBox="0 0 60 60">
              <circle cx="30" cy="30" r="27" fill="none" stroke="currentColor" strokeWidth="1.6" />
              <circle cx="30" cy="30" r="21" fill="none" stroke="currentColor" strokeWidth=".8" strokeDasharray="3 3" />
              <text x="30" y="26" textAnchor="middle" fontFamily="Georgia, serif" fontSize="7" fill="currentColor">LIMA</text>
              <text x="30" y="37" textAnchor="middle" fontFamily="Georgia, serif" fontSize="8.5" fill="currentColor">
                {(pedido.fecha_texto ?? '').slice(0, 6) || '·'}
              </text>
            </svg>
          </div>
        )}

        <div className="pad">
          <div className="lead" dangerouslySetInnerHTML={{ __html: pedido.frase_principal }} />
          {pedido.fecha_texto && <p className="fecha">{pedido.fecha_texto}</p>}

          {tema.deco === 'ramita' && (
            <svg className="ramita" viewBox="0 0 70 22" fill="none" stroke="var(--acc)" strokeWidth="1" strokeLinecap="round" aria-hidden>
              <path d="M4 11 H66" />
              <path d="M14 11 q4-6 9-4" /><path d="M14 11 q4 6 9 4" />
              <path d="M27 11 q4-6 9-4" /><path d="M27 11 q4 6 9 4" />
              <path d="M40 11 q4-6 9-4" /><path d="M40 11 q4 6 9 4" />
              <circle cx="66" cy="11" r="2.2" fill="var(--acc2)" stroke="none" />
            </svg>
          )}

          <CarruselTema tipo={tema.carrusel} fotos={fotos} />

          {/* --------------------------------------- sobre y carta */}
          <div
            className="sobre"
            data-abierto={sobreAbierto}
            onClick={abrirSobre}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') abrirSobre(); }}
            aria-label="Abrir la carta"
          >
            <div className="solapa" />
            <div className="lacre">
              <Lacre tema={tema.id} />
              <div className="pista-sobre">Hay algo dentro para ti</div>
            </div>

            <div className="carta">
              {pedido.emojis && <div className="carta-emojis">{pedido.emojis}</div>}
              <CartaManuscrita lineas={lineas} size={tema.manoSize} escribir={escribiendo} />
              {pedido.frase_capitulo && (
                <div className="capitulo" dangerouslySetInnerHTML={{ __html: pedido.frase_capitulo }} />
              )}
            </div>
          </div>

          {/* ---------------------------------- voz leyendo la carta */}
          {pedido.voz_url && (
            <div className="audio">
              <button onClick={() => new Audio(pedido.voz_url!).play().catch(() => {})} aria-label="Escuchar la carta">
                ▶
              </button>
              <div className="et">
                <b>Escúchalo en su voz</b>
                <small>grabado para ti</small>
              </div>
            </div>
          )}

          {/* ------------------------------------------------ cierre */}
          <div className="brindis">🥂</div>
          {pedido.frase_brindis && (
            <p className="fin" dangerouslySetInnerHTML={{ __html: pedido.frase_brindis }} />
          )}

          {fotoFinal && <span className="foto foto-final" style={{ backgroundImage: `url(${fotoFinal})` }} />}

          {pedido.frase_final && (
            <p className="gracias" dangerouslySetInnerHTML={{ __html: pedido.frase_final }} />
          )}

          <button className="guardar" onClick={() => setGuardado(true)}>
            {guardado ? 'Guardado ♥' : pedido.texto_boton}
          </button>

          {(archivada || pedido.media_expira_en) && (
            <div className="caduca">
              <b>
                {archivada
                  ? 'Las fotos en alta de este regalo están archivadas'
                  : `Las fotos en alta se archivan el ${new Date(pedido.media_expira_en!).toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric' })}`}
              </b>
              <span>
                La carta y la canción se quedan siempre. Puedes recuperar los archivos originales
                en alta resolución cuando quieras.
              </span>
            </div>
          )}

          <p className="pie-final">Hecho con amor</p>
        </div>
      </div>
    </div>
  );
}

/* Sello de lacre. En Editorial no hay cera: un marco y una flecha. */
function Lacre({ tema }: { tema: string }) {
  if (tema === 'editorial') {
    return (
      <svg width="56" height="56" viewBox="0 0 60 60" aria-hidden>
        <rect x="4" y="4" width="52" height="52" fill="none" stroke="var(--acc)" strokeWidth="2" />
        <path d="M18 26 L30 36 L42 26" fill="none" stroke="var(--acc)" strokeWidth="2" />
      </svg>
    );
  }
  const uid = tema.replace(/[^a-z]/g, '');
  return (
    <svg width="78" height="78" viewBox="0 0 90 90" aria-hidden>
      <defs>
        <radialGradient id={`cera-${uid}`} cx="36%" cy="32%" r="62%">
          <stop offset="0%" stopColor="#B22626" />
          <stop offset="40%" stopColor="#8A1515" />
          <stop offset="100%" stopColor="#4A0808" />
        </radialGradient>
        <filter id={`cera-f-${uid}`}>
          <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="3" seed="4" />
          <feDisplacementMap in="SourceGraphic" scale="3.2" />
        </filter>
      </defs>
      <g filter={`url(#cera-f-${uid})`}>
        <circle cx="45" cy="45" r="36" fill={`url(#cera-${uid})`} />
      </g>
      <circle cx="45" cy="45" r="33" fill="none" stroke="rgba(255,200,180,.2)" strokeWidth="1.4" />
      <text x="45" y="49" textAnchor="middle" fontFamily="Georgia, serif" fontSize="10" fontStyle="italic" fill="rgba(255,214,194,.94)">
        Descúbrelo
      </text>
    </svg>
  );
}
