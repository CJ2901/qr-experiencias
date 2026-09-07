import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export default async function Panel() {
  const sb = supabaseAdmin();
  const { data: pedidos } = await sb
    .from('pedidos')
    .select('id, ocasion, slug, tema, estado, destinatario, creado_en, media_expira_en')
    .order('creado_en', { ascending: false })
    .limit(100);

  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/+$/, '');

  return (
    <main className="admin">
      <h1>Pedidos</h1>
      <p className="sub">
        {pedidos?.length ?? 0} en total &middot;{' '}
        <Link href="/admin/nuevo">crear uno nuevo</Link>
      </p>

      <table>
        <thead>
          <tr>
            <th>Para</th><th>Ruta</th><th>Tema</th><th>Estado</th><th>Vence</th>
          </tr>
        </thead>
        <tbody>
          {(pedidos ?? []).map((p) => (
            <tr key={p.id}>
              <td>{p.destinatario}</td>
              <td>
                <a href={`${base}/${p.ocasion}/${p.slug}`} target="_blank" rel="noreferrer">
                  /{p.ocasion}/{p.slug}
                </a>
              </td>
              <td>{p.tema}</td>
              <td><span className={`chip ${p.estado}`}>{p.estado}</span></td>
              <td>
                {p.media_expira_en
                  ? new Date(p.media_expira_en).toLocaleDateString('es-PE')
                  : 'nunca'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
