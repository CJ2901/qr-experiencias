import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { supabaseSesion, usuarioActual } from '@/lib/supabase-server';
import FormularioGuiado from '@/components/tienda/FormularioGuiado';
import { temaDe } from '@/lib/temas';
import { supabaseAdmin } from '@/lib/supabase';
import { limitesDeFotos } from '@/lib/catalogo';
import { firmarRutas } from '@/lib/media';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

export default async function Completar({ params }: Params) {
  const { id } = await params;

  const usuario = await usuarioActual();
  if (!usuario) redirect(`/entrar?destino=${encodeURIComponent(`/pedido/${id}/completar`)}`);

  // RLS ya filtra por dueno: si no es suyo, simplemente no existe.
  const sb = await supabaseSesion();
  const { data: pedido } = await sb.from('pedidos').select('*').eq('id', id).maybeSingle();
  if (!pedido) notFound();

  if (pedido.estado === 'listo' || pedido.estado === 'archivado') {
    redirect(`/pedido/${id}/listo`);
  }
  if (pedido.estado === 'pendiente_pago') {
    return (
      <main className="mx-auto max-w-md px-5 py-20 text-center">
        <h1 className="text-xl font-semibold text-stone-900">Tu pago está en revisión</h1>
        <p className="mt-3 text-sm leading-relaxed text-stone-600">
          Mercado Pago todavía no lo confirma. Apenas se acredite podrás personalizar tu
          experiencia — te avisamos por correo y aquí mismo.
        </p>
        <Link href="/mis-pedidos" className="mt-6 inline-block text-sm font-medium underline underline-offset-4">
          Volver a mis pedidos
        </Link>
      </main>
    );
  }

  const tema = temaDe(pedido.tema);

  // Los limites salen de la plantilla del mismo tema, no de una constante:
  // asi se ajustan desde la base sin volver a desplegar.
  const { data: plantilla } = await supabaseAdmin()
    .from('plantillas')
    .select('min_fotos, max_fotos')
    .eq('tema', pedido.tema)
    .maybeSingle();
  const limites = limitesDeFotos(plantilla);

  // El bucket es privado: las miniaturas necesitan URL firmada.
  const rutas: string[] = Array.isArray(pedido.fotos) ? pedido.fotos : [];
  const firmadas = await firmarRutas(rutas);
  const previews = Object.fromEntries(rutas.map((r, i) => [r, firmadas[i]]).filter(([, u]) => u));

  return (
    <main className="mx-auto max-w-xl px-5 py-10">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-rose-700">Paso 3 de 3</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-stone-900">
        Ahora sí, lo importante
      </h1>
      <p className="mt-2 text-[15px] leading-relaxed text-stone-600">
        Cuatro pasos cortos. Se guarda solo al avanzar, así que puedes cerrar
        y volver cuando quieras.
      </p>

      <FormularioGuiado
        pedidoId={pedido.id}
        maxChars={tema.maxChars}
        limites={limites}
        previews={previews}
        inicial={{
          destinatario: pedido.destinatario ?? '',
          frase_principal: pedido.frase_principal ?? '',
          fecha_texto: pedido.fecha_texto ?? '',
          mensaje: pedido.mensaje ?? '',
          frase_capitulo: pedido.frase_capitulo ?? '',
          frase_brindis: pedido.frase_brindis ?? '',
          frase_final: pedido.frase_final ?? '',
          fotos: Array.isArray(pedido.fotos) ? pedido.fotos : [],
          foto_final: pedido.foto_final ?? null,
        }}
      />
    </main>
  );
}
