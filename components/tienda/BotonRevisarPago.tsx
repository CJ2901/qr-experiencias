'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { revisarPago } from '@/app/actions/pago';
import type { AccesoPedido } from './FormularioGuiado';

/**
 * "Ya pagué, revisar". La red de seguridad del comprador cuando el
 * webhook no llego (o no puede llegar, como en local).
 *
 * No decide nada: muestra el mensaje que ya viene redactado desde el
 * servidor. Si el pago se aprueba, la misma pagina pasa a mostrar el editor.
 */
export default function BotonRevisarPago({ acceso }: { acceso: AccesoPedido }) {
  const router = useRouter();
  const [nota, setNota] = useState('');
  const [cargando, empezar] = useTransition();

  function revisar() {
    setNota('');
    empezar(async () => {
      const r = await revisarPago(acceso);
      setNota(r.mensaje);
      router.refresh();
    });
  }

  return (
    <div>
      <button
        onClick={revisar}
        disabled={cargando}
        className="rounded-xl border border-stone-300 px-5 py-2.5 text-sm font-medium hover:bg-stone-50 disabled:opacity-50"
      >
        {cargando ? 'Consultando…' : 'Ya pagué, revisar'}
      </button>
      {nota && <p className="mt-2 text-xs leading-relaxed text-stone-500">{nota}</p>}
    </div>
  );
}
