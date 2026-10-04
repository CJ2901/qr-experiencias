'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  guardarBorrador,
  urlDeSubida,
  urlDelOriginal,
  publicarPedido,
  type Borrador,
} from '@/app/actions/pedido';
import type { ConfigFormulario, Encuadre } from '@/lib/formularios';
import { prepararImagen } from '@/lib/imagen';
import Recortador from './Recortador';

/** El enlace firmado del correo: es la unica autorizacion que hay. */
export interface AccesoPedido {
  id: string;
  firma: string;
}

/**
 * La dedicatoria, por partes. Decisiones deliberadas:
 *  - se guarda al AVANZAR, no al final: si el cliente cierra no pierde nada;
 *  - los textos de ayuda y los ejemplos salen de `config` (plantilla +
 *    ocasion), no estan escritos aqui;
 *  - toda foto se puede re-encuadrar con zoom, siempre desde el ORIGINAL,
 *    con la forma exacta que tendra en la plantilla.
 */

interface Props {
  acceso: AccesoPedido;
  config: ConfigFormulario;
  maxChars: number;
  /** Vienen de la plantilla, no de una constante: se afinan sin desplegar. */
  limites: { min: number; max: number };
  /** ruta del bucket → URL firmada. El bucket es privado: sin esto no hay miniatura. */
  previews: Record<string, string>;
  inicial: Required<Omit<Borrador, 'foto_final'>> & { foto_final: string | null };
}

const PARTES = ['Para quién', 'La carta', 'Las fotos', 'Revisar'] as const;

/** Que foto se esta encuadrando y con que forma. */
interface Ajuste {
  ruta: string;
  src: string;
  encuadre: Encuadre;
  /** true si la imagen es un ObjectURL local que hay que liberar al cerrar. */
  local: boolean;
}

export default function FormularioGuiado({ acceso, config, maxChars, limites, previews, inicial }: Props) {
  const router = useRouter();
  const [parte, setParte] = useState(0);
  const [d, setD] = useState(inicial);
  /**
   * Miniaturas de lo recien subido o recortado. La URL firmada solo llega
   * en el siguiente render del servidor; mientras tanto se muestra el
   * archivo local, que es lo que el cliente espera ver al instante.
   */
  const [locales, setLocales] = useState<Record<string, string>>({});
  const miniatura = (ruta: string) => locales[ruta] ?? previews[ruta];
  const [error, setError] = useState('');
  const [subiendo, setSubiendo] = useState(false);
  const [ajuste, setAjuste] = useState<Ajuste | null>(null);
  const [guardando, empezar] = useTransition();

  const set = <K extends keyof typeof d>(k: K, v: (typeof d)[K]) => setD((prev) => ({ ...prev, [k]: v }));

  function validar(n: number): string {
    if (n === 0) {
      if (!d.destinatario.trim()) return 'Pon el nombre de quien va a recibirlo.';
      if (!d.frase_principal.trim()) return 'Falta la frase de portada.';
    }
    if (n === 1) {
      if (d.mensaje.trim().length < 20) return 'La carta es muy corta. Escribe al menos un par de líneas.';
      if (config.finalDestacada && !d.frase_final.trim()) return `Falta ${config.finalDestacada.etiqueta.toLowerCase()}.`;
    }
    if (n === 2 && d.fotos.length < limites.min) {
      const faltan = limites.min - d.fotos.length;
      return `Faltan ${faltan} foto${faltan === 1 ? '' : 's'}: la galería necesita al menos ${limites.min}.`;
    }
    return '';
  }

  function avanzar() {
    const e = validar(parte);
    if (e) return setError(e);
    setError('');
    empezar(async () => {
      const r = await guardarBorrador(acceso, d);
      if (!r.ok) return setError(r.error);
      setParte((p) => Math.min(p + 1, PARTES.length - 1));
    });
  }

  /** Sube un blob a una URL firmada. Devuelve la ruta o null. */
  async function subirBlob(blob: Blob, nombre: string, recorteDe?: string): Promise<string | null> {
    const r = await urlDeSubida(acceso, nombre, recorteDe);
    if (!r.ok) {
      setError(r.error);
      return null;
    }
    const res = await fetch(r.signedUrl, {
      method: 'PUT',
      body: blob,
      headers: { 'content-type': blob.type || 'image/jpeg' },
    });
    if (!res.ok) {
      setError('No se pudo subir la foto. Revisa tu conexión e inténtalo de nuevo.');
      return null;
    }
    setLocales((prev) => ({ ...prev, [r.ruta]: URL.createObjectURL(blob) }));
    return r.ruta;
  }

  async function subir(archivos: FileList | null, final = false) {
    if (!archivos?.length) return;
    setError('');
    setSubiendo(true);
    try {
      const nuevas: string[] = [];
      const cupo = final ? 1 : limites.max - d.fotos.length;

      for (const file of Array.from(archivos).slice(0, Math.max(cupo, 0))) {
        if (file.size > 20 * 1024 * 1024) {
          setError(`"${file.name}" pesa más de 20 MB. Elige otra.`);
          continue;
        }
        // Reducida y sin EXIF (incluida la ubicacion GPS) antes de salir del celular.
        const lista = await prepararImagen(file);
        const ruta = await subirBlob(lista, file.name.replace(/\.[^.]+$/, '') + '.jpg');
        if (!ruta) break;
        nuevas.push(ruta);
      }

      if (nuevas.length) {
        const campos: Borrador = final ? { foto_final: nuevas[0] } : { fotos: [...d.fotos, ...nuevas] };
        setD((prev) => ({ ...prev, ...campos }) as typeof prev);
        await guardarBorrador(acceso, campos);
        // Una sola foto: ofrecer el encuadre de una vez, que es el momento natural.
        if (nuevas.length === 1) abrirAjuste(nuevas[0], final ? config.fotoFinal : config.galeria);
      }
    } finally {
      setSubiendo(false);
    }
  }

  /** Abre el recortador partiendo del ORIGINAL de esa foto. */
  async function abrirAjuste(ruta: string, encuadre: Encuadre) {
    setError('');
    const r = await urlDelOriginal(acceso, ruta);
    if (!r.ok) return setError(r.error);
    try {
      // Se descarga como blob: un <img> de otro origen "ensucia" el canvas
      // y no dejaria exportar el recorte.
      const blob = await (await fetch(r.url)).blob();
      setAjuste({ ruta, src: URL.createObjectURL(blob), encuadre, local: true });
    } catch {
      setError('No se pudo abrir la foto para ajustarla. Inténtalo de nuevo.');
    }
  }

  function cerrarAjuste() {
    if (ajuste?.local) URL.revokeObjectURL(ajuste.src);
    setAjuste(null);
  }

  async function guardarAjuste(recorte: Blob) {
    if (!ajuste) return;
    const nueva = await subirBlob(recorte, 'recorte.jpg', ajuste.ruta);
    if (!nueva) return;
    const esFinal = d.foto_final === ajuste.ruta;
    const campos: Borrador = esFinal
      ? { foto_final: nueva }
      : { fotos: d.fotos.map((f) => (f === ajuste.ruta ? nueva : f)) };
    setD((prev) => ({ ...prev, ...campos }) as typeof prev);
    await guardarBorrador(acceso, campos);
    cerrarAjuste();
  }

  async function quitarFoto(ruta: string) {
    const fotos = d.fotos.filter((f) => f !== ruta);
    set('fotos', fotos);
    await guardarBorrador(acceso, { fotos });
  }

  function publicar() {
    setError('');
    empezar(async () => {
      await guardarBorrador(acceso, d);
      const r = await publicarPedido(acceso);
      if (!r.ok) return setError(r.error);
      // La misma URL ahora muestra el QR: el estado ya es 'listo'.
      router.refresh();
    });
  }

  const campo =
    'mt-1.5 w-full rounded-xl border border-stone-300 px-3.5 py-2.5 text-[15px] outline-none focus:border-stone-900';
  const ayuda = 'mt-1 block text-xs leading-relaxed text-stone-500';

  /**
   * Miniatura con la MISMA forma que tendra en la plantilla. Es una funcion
   * y no un componente: definido dentro del render, React lo montaria de
   * nuevo en cada tecla y las fotos parpadearian.
   */
  const miniaturaDe = (ruta: string, encuadre: Encuadre, onQuitar?: () => void) => (
    <div key={ruta} className="relative overflow-hidden rounded-lg bg-stone-200" style={{ aspectRatio: encuadre.aspecto }}>
      {miniatura(ruta) ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img src={miniatura(ruta)} alt="" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <span className="absolute inset-0 grid place-items-center text-[10px] text-stone-500">Foto</span>
      )}
      <button
        type="button"
        onClick={() => abrirAjuste(ruta, encuadre)}
        className="absolute inset-x-1 bottom-1 rounded-md bg-white/90 py-1 text-[11px] font-medium text-stone-800 shadow"
      >
        Ajustar
      </button>
      {onQuitar && (
        <button
          type="button"
          onClick={onQuitar}
          className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-white/90 text-sm text-stone-700 shadow"
          aria-label="Quitar foto"
        >
          &times;
        </button>
      )}
    </div>
  );

  type Frase = 'frase_capitulo' | 'frase_brindis' | 'frase_final';
  const cierre: [Frase, string, string][] = [
    ['frase_capitulo', 'Después de la carta', config.capitulo],
    ['frase_brindis', 'Junto al brindis', config.brindis],
  ];
  // En una propuesta la frase final ya se pidio arriba, destacada.
  if (!config.finalDestacada) cierre.push(['frase_final', 'Despedida', config.final]);
  const frasesCierre = cierre.map(([k, etiqueta, ph]) => (
    <label key={k} className="block text-sm">
      <span className="text-stone-600">{etiqueta}</span>
      <input className={campo} value={d[k]} onChange={(e) => set(k, e.target.value)} placeholder={ph} maxLength={90} />
    </label>
  ));

  return (
    <div className="mt-8">
      {/* progreso (sin numeros, a proposito) */}
      <ol className="flex gap-1.5" aria-label="Progreso">
        {PARTES.map((nombre, i) => (
          <li key={nombre} className="flex-1">
            <div className={`h-1 rounded-full ${i <= parte ? 'bg-stone-900' : 'bg-stone-200'}`} />
            <span className={`mt-1.5 block text-[11px] ${i === parte ? 'font-medium text-stone-900' : 'text-stone-400'}`}>
              {nombre}
            </span>
          </li>
        ))}
      </ol>

      <div className="mt-8 space-y-5">
        {/* ---------- para quién ---------- */}
        {parte === 0 && (
          <>
            <label className="block text-sm">
              <span className="font-medium text-stone-800">¿Cómo se llama?</span>
              <input
                className={campo}
                value={d.destinatario}
                onChange={(e) => set('destinatario', e.target.value)}
                placeholder="Cris"
                maxLength={40}
                autoFocus
              />
              <span className={ayuda}>Es lo primero que va a ver, en grande.</span>
            </label>

            <label className="block text-sm">
              <span className="font-medium text-stone-800">Frase de portada</span>
              <input
                className={campo}
                value={d.frase_principal}
                onChange={(e) => set('frase_principal', e.target.value)}
                placeholder={config.portada}
                maxLength={90}
              />
              {config.ayudaFrases && <span className={ayuda}>{config.ayudaFrases}</span>}
            </label>

            <label className="block text-sm">
              <span className="font-medium text-stone-800">
                Fecha <span className="font-normal text-stone-400">(opcional)</span>
              </span>
              <input
                className={campo}
                value={d.fecha_texto}
                onChange={(e) => set('fecha_texto', e.target.value)}
                placeholder={config.fecha}
                maxLength={config.maxFecha}
              />
              <span className={ayuda}>{config.ayudaFecha}</span>
            </label>
          </>
        )}

        {/* ---------- la carta ---------- */}
        {parte === 1 && (
          <>
            <label className="block text-sm">
              <span className="font-medium text-stone-800">La carta</span>
              <textarea
                className={`${campo} min-h-44 leading-relaxed`}
                value={d.mensaje}
                onChange={(e) => set('mensaje', e.target.value)}
                placeholder={`${config.carta}\n\nDeja una línea en blanco para separar párrafos.`}
                maxLength={900}
                autoFocus
              />
              <span className="mt-1 flex justify-between text-xs text-stone-500">
                <span>No cortes los renglones: lo hacemos nosotros, a {maxChars} caracteres.</span>
                <span className="tabular-nums">{d.mensaje.length}/900</span>
              </span>
            </label>

            {config.finalDestacada && (
              <label className="block rounded-xl border border-rose-200 bg-rose-50/60 p-4 text-sm">
                <span className="font-medium text-stone-900">{config.finalDestacada.etiqueta}</span>
                <input
                  className={`${campo} bg-white`}
                  value={d.frase_final}
                  onChange={(e) => set('frase_final', e.target.value)}
                  placeholder={config.final}
                  maxLength={90}
                />
                <span className={ayuda}>{config.finalDestacada.ayuda}</span>
              </label>
            )}

            <details className="rounded-xl border border-stone-200 bg-white p-4">
              <summary className="cursor-pointer text-sm font-medium text-stone-800">
                Frases del cierre <span className="font-normal text-stone-400">(opcional)</span>
              </summary>
              <div className="mt-4 space-y-4">{frasesCierre}</div>
            </details>
          </>
        )}

        {/* ---------- las fotos ---------- */}
        {parte === 2 && (
          <>
            <div>
              <p className="text-sm font-medium text-stone-800">
                Fotos de la galería{' '}
                <span className={d.fotos.length < limites.min ? 'font-semibold text-rose-700' : 'font-normal text-stone-500'}>
                  ({d.fotos.length} de {limites.max} · mínimo {limites.min})
                </span>
              </p>
              <p className={ayuda}>{config.ayudaFotos} Toca «Ajustar» para acercar o mover cualquier foto.</p>

              <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
                {d.fotos.map((ruta) => (
                  miniaturaDe(ruta, config.galeria, () => quitarFoto(ruta))
                ))}
                {d.fotos.length < limites.max && (
                  <label
                    className="grid cursor-pointer place-items-center rounded-lg border-2 border-dashed border-stone-300 text-2xl text-stone-400 hover:border-stone-500"
                    style={{ aspectRatio: config.galeria.aspecto }}
                  >
                    {subiendo ? <span className="text-xs">Subiendo…</span> : '+'}
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        subir(e.target.files);
                        e.target.value = '';
                      }}
                      disabled={subiendo}
                    />
                  </label>
                )}
              </div>
            </div>

            <div className="border-t border-stone-100 pt-5">
              <p className="text-sm font-medium text-stone-800">
                Foto de cierre <span className="font-normal text-stone-400">(opcional)</span>
              </p>
              <p className={ayuda}>Va al final, a lo ancho. Una foto de los dos funciona muy bien.</p>
              <div className="mt-3 max-w-xs">
                {d.foto_final ? (
                  miniaturaDe(d.foto_final, config.fotoFinal, () => {
                    set('foto_final', null);
                    guardarBorrador(acceso, { foto_final: null });
                  })
                ) : (
                  <label
                    className="grid cursor-pointer place-items-center rounded-lg border-2 border-dashed border-stone-300 text-2xl text-stone-400 hover:border-stone-500"
                    style={{ aspectRatio: config.fotoFinal.aspecto }}
                  >
                    {subiendo ? <span className="text-xs">Subiendo…</span> : '+'}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        subir(e.target.files, true);
                        e.target.value = '';
                      }}
                      disabled={subiendo}
                    />
                  </label>
                )}
              </div>
            </div>
          </>
        )}

        {/* ---------- revisar ---------- */}
        {parte === 3 && (
          <div className="space-y-4">
            <dl className="divide-y divide-stone-100 rounded-xl border border-stone-200 bg-white text-sm">
              {(
                [
                  ['Para', d.destinatario],
                  ['Portada', d.frase_principal],
                  ['Fecha', d.fecha_texto || '—'],
                  ...(config.finalDestacada ? [[config.finalDestacada.etiqueta, d.frase_final || '—']] : []),
                  ['Fotos', `${d.fotos.length} en la galería${d.foto_final ? ' + cierre' : ''}`],
                ] as const
              ).map(([k, v]) => (
                <div key={k} className="flex gap-4 px-4 py-3">
                  <dt className="w-24 shrink-0 text-stone-500">{k}</dt>
                  <dd className="text-stone-900">{v}</dd>
                </div>
              ))}
              <div className="px-4 py-3">
                <dt className="text-stone-500">La carta</dt>
                <dd className="mt-1.5 whitespace-pre-line leading-relaxed text-stone-900">{d.mensaje}</dd>
              </div>
            </dl>

            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <p className="font-medium">Léelo una vez más antes de publicar.</p>
              <p className="mt-1 leading-relaxed">
                Así como lo ves aquí es como le llegará. Revisa con calma los nombres, la fecha y
                cómo se ve cada foto; después de publicar ya no se puede cambiar.
              </p>
            </div>
          </div>
        )}

        {error && (
          <p className="rounded-lg bg-rose-50 px-3.5 py-2.5 text-sm text-rose-900" role="alert">
            {error}
          </p>
        )}

        {/* ---------- navegación ---------- */}
        <div className="flex items-center justify-between gap-3 pt-2">
          <button
            type="button"
            onClick={() => {
              setError('');
              setParte((p) => Math.max(0, p - 1));
            }}
            disabled={parte === 0 || guardando}
            className="text-sm text-stone-500 hover:text-stone-900 disabled:invisible"
          >
            &larr; Atrás
          </button>

          {parte < PARTES.length - 1 ? (
            <button
              type="button"
              onClick={avanzar}
              disabled={guardando || subiendo}
              className="rounded-xl bg-stone-900 px-6 py-3 text-sm font-semibold text-white hover:bg-stone-700 disabled:opacity-50"
            >
              {guardando ? 'Guardando…' : 'Continuar'}
            </button>
          ) : (
            <button
              type="button"
              onClick={publicar}
              disabled={guardando}
              className="rounded-xl bg-rose-700 px-6 py-3 text-sm font-semibold text-white hover:bg-rose-800 disabled:opacity-50"
            >
              {guardando ? 'Publicando…' : 'Publicar mi dedicatoria'}
            </button>
          )}
        </div>
      </div>

      {ajuste && (
        <Recortador
          src={ajuste.src}
          aspecto={ajuste.encuadre.aspecto}
          forma={ajuste.encuadre.forma}
          onListo={guardarAjuste}
          onCancelar={cerrarAjuste}
        />
      )}
    </div>
  );
}
