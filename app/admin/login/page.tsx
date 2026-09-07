'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Login() {
  const [pass, setPass] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const router = useRouter();

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setCargando(true); setError('');
    const r = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password: pass }),
    });
    setCargando(false);
    if (r.ok) router.push('/admin');
    else setError('Contrasena incorrecta.');
  }

  return (
    <main className="admin">
      <h1>Panel</h1>
      <p className="sub">Entra para crear y revisar pedidos.</p>
      <form onSubmit={entrar}>
        <label>
          Contrasena
          <input type="password" value={pass} onChange={(e) => setPass(e.target.value)} autoFocus />
        </label>
        {error && <p className="aviso">{error}</p>}
        <button className="btn" disabled={cargando}>{cargando ? 'Entrando...' : 'Entrar'}</button>
      </form>
    </main>
  );
}
