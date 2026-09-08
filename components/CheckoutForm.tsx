'use client';

import { initMercadoPago, Payment } from '@mercadopago/sdk-react';
import { useState } from 'react';

// Inicializa Mercado Pago con la clave pública
initMercadoPago(process.env.NEXT_PUBLIC_MP_PUBLIC_KEY as string, {
  locale: 'es-PE'
});

export default function CheckoutForm() {
  const [mensaje, setMensaje] = useState('');

  const initialization = {
    amount: 50, // El precio de tu experiencia en Soles
  };

  const customization = {
    paymentMethods: {
      creditCard: 'all',
      // Puedes habilitar Yape o débito aquí si tu cuenta lo soporta
      debitCard: 'all', 
    },
  };

  const onSubmit = async (formData: any) => {
    setMensaje('Procesando pago...');
    
    try {
      // Enviamos el token seguro generado por MP a nuestro backend
      const response = await fetch('/api/pagar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (data.status === 'approved') {
        setMensaje('¡Pago aprobado! Generando tu enlace...');
        // Aquí rediriges a la pantalla de éxito o generas el token de acceso
      } else {
        setMensaje('El pago fue rechazado o está pendiente.');
      }
    } catch (error) {
      setMensaje('Ocurrió un error en la conexión.');
    }
  };

  return (
    <div className="max-w-md mx-auto bg-white p-6 rounded-lg shadow mt-10">
      <h2 className="text-xl font-bold mb-4">Finalizar Compra</h2>
      
      <Payment
        initialization={initialization}
        customization={customization as any}
        onSubmit={onSubmit}
      />
      
      {mensaje && (
        <p className="mt-4 text-center font-medium text-blue-600">
          {mensaje}
        </p>
      )}
    </div>
  );
}