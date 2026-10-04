import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { supabaseAdmin } from '@/lib/supabase';
import { accesoValido } from '@/lib/acceso';
import { temaDe } from '@/lib/temas';
import { limitesDeFotos } from '@/lib/catalogo';
import { firmarRutas } from '@/lib/media';
import { baseDelSitio } from '@/lib/sitio';
import FormularioGuiado from '@/components/tienda/FormularioGuiado';
import BotonRevisarPago from '@/components/tienda/BotonRevisarPago';
import TarjetaQR from '@/components/tienda/TarjetaQR';

/**
 * /editar/<pedidoId>/<firma> — la pantalla del comprador, sin cuenta.
 *
 * Es la MISMA URL de principio a fin, y muestra lo que toca segun el estado:
 *   pendiente_pago   → "tu pago esta en revision" + "Ya pague, revisar"
 *   pendiente_datos  → el editor de la dedicatoria
 *   listo/archivado  → el QR y el enlace del regalo
 * Asi el enlace del correo 1 sirve siempre, llegue cuando llegue.
 */

export const dynamic = 'force-dynamic';

// La URL es una llave: ni buscadores, ni Referer hacia terceros.
export const metadata: Metadata = {
  title: 'Tu dedicatoria',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

type Params = { params: Promise<{ id: string; firma: string }> };

const ocultar = (email: string) => email.replace(/^(.{2}).*(@.*)$/, '$1…$2');

export default async function Editar({ params }: Params) {
  const acceso = await params;
  if (!accesoValido(acceso)) notFound();

  const { data: pedido } = await supabaseAdmin()
    .from('pedidos')
    .select(
      'id, ocasion, slug, tema, estado, comprador_email, destinatario, frase_principal, fecha_texto, mensaje, frase_capitulo, frase_brindis, frase_final, fotos, foto_final'
    )
    .eq('id', acceso.id)
    .maybeSingle();
  if (!pedido) notFound();

  const correo = pedido.comprador_email ? ocultar(pedido.comprador_email) : 'tu correo';

  /* ---------------------------------------------------- publicado */
  if (pedido.estado === 'listo' || pedido.estado === 'archivado') {
    const base = await baseDelSitio();
    const url = `${base}/${pedido.ocasion}/${pedido.slug}`;
    return (
      <main className="mx-auto max-w-xl px-5 py-12 text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-stone-900">Tu regalo ya está listo</h1>
        <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-stone-600">
          Te enviamos el QR y el enlace a <strong className="font-medium text-stone-800">{correo}</strong>.
          Imprímelo o compártelo: al escanearlo se abre todo lo que escribiste.
        </p>
        <div className="mt-10">
          <TarjetaQR url={url} destinatario={pedido.destinatario ?? ''} />
        </div>
        <Link
          href={`/${pedido.ocasion}/${pedido.slug}`}
          className="mt-10 inline-block rounded-xl border border-stone-300 px-5 py-2.5 text-sm font-medium hover:bg-stone-50"
        >
          Ver cómo quedó
        </Link>
        <p className="mx-auto mt-8 max-w-md text-xs leading-relaxed text-stone-500">
          ¿Se te pasó un error? Escríbenos con este código y lo corregimos:{' '}
          <span className="font-mono text-stone-700">{pedido.slug}</span>
        </p>
      </main>
    );
  }

  /* ---------------------------------------------- pago en revision */
  if (pedido.estado === 'pendiente_pago') {
    return (
      <main className="mx-auto max-w-md px-5 py-20 text-center">
        <h1 className="text-xl font-semibold text-stone-900">Tu pago está en revisión</h1>
        <p className="mt-3 text-sm leading-relaxed text-stone-600">
          Mercado Pago todavía no lo confirma. Apenas se acredite, esta misma página
          se convierte en el editor y te avisamos a <strong className="font-medium">{correo}</strong>.
        </p>
        <div className="mt-6 flex justify-center">
          <BotonRevisarPago acceso={acceso} />
        </div>
      </main>
    );
  }

  /* ------------------------------------------------------- editor */
  const tema = temaDe(pedido.tema);
  const { data: plantilla } = await supabaseAdmin()
    .from('plantillas')
    .select('min_fotos, max_fotos')
    .eq('tema', pedido.tema)
    .maybeSingle();
  const limites = limitesDeFotos(plantilla);

  const rutas: string[] = Array.isArray(pedido.fotos) ? pedido.fotos : [];
  const firmadas = await firmarRutas(rutas);
  const previews = Object.fromEntries(rutas.map((r, i) => [r, firmadas[i]]).filter(([, u]) => u));

  return (
    <main className="mx-auto max-w-xl px-5 py-10">
      <h1 className="text-2xl font-semibold tracking-tight text-stone-900">Escribe tu dedicatoria</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-stone-600">
        Se guarda sola al avanzar. Te enviamos este enlace a{' '}
        <strong className="font-medium text-stone-800">{correo}</strong> por si quieres terminar después.
      </p>

      <FormularioGuiado
        acceso={acceso}
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
          fotos: rutas,
          foto_final: pedido.foto_final ?? null,
        }}
      />
    </main>
  );
}
