'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { initMercadoPago, Payment } from '@mercadopago/sdk-react';
import { enviarPago } from '@/lib/pagos/cliente';
import AvisoPago, { type Aviso } from './AvisoPago';

initMercadoPago(process.env.NEXT_PUBLIC_MP_PUBLIC_KEY as string, { locale: 'es-PE' });

/**
 * OJO con la firma de onSubmit.
 *
 * El Payment Brick NO entrega el formulario directamente: entrega
 * { selectedPaymentMethod, formData }. Mandar el argumento entero al
 * backend deja `token`, `installments` y `payer` un nivel mas abajo de
 * donde el servidor los busca, y la peticion muere con "faltan datos"
 * aunque la tarjeta este perfecta.
 */
interface DatosBrick {
  selectedPaymentMethod: string;
  formData: {
    token?: string;
    issuer_id?: string;
    payment_method_id?: string;
    installments?: number;
    payer?: { email?: string; identification?: { type?: string; number?: string } };
  };
}

interface Props {
  plantilla: string;
  ocasion: string;
  /** Solo para pintar el Brick. El cobro real usa el precio del servidor. */
  montoSoles: number;
  email: string;
}

export default function CheckoutBrick({ plantilla, ocasion, montoSoles, email }: Props) {
  const router = useRouter();
  const [aviso, setAviso] = useState<Aviso | null>(null);
  // Cambiar esta clave vuelve a montar el Brick desde cero. Sin esto, un
  // error de Mercado Pago deja el formulario inservible y hay que recargar
  // la pagina entera para poder reescribir la tarjeta.
  const [intento, setIntento] = useState(0);

  async function onSubmit({ formData }: DatosBrick): Promise<void> {
    setAviso({ tono: 'info', texto: 'Procesando el pago. No cierres esta ventana.' });

    const r = await enviarPago({ ...formData, metodo: 'tarjeta', plantilla, ocasion });

    if (!r.ok) {
      // OJO: el aviso se arma con `r`, no leyendo un estado que acabamos
      // de setear. Ese era el bug viejo: `hayError` seguia en false dentro
      // del mismo render y el catch pisaba el motivo real con
      // "Se corto la conexion", pasara lo que pasara.
      setAviso({
        tono: 'error',
        texto: r.mensaje,
        referencia: r.referencia,
        cambiarMedio: r.cambiarMedio,
      });
      // Rechazar deja al Brick en su estado de error y con el formulario
      // reutilizable; si resolvemos, muestra "aprobado" sobre un fallo.
      throw new Error(r.codigo ?? 'pago_no_completado');
    }

    setAviso({ tono: 'exito', texto: r.mensaje, referencia: r.referencia });
    router.push(r.siguiente ?? '/mis-pedidos');
  }

  return (
    <div>
      <Payment
        key={intento}
        initialization={{ amount: montoSoles, payer: { email } }}
        customization={
          {
            visual: { style: { theme: 'default' } },
            paymentMethods: { creditCard: 'all', debitCard: 'all' },
          } as never
        }
        onSubmit={onSubmit as never}
        onError={(e: unknown) => {
          console.error('[Brick]', e);
          const causa = (e as { cause?: string })?.cause ?? '';
          setAviso({
            tono: 'error',
            texto:
              causa === 'get_card_bin_payment_methods_failed'
                ? 'Mercado Pago no reconoció esa tarjeta. Prueba con otra, o paga con Yape.'
                : 'El formulario de pago devolvió un error antes de cobrar. No se te cobró nada.',
            referencia: null,
          });
        }}
      />

      <AvisoPago
        aviso={aviso}
        onReintentar={() => {
          setAviso(null);
          setIntento((n) => n + 1);
        }}
      />
    </div>
  );
}
