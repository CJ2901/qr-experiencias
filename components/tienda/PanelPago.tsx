'use client';

import { useState } from 'react';
import CheckoutBrick from './CheckoutBrick';
import PagoYape from './PagoYape';

/**
 * El contenedor del paso 2. Su unica responsabilidad es decidir QUE se
 * muestra: la ocasion (que es del pedido, no del medio de pago) y cual de
 * los dos formularios esta activo.
 *
 * Ni cobra ni valida ni habla con Mercado Pago. Por eso agregar un tercer
 * medio manana es agregar una pestana y un componente, sin tocar nada mas.
 */

type Metodo = 'tarjeta' | 'yape';

interface Props {
  plantilla: string;
  montoSoles: number;
  email: string;
  ocasiones: readonly { valor: string; etiqueta: string }[];
  /** Yape solo aparece si la cuenta de Mercado Pago lo tiene habilitado. */
  yapeHabilitado: boolean;
}

export default function PanelPago({
  plantilla,
  montoSoles,
  email,
  ocasiones,
  yapeHabilitado,
}: Props) {
  const [ocasion, setOcasion] = useState(ocasiones[0].valor);
  const [metodo, setMetodo] = useState<Metodo>('tarjeta');

  const pestana = (id: Metodo, etiqueta: string) => (
    <button
      key={id}
      onClick={() => setMetodo(id)}
      aria-pressed={metodo === id}
      className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
        metodo === id
          ? 'bg-white text-stone-900 shadow-sm'
          : 'text-stone-500 hover:text-stone-800'
      }`}
    >
      {etiqueta}
    </button>
  );

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-6">
      <label className="block text-sm">
        <span className="font-medium text-stone-800">¿Para qué ocasión es?</span>
        <select
          value={ocasion}
          onChange={(e) => setOcasion(e.target.value)}
          className="mt-1.5 w-full max-w-sm rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-[15px] outline-none focus:border-stone-900"
        >
          {ocasiones.map((o) => (
            <option key={o.valor} value={o.valor}>
              {o.etiqueta}
            </option>
          ))}
        </select>
        <span className="mt-1.5 block text-xs text-stone-500">
          Define el enlace de tu página. No se puede cambiar después.
        </span>
      </label>

      <div className="mt-6 border-t border-stone-100 pt-5">
        {yapeHabilitado && (
          <div className="mb-5 flex gap-1 rounded-xl bg-stone-100 p-1">
            {pestana('tarjeta', 'Tarjeta')}
            {pestana('yape', 'Yape')}
          </div>
        )}

        {metodo === 'tarjeta' ? (
          <CheckoutBrick
            plantilla={plantilla}
            ocasion={ocasion}
            montoSoles={montoSoles}
            email={email}
          />
        ) : (
          <PagoYape plantilla={plantilla} ocasion={ocasion} />
        )}
      </div>
    </div>
  );
}
