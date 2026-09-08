import Link from 'next/link';
import { notFound } from 'next/navigation';
import ExperienciaForm from '@/components/ExperienciaForm';
import { supabaseAdmin } from '@/lib/supabase';
import { requerirAdminPagina } from '@/lib/admin-server';
import { firmarRuta, firmarRutas } from '@/lib/media';

/**
 * Edicion del admin: CRUD total sobre cualquier pedido, en cualquier estado.
 * Va por supabaseAdmin (service_role), que salta RLS y el trigger de
 * inmutabilidad. Es a proposito: el cliente no puede tocar un pedido
 * publicado, pero tu si, para cuando escriban pidiendo una correccion.
 *
 * OJO CON LAS FOTOS
 * En la base viven RUTAS del bucket privado. El formulario necesita las
 * dos cosas: la ruta (que es lo que se vuelve a guardar) y una URL firmada
 * (que es lo unico que un <img> puede mostrar). Se firman aqui, en el
 * servidor, porque firmar necesita la service_role.
 *
 * En Next 15 `params` es una promesa: hay que await-earla antes de leerla.
 */

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ slug: string }> };

export default async function EditarPage({ params }: Params) {
  const { slug } = await params;
  await requerirAdminPagina(`/admin/editar/${slug}`);

  const sb = supabaseAdmin();
  const { data: pedido } = await sb.from('pedidos').select('*').eq('slug', slug).maybeSingle();
  if (!pedido) notFound();

  const rutasFotos: string[] = Array.isArray(pedido.fotos) ? pedido.fotos : [];
  const previews = {
    fotos: await firmarRutas(rutasFotos),
    fotoFinal: await firmarRuta(pedido.foto_final),
  };

  return (
    <div className="mx-auto max-w-2xl p-8">
      <Link href="/admin" className="text-sm text-stone-500 hover:text-stone-900">
        &larr; Volver al panel
      </Link>

      <header className="mt-4 mb-6">
        <h1 className="text-2xl font-bold">Editar experiencia</h1>
        <p className="mt-1 text-sm text-stone-500">
          /{pedido.ocasion}/{pedido.slug} &middot; estado:{' '}
          <span className="font-medium text-stone-700">{pedido.estado}</span>
        </p>
      </header>

      {(pedido.estado === 'listo' || pedido.estado === 'archivado') && (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Esta experiencia ya está publicada y el cliente no puede editarla.
          Lo que cambies aquí se ve de inmediato en la página que él ya compartió.
        </div>
      )}

      <ExperienciaForm initialData={pedido} previews={previews} />
    </div>
  );
}
