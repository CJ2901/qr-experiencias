'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { enviarPago } from '@/lib/pagos/cliente';
import AvisoPago, { type Aviso } from './AvisoPago';

/**
 * Yape.
 *
 * POR QUE NO VA DENTRO DEL PAYMENT BRICK
 * Yape no es un medio mas del Brick: Mercado Pago lo expone solo por
 * Checkout API con su propio tokenizador. El navegador pide celular +
 * codigo de aprobacion, el SDK devuelve un token de un solo uso, y el
 * servidor cobra con payment_method_id 'yape' e installments 1 (es
 * debito). Por eso este componente existe aparte y comparte con la
 * tarjeta solo lo que de verdad es comun: enviarPago y AvisoPago.
 *
 * El codigo de aprobacion lo genera el comprador en su app:
 *   Yape > Menu > Aprobacion de compras por internet.
 * Dura pocos minutos y es de un solo uso.
 *
 * EN PRUEBA: celular 111111111 + codigo 123456 = aprobado.
 *            celular 111111112 + codigo 123456 = rechazado.
 */

type TokenYape = { id?: string } | string;
interface InstanciaYape {
  create: () => Promise<TokenYape>;
}
interface InstanciaMP {
  yape: (o: { otp: string; phoneNumber: string }) => InstanciaYape;
}
declare global {
  interface Window {
    MercadoPago?: new (llave: string, opciones?: { locale?: string }) => InstanciaMP;
  }
}

const SDK = 'https://sdk.mercadopago.com/js/v2';

/** Carga el SDK una sola vez, aunque el componente se monte varias. */
function cargarSdk(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.MercadoPago) return Promise.resolve();

  const yaEsta = document.querySelector<HTMLScriptElement>(`script[src="${SDK}"]`);
  const el = yaEsta ?? Object.assign(document.createElement('script'), { src: SDK, async: true });

  return new Promise((resolver, rechazar) => {
    el.addEventListener('load', () => resolver());
    el.addEventListener('error', () => rechazar(new Error('no_carga_sdk')));
    if (!yaEsta) document.head.appendChild(el);
  });
}

const soloDigitos = (s: string, max: number) => s.replace(/\D/g, '').slice(0, max);

export default function PagoYape({
  datos,
}: {
  datos: { plantilla: string; ocasion: string; email: string; email_confirmacion: string };
}) {
  const router = useRouter();
  const [celular, setCelular] = useState('');
  const [codigo, setCodigo] = useState('');
  const [cargando, setCargando] = useState(false);
  const [aviso, setAviso] = useState<Aviso | null>(null);

  const listo = celular.length === 9 && codigo.length === 6;

  async function pagar() {
    if (!listo || cargando) return;
    setCargando(true);
    setAviso({ tono: 'info', texto: 'Procesando el pago. No cierres esta ventana.' });

    // --- 1 · token, en el navegador. El celular y el codigo no pasan por
    //         nuestro servidor: van directo a Mercado Pago. ---
    let token = '';
    try {
      await cargarSdk();
      const MP = window.MercadoPago;
      if (!MP) throw new Error('no_carga_sdk');

      const mp = new MP(process.env.NEXT_PUBLIC_MP_PUBLIC_KEY as string, { locale: 'es-PE' });
      const crudo = await mp.yape({ otp: codigo, phoneNumber: celular }).create();
      token = typeof crudo === 'string' ? crudo : (crudo?.id ?? '');
      if (!token) throw new Error('sin_token');
    } catch (e) {
      console.error('[yape]', e);
      setCargando(false);
      setAviso({
        tono: 'error',
        texto:
          'No pudimos validar tu código de Yape. Genera uno nuevo en la app (Menú → Aprobación de compras por internet) y vuelve a intentar.',
      });
      return;
    }

    // --- 2 · el cobro, en el servidor. Mismo caso de uso que la tarjeta. ---
    const r = await enviarPago({ ...datos, metodo: 'yape', token });
    setCargando(false);

    if (!r.ok) {
      setCodigo(''); // el codigo es de un solo uso: pedirlo de nuevo
      setAviso({
        tono: 'error',
        texto: r.mensaje,
        referencia: r.referencia,
        cambiarMedio: r.cambiarMedio,
      });
      return;
    }

    setAviso({ tono: 'exito', texto: r.mensaje, referencia: r.referencia });
    if (r.siguiente) router.push(r.siguiente);
  }

  return (
    <div>
      <p className="rounded-xl bg-stone-50 p-4 text-[13px] leading-relaxed text-stone-600">
        En Yape, entra a <strong>Menú → Aprobación de compras por internet</strong>, genera
        el código de 6 dígitos y escríbelo aquí junto con tu número. El código dura pocos minutos.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="font-medium text-stone-800">Número de celular</span>
          <input
            inputMode="numeric"
            autoComplete="tel-national"
            placeholder="9XXXXXXXX"
            value={celular}
            onChange={(e) => setCelular(soloDigitos(e.target.value, 9))}
            className="mt-1.5 w-full rounded-xl border border-stone-300 px-3.5 py-2.5 text-[15px] tabular-nums outline-none focus:border-stone-900"
          />
        </label>

        <label className="block text-sm">
          <span className="font-medium text-stone-800">Código de aprobación</span>
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="6 dígitos"
            value={codigo}
            onChange={(e) => setCodigo(soloDigitos(e.target.value, 6))}
            className="mt-1.5 w-full rounded-xl border border-stone-300 px-3.5 py-2.5 text-[15px] tabular-nums outline-none focus:border-stone-900"
          />
        </label>
      </div>

      <button
        onClick={pagar}
        disabled={!listo || cargando}
        className="mt-4 w-full rounded-xl bg-[#742284] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#5d1b6a] disabled:cursor-not-allowed disabled:opacity-40"
      >
        {cargando ? 'Procesando…' : 'Pagar con Yape'}
      </button>

      <AvisoPago aviso={aviso} onReintentar={() => setAviso(null)} />
    </div>
  );
}
