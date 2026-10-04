'use client';

import { useState, useTransition } from 'react';
import { reenviarEnlaces } from '@/app/actions/reenviar';

export default function FormReenviar() {
  const [mensaje, setMensaje] = useState('');
  const [enviando, empezar] = useTransition();

  return (
    <form
      className="mt-6"
      onSubmit={(e) => {
        e.preventDefault();
        const datos = new FormData(e.currentTarget);
        empezar(async () => setMensaje(await reenviarEnlaces('', datos)));
      }}
    >
      <label className="block text-sm">
        <span className="font-medium text-stone-800">Tu correo</span>
        <input
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          className="mt-1.5 w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-[15px] outline-none focus:border-stone-900"
        />
      </label>
      <button
        disabled={enviando}
        className="mt-4 w-full rounded-xl bg-stone-900 px-5 py-3 text-sm font-semibold text-white hover:bg-stone-700 disabled:opacity-50"
      >
        {enviando ? 'Enviando…' : 'Reenviarme el enlace'}
      </button>
      {mensaje && (
        <p className="mt-4 rounded-xl bg-stone-100 p-3.5 text-sm leading-relaxed text-stone-700" role="status">
          {mensaje}
        </p>
      )}
    </form>
  );
}
