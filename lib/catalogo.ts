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
}

/** Valores por defecto si la migracion 005 aun no corrio. */
export function limitesDeFotos(p?: { min_fotos?: number; max_fotos?: number } | null) {
  const max = p?.max_fotos && p.max_fotos > 0 ? p.max_fotos : 5;
  const min = p?.min_fotos && p.min_fotos > 0 ? Math.min(p.min_fotos, max) : Math.min(3, max);
  return { min, max };
}

export async function listarPlantillas(): Promise<Plantilla[]> {
  const sb = supabaseAdmin();
  const { data } = await sb
    .from('plantillas')
    .select('*')
    .eq('activa', true)
    .order('orden');
  return (data ?? []) as Plantilla[];
}

export async function traerPlantilla(slug: string): Promise<Plantilla | null> {
  const sb = supabaseAdmin();
  const { data } = await sb
    .from('plantillas')
    .select('*')
    .eq('slug', slug)
    .eq('activa', true)
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
