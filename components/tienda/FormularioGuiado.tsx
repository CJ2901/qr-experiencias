'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { guardarBorrador, urlDeSubida, publicarPedido, type Borrador } from '@/app/actions/pedido';

/**
 * Formulario por pasos. Dos decisiones deliberadas:
 *  - se guarda al AVANZAR de paso, no al final: si el cliente cierra
 *    la pestana no pierde nada;
 *  - el paso 4 es irreversible y lo dice antes, no despues.
 */

interface Props {
  pedidoId: string;
  maxChars: number;
  /** Vienen de la plantilla, no de una constante: se afinan sin desplegar. */
  limites: { min: number; max: number };
  /** ruta del bucket → URL firmada. El bucket es privado: sin esto no hay miniatura. */
  previews: Record<string, string>;
  inicial: Required<Omit<Borrador, 'foto_final'>> & { foto_final: string | null };
}

const PASOS = ['Para quién', 'La carta', 'Las fotos', 'Revisar'] as const;

export default function FormularioGuiado({
  pedidoId,
  maxChars,
  limites,
  previews,
  inicial,
}: Props) {
  const router = useRouter();
  const [paso, setPaso] = useState(0);
  const [d, setD] = useState(inicial);
  /**
   * Miniaturas de lo que se acaba de subir. La URL firmada solo llega en
   * el siguiente render del servidor, asi que mientras tanto se muestra
   * el archivo local: el cliente ve su foto al instante, que es lo que
   * espera despues de elegirla.
   */
  const [reciEn, setRecien] = useState<Record<string, string>>({});
  const miniatura = (ruta: string) => reciEn[ruta] ?? previews[ruta];
  const [error, setError] = useState('');
  const [subiendo, setSubiendo] = useState(false);
  const [guardando, empezar] = useTransition();

  const set = <K extends keyof typeof d>(k: K, v: (typeof d)[K]) =>
    setD((prev) => ({ ...prev, [k]: v }));

  function validar(n: number): string {
    if (n === 0) {
      if (!d.destinatario.trim()) return 'Pon el nombre de quien va a recibirlo.';
      if (!d.frase_principal.trim()) return 'Falta la frase de portada.';
    }
    if (n === 1 && d.mensaje.trim().length < 20) {
      return 'La carta es muy corta. Escribe al menos un par de líneas.';
    }
    if (n === 2 && d.fotos.length < limites.min) {
      const faltan = limites.min - d.fotos.length;
      return `Faltan ${faltan} foto${faltan === 1 ? '' : 's'}: la galería necesita al menos ${limites.min}.`;
    }
    return '';
  }

  function avanzar() {
    const e = validar(paso);
    if (e) return setError(e);
    setError('');
    empezar(async () => {
      const r = await guardarBorrador(pedidoId, d);
      if (!r.ok) return setError(r.error);
      setPaso((p) => Math.min(p + 1, PASOS.length - 1));
    });
  }

  async function subir(archivos: FileList | null, final = false) {
    if (!archivos?.length) return;
    setError('');
    setSubiendo(true);
    try {
      const nuevas: string[] = [];
      const cupo = final ? 1 : limites.max - d.fotos.length;

      for (const file of Array.from(archivos).slice(0, Math.max(cupo, 0))) {
        if (file.size > 10 * 1024 * 1024) {
          setError(`"${file.name}" pesa más de 10 MB. Redúcela e inténtalo de nuevo.`);
          continue;
        }
        const r = await urlDeSubida(pedidoId, file.name);
        if (!r.ok) { setError(r.error); break; }

        const res = await fetch(r.signedUrl, {
          method: 'PUT',
          body: file,
          headers: { 'content-type': file.type || 'application/octet-stream' },
        });
        if (!res.ok) { setError('No se pudo subir ' + file.name); break; }
        nuevas.push(r.ruta);
        const local = URL.createObjectURL(file);
        setRecien((prev) => ({ ...prev, [r.ruta]: local }));
      }

      if (nuevas.length) {
        const campos: Borrador = final
          ? { foto_final: nuevas[0] }
          : { fotos: [...d.fotos, ...nuevas] };
        setD((prev) => ({ ...prev, ...campos } as typeof prev));
        await guardarBorrador(pedidoId, campos);
      }
    } finally {
      setSubiendo(false);
    }
  }

  async function quitarFoto(ruta: string) {
    if (reciEn[ruta]) URL.revokeObjectURL(reciEn[ruta]);
    const fotos = d.fotos.filter((f) => f !== ruta);
    set('fotos', fotos);
    await guardarBorrador(pedidoId, { fotos });
  }

  function publicar() {
    setError('');
    empezar(async () => {
      await guardarBorrador(pedidoId, d);
      const r = await publicarPedido(pedidoId);
      if (!r.ok) return setError(r.error);
      router.push(`/pedido/${pedidoId}/listo`);
    });
  }

  const campo =
    'mt-1.5 w-full rounded-xl border border-stone-300 px-3.5 py-2.5 text-[15px] outline-none focus:border-stone-900';

  return (
    <div className="mt-8">
      {/* progreso */}
      <ol className="flex gap-1.5" aria-label="Progreso">
        {PASOS.map((nombre, i) => (
          <li key={nombre} className="flex-1">
            <div className={`h-1 rounded-full ${i <= paso ? 'bg-stone-900' : 'bg-stone-200'}`} />
            <span className={`mt-1.5 block text-[11px] ${i === paso ? 'font-medium text-stone-900' : 'text-stone-400'}`}>
              {nombre}
            </span>
          </li>
        ))}
      </ol>

      <div className="mt-8 space-y-5">
        {/* ---------- 1 · para quién ---------- */}
        {paso === 0 && (
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
              <span className="mt-1 block text-xs text-stone-500">
                Es lo primero que va a ver, en grande.
              </span>
            </label>

            <label className="block text-sm">
              <span className="font-medium text-stone-800">Frase de portada</span>
              <input
                className={campo}
                value={d.frase_principal}
                onChange={(e) => set('frase_principal', e.target.value)}
                placeholder="Hoy es el cumpleaños de mi persona favorita"
                maxLength={90}
              />
            </label>

            <label className="block text-sm">
              <span className="font-medium text-stone-800">Fecha <span className="font-normal text-stone-400">(opcional)</span></span>
              <input
                className={campo}
                value={d.fecha_texto}
                onChange={(e) => set('fecha_texto', e.target.value)}
                placeholder="18 de junio"
                maxLength={30}
              />
            </label>
          </>
        )}

        {/* ---------- 2 · la carta ---------- */}
        {paso === 1 && (
          <>
            <label className="block text-sm">
              <span className="font-medium text-stone-800">La carta</span>
              <textarea
                className={`${campo} min-h-44 leading-relaxed`}
                value={d.mensaje}
                onChange={(e) => set('mensaje', e.target.value)}
                placeholder={'Escribe como le hablarías.\n\nDeja una línea en blanco para separar párrafos.'}
                maxLength={900}
                autoFocus
              />
              <span className="mt-1 flex justify-between text-xs text-stone-500">
                <span>No cortes los renglones: lo hacemos nosotros, a {maxChars} caracteres.</span>
                <span className="tabular-nums">{d.mensaje.length}/900</span>
              </span>
            </label>

            <details className="rounded-xl border border-stone-200 bg-white p-4">
              <summary className="cursor-pointer text-sm font-medium text-stone-800">
                Frases del cierre <span className="font-normal text-stone-400">(opcional)</span>
              </summary>
              <div className="mt-4 space-y-4">
                {([
                  ['frase_capitulo', 'Después de la carta', 'Cada año tuyo es un capítulo nuevo'],
                  ['frase_brindis', 'Junto al brindis', 'Por muchos cumpleaños más juntos'],
                  ['frase_final', 'Despedida', 'Gracias por compartir tu vida conmigo'],
                ] as const).map(([k, etiqueta, ph]) => (
                  <label key={k} className="block text-sm">
                    <span className="text-stone-600">{etiqueta}</span>
                    <input
                      className={campo}
                      value={d[k]}
                      onChange={(e) => set(k, e.target.value)}
                      placeholder={ph}
                      maxLength={90}
                    />
                  </label>
                ))}
              </div>
            </details>
          </>
        )}

        {/* ---------- 3 · las fotos ---------- */}
        {paso === 2 && (
          <>
            <div>
              <p className="text-sm font-medium text-stone-800">
                Fotos de la galería{' '}
                <span
                  className={
                    d.fotos.length < limites.min
                      ? 'font-semibold text-rose-700'
                      : 'font-normal text-stone-500'
                  }
                >
                  ({d.fotos.length} de {limites.max} · mínimo {limites.min})
                </span>
              </p>
              <div className="mt-3 grid grid-cols-4 gap-2">
                {d.fotos.map((ruta) => (
                  <div key={ruta} className="relative aspect-3/4 overflow-hidden rounded-lg bg-stone-200">
                    {miniatura(ruta) ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={miniatura(ruta)}
                        alt=""
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                    ) : (
                      <span className="absolute inset-0 grid place-items-center px-1 text-center text-[9px] text-stone-500">
                        {ruta.split('/').pop()?.slice(-14)}
                      </span>
                    )}
                    <button
                      onClick={() => quitarFoto(ruta)}
                      className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-white/90 text-xs text-stone-700 shadow"
                      aria-label="Quitar foto"
                    >
                      &times;
                    </button>
                  </div>
                ))}
                {d.fotos.length < limites.max && (
                  <label className="grid aspect-3/4 cursor-pointer place-items-center rounded-lg border-2 border-dashed border-stone-300 text-2xl text-stone-400 hover:border-stone-500">
                    +
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => subir(e.target.files)}
                      disabled={subiendo}
                    />
                  </label>
                )}
              </div>
              <p className="mt-2 text-xs text-stone-500">
                Horizontales o cuadradas se ven mejor. Máximo 10 MB cada una.
              </p>
            </div>

            <label className="block text-sm">
              <span className="font-medium text-stone-800">
                Foto de cierre <span className="font-normal text-stone-400">(opcional)</span>
              </span>
              <input
                type="file"
                accept="image/*"
                className="mt-1.5 block w-full text-sm text-stone-600 file:mr-3 file:rounded-lg file:border-0 file:bg-stone-900 file:px-4 file:py-2 file:text-sm file:text-white"
                onChange={(e) => subir(e.target.files, true)}
                disabled={subiendo}
              />
              {d.foto_final && <span className="mt-1 block text-xs text-emerald-700">Cargada.</span>}
            </label>

            {subiendo && <p className="text-sm text-stone-500">Subiendo…</p>}
          </>
        )}

        {/* ---------- 4 · revisar ---------- */}
        {paso === 3 && (
          <div className="space-y-4">
            <dl className="divide-y divide-stone-100 rounded-xl border border-stone-200 bg-white text-sm">
              {([
                ['Para', d.destinatario],
                ['Portada', d.frase_principal],
                ['Fecha', d.fecha_texto || '—'],
                ['Fotos', `${d.fotos.length} en la galería${d.foto_final ? ' + cierre' : ''}`],
              ] as const).map(([k, v]) => (
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
              <p className="font-medium">Al publicar, esto queda cerrado.</p>
              <p className="mt-1 leading-relaxed">
                Ya no vas a poder editarlo tú. Si después necesitas corregir algo,
                escríbenos y lo hacemos nosotros. Revisa los nombres con calma.
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
            onClick={() => { setError(''); setPaso((p) => Math.max(0, p - 1)); }}
            disabled={paso === 0 || guardando}
            className="text-sm text-stone-500 hover:text-stone-900 disabled:invisible"
          >
            &larr; Atrás
          </button>

          {paso < PASOS.length - 1 ? (
            <button
              onClick={avanzar}
              disabled={guardando || subiendo}
              className="rounded-xl bg-stone-900 px-6 py-3 text-sm font-semibold text-white hover:bg-stone-700 disabled:opacity-50"
            >
              {guardando ? 'Guardando…' : 'Continuar'}
            </button>
          ) : (
            <button
              onClick={publicar}
              disabled={guardando}
              className="rounded-xl bg-rose-700 px-6 py-3 text-sm font-semibold text-white hover:bg-rose-800 disabled:opacity-50"
            >
              {guardando ? 'Publicando…' : 'Publicar mi experiencia'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
