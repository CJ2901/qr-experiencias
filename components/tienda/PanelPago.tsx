'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import CheckoutBrick from './CheckoutBrick';
import PagoYape from './PagoYape';
import AvisoPago, { type Aviso } from './AvisoPago';
import { enviarPago } from '@/lib/pagos/cliente';

/**
 * El contenedor del checkout. Decide QUE se muestra:
 *  - el correo, dos veces. Hasta que coincidan no aparece ningun medio
 *    de pago: sin cuenta, un correo mal escrito es un regalo perdido;
 *  - la ocasion (es del pedido, no del medio de pago);
 *  - cual de los formularios de pago esta activo.
 *
 * Ni cobra ni habla con Mercado Pago. El servidor vuelve a validar el
 * correo: esto es comodidad, no seguridad.
 */

type Metodo = 'tarjeta' | 'yape';

interface Props {
  plantilla: string;
  montoSoles: number;
  ocasiones: readonly { valor: string; etiqueta: string }[];
  /** Yape solo aparece si la cuenta de Mercado Pago lo tiene habilitado. */
  yapeHabilitado: boolean;
  /** Boton de pago simulado (solo prueba + PAGOS_SIMULADOS=1). */
  simulado: boolean;
}

const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default function PanelPago({ plantilla, montoSoles, ocasiones, yapeHabilitado, simulado }: Props) {
  const router = useRouter();
  const [ocasion, setOcasion] = useState(ocasiones[0].valor);
  const [metodo, setMetodo] = useState<Metodo>('tarjeta');
  const [email, setEmail] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [tocado, setTocado] = useState(false);
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const [simulando, setSimulando] = useState(false);

  const limpio = email.trim().toLowerCase();
  const valido = CORREO.test(limpio);
  const coincide = valido && limpio === confirmacion.trim().toLowerCase();

  const errorCorreo = !tocado
    ? ''
    : !valido
      ? 'Revisa tu correo: parece incompleto.'
      : !coincide
        ? 'Los dos correos no coinciden.'
        : '';

  const datos = { plantilla, ocasion, email: limpio, email_confirmacion: confirmacion.trim().toLowerCase() };

  async function pagarSimulado() {
    setSimulando(true);
    setAviso({ tono: 'info', texto: 'Simulando el pago…' });
    const r = await enviarPago({ ...datos, metodo: 'simulado' });
    setSimulando(false);
    if (!r.ok) return setAviso({ tono: 'error', texto: r.mensaje, referencia: r.referencia });
    setAviso({ tono: 'exito', texto: r.mensaje, referencia: r.referencia });
    if (r.siguiente) router.push(r.siguiente);
  }

  const pestana = (id: Metodo, etiqueta: string) => (
    <button
      key={id}
      type="button"
      onClick={() => setMetodo(id)}
      aria-pressed={metodo === id}
      className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
        metodo === id ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-800'
      }`}
    >
      {etiqueta}
    </button>
  );

  const campo =
    'mt-1.5 w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-[15px] outline-none focus:border-stone-900';

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="font-medium text-stone-800">Tu correo</span>
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="tu@gmail.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={() => confirmacion && setTocado(true)}
            className={campo}
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-stone-800">Confírmalo</span>
          <input
            type="email"
            inputMode="email"
            autoComplete="off"
            placeholder="Escríbelo otra vez"
            value={confirmacion}
            onChange={(e) => setConfirmacion(e.target.value)}
            onBlur={() => setTocado(true)}
            // Pegar el mismo texto anula la doble comprobacion.
            onPaste={(e) => e.preventDefault()}
            className={campo}
          />
        </label>
      </div>
      <p className={`mt-2 text-xs ${errorCorreo ? 'text-rose-700' : 'text-stone-500'}`} role={errorCorreo ? 'alert' : undefined}>
        {errorCorreo || 'Ahí te llegan el enlace para editar y tu QR. No necesitas crear cuenta.'}
      </p>

      <label className="mt-5 block text-sm">
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
      </label>

      <div className="mt-6 border-t border-stone-100 pt-5">
        {!coincide ? (
          <p className="rounded-xl bg-stone-50 p-4 text-sm text-stone-500">
            Escribe tu correo en los dos campos para ver los medios de pago.
          </p>
        ) : (
          <>
            {yapeHabilitado && (
              <div className="mb-5 flex gap-1 rounded-xl bg-stone-100 p-1">
                {pestana('tarjeta', 'Tarjeta')}
                {pestana('yape', 'Yape')}
              </div>
            )}

            {metodo === 'tarjeta' ? (
              // key: si cambia el correo, el Brick se monta de nuevo con el correcto
              <CheckoutBrick key={limpio} datos={datos} montoSoles={montoSoles} />
            ) : (
              <PagoYape datos={datos} />
            )}

            {simulado && (
              <div className="mt-6 rounded-xl border border-dashed border-amber-300 bg-amber-50 p-4">
                <p className="text-xs leading-relaxed text-amber-900">
                  Solo en modo prueba: aprueba el pago sin tarjeta para probar el editor y los correos.
                </p>
                <button
                  type="button"
                  onClick={pagarSimulado}
                  disabled={simulando}
                  className="mt-3 w-full rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
                >
                  {simulando ? 'Simulando…' : 'Simular pago aprobado'}
                </button>
                <AvisoPago aviso={aviso} onReintentar={() => setAviso(null)} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
