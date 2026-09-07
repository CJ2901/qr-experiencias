'use client';

import { useState } from 'react';
import { TEMAS_LISTA } from '@/lib/temas';

const OCASIONES = ['cumpleanos', 'aniversario', 'cumplemes', 'propuesta', 'porque-si'];

export default function Nuevo() {
  const [estado, setEstado] = useState<{ ok?: string; error?: string }>({});
  const [cargando, setCargando] = useState(false);

  async function crear(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCargando(true); setEstado({});
    const fd = new FormData(e.currentTarget);
    const cuerpo = Object.fromEntries(fd.entries());

    const r = await fetch('/api/pedidos', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': String(cuerpo.api_key ?? '') },
      body: JSON.stringify({ ...cuerpo, estado: 'listo' }),
    });
    const j = await r.json();
    setCargando(false);
    if (r.ok) setEstado({ ok: j.url });
    else setEstado({ error: j.error ?? 'error' });
  }

  return (
    <main className="admin">
      <h1>Nuevo pedido</h1>
      <p className="sub">
        El slug se genera solo. El mensaje se corta en renglones al renderizar, no lo cortes tu.
      </p>

      <form onSubmit={crear}>
        <label>Clave de API
          <input name="api_key" type="password" required placeholder="la misma de API_KEY" />
        </label>
        <label>Ocasion (primer segmento de la URL)
          <select name="ocasion" required>
            {OCASIONES.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </label>
        <label>Tema visual
          <select name="tema">
            {TEMAS_LISTA.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
          </select>
        </label>
        <label>Para (nombre que aparece grande)
          <input name="destinatario" required placeholder="Cris" />
        </label>
        <label>Pareja (opcional, sale en la pestana)
          <input name="pareja" placeholder="Greg &amp; Cris" />
        </label>
        <label>Frase principal (acepta &lt;br&gt;)
          <input name="frase_principal" required />
        </label>
        <label>Fecha
          <input name="fecha_texto" placeholder="18 de junio" />
        </label>
        <label>Mensaje de la carta
          <textarea name="mensaje" required placeholder="Una linea en blanco separa parrafos." />
        </label>
        <label>Frase de capitulo
          <input name="frase_capitulo" />
        </label>
        <label>Frase del brindis
          <input name="frase_brindis" />
        </label>
        <label>Frase final
          <input name="frase_final" />
        </label>
        <label>Retencion de fotos
          <select name="retencion" defaultValue="12m">
            <option value="6m">6 meses</option>
            <option value="12m">12 meses</option>
            <option value="24m">24 meses</option>
            <option value="siempre">siempre</option>
          </select>
        </label>

        {estado.error && <p className="aviso">{estado.error}</p>}
        {estado.ok && (
          <p className="aviso ok">
            Listo: <a href={estado.ok} target="_blank" rel="noreferrer">{estado.ok}</a>
          </p>
        )}
        <button className="btn" disabled={cargando}>{cargando ? 'Creando...' : 'Crear pedido'}</button>
      </form>
    </main>
  );
}
