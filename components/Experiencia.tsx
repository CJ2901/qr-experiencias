'use client';

import { useEffect, useRef, useState } from 'react';
import CartaManuscrita from './CartaManuscrita';
import CarruselTema from './Carruseles';
import Celebracion from './Celebracion';
import Compartir from './Compartir';
import Visor from './Visor';
import type { Tema } from '@/lib/temas';
import { fechaCorta } from '@/lib/fechas';

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
}

interface Props {
  pedido: DatosPedido;
  tema: Tema;
  /** Mensaje ya cortado en renglones por el servidor. */
  lineas: string[];
  /** URLs firmadas de la galeria. Vacio si la media ya se archivo. */
  fotos: string[];
  fotoFinal: string | null;
  /**
   * Vista previa del editor: sin boton de compartir. Compartiria la URL
   * actual, que en el editor es el enlace SECRETO de edicion.
   */
  vistaPrevia?: boolean;
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

/**
 * El texto viejo por defecto en la base. Cuando un pedido todavia lo
 * lleva, se muestra el nuevo: el boton ya no guarda nada, comparte.
 * (Para los pedidos nuevos, cambia el default de pedidos.texto_boton.)
 */
const BOTON_VIEJO = 'Guardar este momento';
const BOTON_COMPARTIR = 'Compartir este momento';

/**
 * La pagina del regalo.
 *
 * NOTA SOBRE LA CADUCIDAD: aqui ya no se avisa de cuando se archivan las
 * fotos. Es informacion de la compra, no del regalo, y leerla justo
 * despues de la carta rompia el momento. Vive donde corresponde: en
 * "Mis pedidos", que es del comprador.
 */
export default function Experiencia({ pedido, tema, lineas, fotos, fotoFinal, vistaPrevia = false }: Props) {
  const [toques, setToques] = useState(0);
  const [abierto, setAbierto] = useState(false);
  const [pop, setPop] = useState(false);
  const [sobreAbierto, setSobreAbierto] = useState(false);
  const [escribiendo, setEscribiendo] = useState(false);
  const [celebrando, setCelebrando] = useState(false);
  /** Que fotos ve el visor y por cual abre. null = cerrado. */
  const [visor, setVisor] = useState<{ fotos: string[]; idx: number } | null>(null);

  const nivel = Math.min(100, (toques / TOTAL) * 100);

  /**
   * La musica arranca al COMPLETAR los toques, cuando se abre el regalo.
   * Se llama dentro del mismo toque (no en un setTimeout): los navegadores
   * moviles solo dejan sonar audio que empieza en un gesto del usuario.
   */
  const audio = useRef<HTMLAudioElement | null>(null);
  const voz = useRef<HTMLAudioElement | null>(null);
  const [silencio, setSilencio] = useState(false);
  const [sonando, setSonando] = useState(false);

  /**
   * El sonido vive solo en esta pestana: si la persona cambia de app, de
   * pestana o sale de la pagina, todo se pausa; al volver, la musica sigue
   * donde iba (la voz no: se vuelve a tocar a mano). Al desmontar (p. ej.
   * cerrar la vista previa del editor) se detiene del todo.
   */
  useEffect(() => {
    const alCambiar = () => {
      const a = audio.current;
      if (document.hidden) {
        a?.pause();
        voz.current?.pause();
      } else if (a && a.paused && !a.muted) {
        a.play().catch(() => {});
      }
    };
    const alSalir = () => {
      audio.current?.pause();
      voz.current?.pause();
    };
    document.addEventListener('visibilitychange', alCambiar);
    window.addEventListener('pagehide', alSalir);
    return () => {
      document.removeEventListener('visibilitychange', alCambiar);
      window.removeEventListener('pagehide', alSalir);
      alSalir();
    };
  }, []);

  /** La voz manda: mientras suena, la musica baja casi a cero. */
  function tocarVoz() {
    if (!pedido.voz_url) return;
    if (voz.current && !voz.current.paused) {
      voz.current.pause();
      return;
    }
    const v = voz.current ?? new Audio(pedido.voz_url);
    voz.current = v;
    const musica = audio.current;
    const restaurar = () => {
      setSonando(false);
      if (musica) musica.volume = 0.6;
    };
    v.onpause = restaurar;
    v.onended = restaurar;
    v.onplay = () => {
      setSonando(true);
      if (musica) musica.volume = 0.12;
    };
    v.play().catch(restaurar);
  }

  function empezarMusica() {
    if (audio.current || !pedido.cancion_url) return;
    const a = new Audio(pedido.cancion_url);
    a.loop = true;
    a.volume = 0;
    audio.current = a;
    a.play()
      .then(() => {
        // entrada suave en ~1.5 s, no de golpe
        let v = 0;
        const t = setInterval(() => {
          v = Math.min(0.6, v + 0.04);
          a.volume = v;
          if (v >= 0.6) clearInterval(t);
        }, 100);
      })
      .catch(() => {
        audio.current = null; // archivo faltante o bloqueado: el regalo sigue sin musica
      });
  }

  function alternarSilencio() {
    const a = audio.current;
    if (!a) return;
    a.muted = !a.muted;
    setSilencio(a.muted);
  }

  function tocar() {
    if (abierto) return;
    const n = toques + 1;
    setToques(n);
    setPop(true);
    setTimeout(() => setPop(false), 130);
    if (n >= TOTAL) {
      empezarMusica(); // dentro del ultimo toque: es el gesto que habilita el audio
      setTimeout(() => setAbierto(true), 420);
    }
  }

  function abrirSobre() {
    if (sobreAbierto) return;
    setSobreAbierto(true);
    setCelebrando(true);
    // la solapa tarda .75 s en abrirse (transicion CSS); escribimos despues
    setTimeout(() => setEscribiendo(true), 1000);
  }

  return (
    <div className="stage" data-tema={tema.id}>
      {pedido.cancion_url && abierto && (
        <button
          type="button"
          className="musica-btn"
          onClick={alternarSilencio}
          aria-label={silencio ? 'Activar música' : 'Silenciar música'}
          aria-pressed={silencio}
        >
          ♪
        </button>
      )}
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
                {fechaCorta(pedido.fecha_texto) || '·'}
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

          <CarruselTema
            tipo={tema.carrusel}
            fotos={fotos}
            onAbrir={(idx) => setVisor({ fotos, idx })}
          />

          {/* --------------------------------------- sobre y carta */}
          <div className="sobre" data-abierto={sobreAbierto}>
            <button
              className="sobre-cerrado"
              onClick={abrirSobre}
              aria-label="Abrir la carta"
              aria-expanded={sobreAbierto}
            >
              <span className="sobre-cuerpo" aria-hidden />
              <span className="sobre-bolsa" aria-hidden />
              <span className="sobre-solapa" aria-hidden />
              <span className="sobre-lacre">
                <Lacre tema={tema.id} />
              </span>
              <span className="sobre-pista">Hay algo dentro para ti</span>
            </button>

            {celebrando && (
              <Celebracion tema={tema.id} onFin={() => setCelebrando(false)} />
            )}

            <div className="carta">
              {/* .carta abre y cierra (max-height); .carta-hoja es el papel.
                  Separarlos es lo que permite animar la hoja saliendo del
                  sobre sin pelearse con la transicion de apertura. */}
              <div className="carta-hoja">
                {pedido.emojis && <div className="carta-emojis">{pedido.emojis}</div>}
                <CartaManuscrita lineas={lineas} size={tema.manoSize} escribir={escribiendo} />
                {pedido.frase_capitulo && (
                  <div className="capitulo" dangerouslySetInnerHTML={{ __html: pedido.frase_capitulo }} />
                )}
              </div>
            </div>
          </div>

          {/* ---------------------------------- voz leyendo la carta */}
          {pedido.voz_url && (
            <div className="audio">
              <button onClick={tocarVoz} aria-label={sonando ? 'Pausar la voz' : 'Escuchar la carta'}>
                {sonando ? '❚❚' : '▶'}
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

          {fotoFinal && (
            <button
              className="marco-final"
              onClick={() => setVisor({ fotos: [fotoFinal], idx: 0 })}
              aria-label="Ver la foto completa"
            >
              <span className="foto foto-final" style={{ backgroundImage: `url(${fotoFinal})` }} />
              <span className="marco-pie">toca para verla completa</span>
            </button>
          )}

          {pedido.frase_final && (
            <p className="gracias" dangerouslySetInnerHTML={{ __html: pedido.frase_final }} />
          )}

          {!vistaPrevia && (
            <Compartir
              etiqueta={
                !pedido.texto_boton || pedido.texto_boton === BOTON_VIEJO
                  ? BOTON_COMPARTIR
                  : pedido.texto_boton
              }
              titulo={pedido.pareja || pedido.destinatario}
            />
          )}

          <p className="pie-final">Hecho con amor</p>
        </div>
      </div>

      {visor && (
        <Visor fotos={visor.fotos} inicial={visor.idx} onCerrar={() => setVisor(null)} />
      )}
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
