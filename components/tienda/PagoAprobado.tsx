'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * El momento "listo": check animado a pantalla completa, como al confirmar
 * un pedido en una app de delivery. Dura lo justo para sentirse seguro
 * (1.8 s) y lleva solo al editor; tocar adelanta el paso.
 */
export default function PagoAprobado({ siguiente }: { siguiente: string }) {
  const router = useRouter();

  useEffect(() => {
    router.prefetch(siguiente);
    const t = setTimeout(() => router.push(siguiente), 1800);
    return () => clearTimeout(t);
  }, [router, siguiente]);

  return (
    <div
      className="fixed inset-0 z-50 flex cursor-pointer flex-col items-center justify-center bg-white px-6 text-center"
      role="status"
      aria-live="assertive"
      onClick={() => router.push(siguiente)}
    >
      <svg viewBox="0 0 120 120" className="h-28 w-28" aria-hidden>
        <circle cx="60" cy="60" r="54" fill="#16a34a" className="ok-circulo" />
        <path d="M36 62 l16 16 l32 -34" fill="none" stroke="#fff" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" className="ok-check" />
      </svg>
      <p className="mt-6 text-2xl font-semibold tracking-tight text-stone-900">¡Pago aprobado!</p>
      <p className="mt-2 text-[15px] text-stone-600">Ahora escribe tu dedicatoria. Te enviamos el enlace a tu correo.</p>
      <style>{`
        .ok-circulo { transform-origin: center; animation: ok-pop .45s cubic-bezier(.2,1.4,.4,1) both; }
        .ok-check { stroke-dasharray: 80; stroke-dashoffset: 80; animation: ok-trazo .4s .35s ease-out forwards; }
        @keyframes ok-pop { from { transform: scale(.3); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        @keyframes ok-trazo { to { stroke-dashoffset: 0; } }
        @media (prefers-reduced-motion: reduce) { .ok-circulo, .ok-check { animation: none; stroke-dashoffset: 0; } }
      `}</style>
    </div>
  );
}
