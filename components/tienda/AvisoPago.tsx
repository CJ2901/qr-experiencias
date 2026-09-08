'use client';

/**
 * El unico lugar donde se pinta el resultado de un pago.
 *
 * Existe para que tarjeta y Yape no se contradigan: mismo tono, mismo
 * sitio, misma regla. Y para que el codigo de referencia SIEMPRE se vea
 * cuando hay uno: es lo que el comprador nos dicta por WhatsApp.
 */

export type TonoAviso = 'info' | 'error' | 'exito';

export interface Aviso {
  tono: TonoAviso;
  texto: string;
  referencia?: string | null;
  /** true cuando insistir con el mismo medio no va a servir. */
  cambiarMedio?: boolean;
}

const ESTILO: Record<TonoAviso, string> = {
  info: 'bg-stone-100 text-stone-700',
  error: 'bg-rose-50 text-rose-900 ring-1 ring-rose-200',
  exito: 'bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200',
};

export default function AvisoPago({
  aviso,
  onReintentar,
}: {
  aviso: Aviso | null;
  onReintentar?: () => void;
}) {
  if (!aviso) return null;

  return (
    <div className={`mt-4 rounded-lg px-3.5 py-3 text-sm ${ESTILO[aviso.tono]}`} role="status">
      <p className="leading-relaxed">{aviso.texto}</p>

      {aviso.cambiarMedio && (
        <p className="mt-1.5 text-xs opacity-80">
          Reintentar con el mismo medio va a dar el mismo resultado.
        </p>
      )}

      {aviso.referencia && (
        <p className="mt-2 text-xs opacity-80">
          Código de tu intento:{' '}
          <code className="rounded bg-white/70 px-1.5 py-0.5 font-mono">{aviso.referencia}</code>
        </p>
      )}

      {aviso.tono === 'error' && onReintentar && (
        <button
          onClick={onReintentar}
          className="mt-2.5 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-stone-900 shadow-sm hover:bg-stone-50"
        >
          Volver a intentar
        </button>
      )}
    </div>
  );
}
