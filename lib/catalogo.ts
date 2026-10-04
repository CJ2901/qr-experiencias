import { supabaseAdmin } from '@/lib/supabase';
import type { TemaId } from '@/lib/temas';

/**
 * El catalogo. El PRECIO SIEMPRE SALE DE AQUI, nunca del navegador.
 * Si el monto lo manda el cliente, cualquiera paga S/ 1 con un curl.
 */

export interface Plantilla {
  slug: string;
  nombre: string;
  descripcion: string;
  tema: TemaId;
  precio_centavos: number;
  moneda: string;
  max_fotos: number;
  /** Minimo para publicar. La migracion 005 lo pone en 3. */
  min_fotos: number;
  destacada: boolean;
  orden: number;
  /* migracion 007 */
  precio_regular_centavos: number;
  descripcion_larga: string | null;
  incluye: string[];
  tipo: 'permanente' | 'estacional';
  temporada: string | null;
  publico: 'pareja' | 'familia' | 'amistad' | 'general';
  con_voz: boolean;
  con_cancion: boolean;
  portada: string | null;
}

/** Descuento visible, en % entero. 0 si no hay precio regular mayor. */
export function descuento(p: Pick<Plantilla, 'precio_centavos' | 'precio_regular_centavos'>): number {
  const r = p.precio_regular_centavos ?? 0;
  return r > p.precio_centavos ? Math.round((1 - p.precio_centavos / r) * 100) : 0;
}

/** Valores por defecto si la migracion 005 aun no corrio. */
export function limitesDeFotos(p?: { min_fotos?: number; max_fotos?: number } | null) {
  const max = p?.max_fotos && p.max_fotos > 0 ? p.max_fotos : 5;
  const min = p?.min_fotos && p.min_fotos > 0 ? Math.min(p.min_fotos, max) : Math.min(3, max);
  return { min, max };
}

/**
 * Lo que se vende HOY: la vista `catalogo_vigente` (migracion 007) ya
 * filtra las activas y las estacionales fuera de su temporada. Asi una
 * plantilla de Navidad no se puede comprar en marzo ni por URL directa.
 */
export async function listarPlantillas(): Promise<Plantilla[]> {
  const { data } = await supabaseAdmin().from('catalogo_vigente').select('*').order('orden');
  return (data ?? []) as Plantilla[];
}

export async function traerPlantilla(slug: string): Promise<Plantilla | null> {
  const { data } = await supabaseAdmin()
    .from('catalogo_vigente')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();
  return (data as Plantilla) ?? null;
}

export function soles(centavos: number): string {
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: 'PEN',
    minimumFractionDigits: 2,
  }).format(centavos / 100);
}
