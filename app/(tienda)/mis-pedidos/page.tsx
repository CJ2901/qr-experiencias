import Link from 'next/link';
import { redirect } from 'next/navigation';
import { supabaseSesion, usuarioActual } from '@/lib/supabase-server';
import { soles } from '@/lib/catalogo';
import BotonRevisarPago from '@/components/tienda/BotonRevisarPago';

export const dynamic = 'force-dynamic';

/**
 * El seguro contra la pestana cerrada. RLS hace el trabajo: la consulta
 * no filtra por comprador, la politica ya lo hace.
 */

const ETIQUETA: Record<string, { texto: string; clase: string }> = {
  pendiente_pago:  { texto: 'Pago en proceso',   clase: 'bg-amber-100 text-amber-900' },
  pendiente_datos: { texto: 'Falta tu contenido', clase: 'bg-rose-100 text-rose-900' },
  listo:           { texto: 'Publicada',          clase: 'bg-emerald-100 text-emerald-900' },
  borrador:        { texto: 'Borrador',           clase: 'bg-stone-100 text-stone-700' },
  archivado:       { texto: 'Archivada',          clase: 'bg-stone-100 text-stone-500' },
};

export default async function MisPedidos() {
  const usuario = await usuarioActual();
  if (!usuario) redirect('/entrar?destino=/mis-pedidos');

  const sb = await supabaseSesion();
  const { data: pedidos } = await sb
    .from('pedidos')
    .select('id, ocasion, slug, tema, estado, destinatario, precio_centavos, creado_en, mp_payment_id')
    .order('creado_en', { ascending: false });

  const pendientes = (pedidos ?? []).filter((p) => p.estado === 'pendiente_datos');

  return (
    <main className="mx-auto max-w-3xl px-5 py-12">
      <h1 className="text-2xl font-semibold tracking-tight text-stone-900">Mis pedidos</h1>
      <p className="mt-1.5 text-sm text-stone-600">{usuario.email}</p>

      {pendientes.length > 0 && (
        <div className="mt-6 rounded-xl border border-rose-200 bg-rose-50 p-4">
          <p className="text-sm font-medium text-rose-900">
            Tienes {pendientes.length === 1 ? 'un pedido' : `${pendientes.length} pedidos`} esperando tu contenido.
          </p>
          <Link
            href={`/pedido/${pendientes[0].id}/completar`}
            className="mt-2 inline-block text-sm font-semibold text-rose-800 underline underline-offset-4"
          >
            Continuar donde lo dejaste &rarr;
          </Link>
        </div>
      )}

      <ul className="mt-8 space-y-3">
        {(pedidos ?? []).length === 0 && (
          <li className="rounded-xl border border-dashed border-stone-300 p-8 text-center text-sm text-stone-500">
            Todavía no tienes pedidos.{' '}
            <Link href="/catalogo" className="font-medium text-stone-900 underline underline-offset-4">
              Ver el catálogo
            </Link>
          </li>
        )}

        {(pedidos ?? []).map((p) => {
          const e = ETIQUETA[p.estado] ?? ETIQUETA.borrador;
          return (
            <li
              key={p.id}
              className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-stone-200 bg-white p-4"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2.5">
                  <span className="font-medium text-stone-900">
                    {p.destinatario || 'Sin nombre todavía'}
                  </span>
                  <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${e.clase}`}>
                    {e.texto}
                  </span>
                </div>
                <p className="mt-1 text-xs text-stone-500">
                  {p.ocasion} · {p.tema}
                  {p.precio_centavos ? ` · ${soles(p.precio_centavos)}` : ''}
                  {' · '}
                  {new Date(p.creado_en).toLocaleDateString('es-PE')}
                </p>
                {p.mp_payment_id && (
                  <p className="mt-0.5 text-[11px] text-stone-400">
                    Pago Mercado Pago n.º{' '}
                    <span className="font-mono">{p.mp_payment_id}</span>
                  </p>
                )}
              </div>

              {p.estado === 'pendiente_pago' && <BotonRevisarPago pedidoId={p.id} />}

              {p.estado === 'pendiente_datos' && (
                <Link
                  href={`/pedido/${p.id}/completar`}
                  className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700"
                >
                  Completar
                </Link>
              )}
              {p.estado === 'listo' && (
                <div className="flex gap-2">
                  <Link
                    href={`/pedido/${p.id}/listo`}
                    className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium hover:bg-stone-50"
                  >
                    Ver QR
                  </Link>
                  <Link
                    href={`/${p.ocasion}/${p.slug}`}
                    className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700"
                  >
                    Abrir
                  </Link>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </main>
  );
}
