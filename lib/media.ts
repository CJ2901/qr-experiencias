import { supabaseAdmin } from '@/lib/supabase';

/**
 * El bucket `media` es PRIVADO. En la base guardamos rutas
 * ("pedidos/abc/1.jpg"), no URLs, y se firman en cada render: eso es lo
 * que hace real la caducidad.
 *
 * Corolario que costo un bug: una ruta NO se puede poner en un <img src>.
 * El navegador la resuelve relativa a la pagina y da 404. Si vas a mostrar
 * una foto guardada, firmala antes. Siempre.
 */
export async function firmarRutas(rutas: string[], segundos = 60 * 60 * 6): Promise<string[]> {
  if (!rutas.length) return [];
  const sb = supabaseAdmin();
  const { data, error } = await sb.storage.from('media').createSignedUrls(rutas, segundos);
  if (error || !data) return [];
  return data.map((d) => d.signedUrl).filter(Boolean) as string[];
}

/** Igual, para una sola ruta que puede no existir. */
export async function firmarRuta(ruta?: string | null, segundos = 60 * 60 * 6) {
  if (!ruta) return null;
  const [url] = await firmarRutas([ruta], segundos);
  return url ?? null;
}
