'use server';

import { supabaseAdmin } from '@/lib/supabase';
import { requerirAdmin } from '@/lib/admin-server';

/**
 * Server actions del panel.
 *
 * LO QUE FALTABA AQUI
 * Una server action NO es una funcion privada: Next la expone como un
 * endpoint POST con un id que viaja en el HTML. Sin comprobar quien llama,
 * `generarUrlSubida` entregaba a cualquier visitante una URL firmada para
 * escribir en el bucket privado, y `guardarPedidoAction` dejaba sobrescribir
 * el pedido de otro usando NUESTRA API_KEY. Por eso las dos empiezan
 * ahora con requerirAdmin().
 */

/** Solo rutas dentro de pedidos/, sin escapes. La ruta viene del navegador. */
const RUTA_VALIDA = /^pedidos\/[A-Za-z0-9][A-Za-z0-9._-]{0,60}\/[A-Za-z0-9][A-Za-z0-9._-]{0,90}$/;

export async function generarUrlSubida(ruta: string) {
  await requerirAdmin();

  if (typeof ruta !== 'string' || ruta.includes('..') || !RUTA_VALIDA.test(ruta)) {
    throw new Error('Ruta de archivo no permitida.');
  }

  const sb = supabaseAdmin();
  const { data, error } = await sb.storage.from('media').createSignedUploadUrl(ruta);
  if (error) throw new Error(error.message);
  return data;
}

/** Guarda el pedido a traves de /api/pedidos, que ya hace el upsert. */
export async function guardarPedidoAction(payload: Record<string, unknown>) {
  await requerirAdmin();

  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, '') || 'http://localhost:3000';

  const response = await fetch(`${baseUrl}/api/pedidos`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.API_KEY || '',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(errorData.error || `Error: ${response.status}`);
  }

  return response.json();
}
