'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { revisarPago } from '@/app/actions/pago';

/**
 * "Ya pagué, revisar". La red de seguridad del comprador cuando el
 * webhook no llego (o no puede llegar, como en local).
 *
 * No decide nada: muestra el mensaje que ya viene redactado desde el
 * servidor. Si la explicacion de un estado de Mercado Pago cambia, se
 * cambia en lib/pagos/mensajes.ts y aqui no se toca una linea.
 */
export default function BotonRevisarPago({ pedidoId }: { pedidoId: string }) {
  const router = useRouter();
  const [nota, setNota] = useState('');
  const [cargando, empezar] = useTransition();

  function revisar() {
    setNota('');
    empezar(async () => {
      const r = await revisarPago(pedidoId);
      setNota(r.mensaje);

      if (r.ok && r.listoParaCompletar) {
        router.push(`/pedido/${pedidoId}/completar`);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="text-right">
      <button
        onClick={revisar}
        disabled={cargando}
        className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium hover:bg-stone-50 disabled:opacity-50"
      >
        {cargando ? 'Consultando…' : 'Ya pagué, revisar'}
      </button>
      {nota && <p className="mt-1.5 max-w-64 text-xs leading-relaxed text-stone-500">{nota}</p>}
    </div>
  );
}
