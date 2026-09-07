/**
 * Los cuatro temas visuales.
 *
 * Los COLORES no viven aqui: viven en app/globals.css bajo [data-tema="..."].
 * Aqui va solo lo que el codigo necesita decidir: que carrusel monta, que
 * fuentes carga y a que tamano escribe la carta a mano.
 */

export type TemaId = 'correspondencia' | 'luz-de-vela' | 'herbario' | 'editorial';
export type Carrusel = 'baraja' | 'coverflow' | 'abanico' | 'tira';

export interface Tema {
  id: TemaId;
  nombre: string;
  carrusel: Carrusel;
  /** Tamano de la letra manuscrita en unidades SVG. */
  manoSize: number;
  /** Caracteres por renglon de la carta. Depende de lo ancha que sea la pluma. */
  maxChars: number;
  /** Ornamentos propios del tema. */
  deco: 'matasellos' | 'ninguno' | 'ramita';
  /** Una sola peticion a Google Fonts, solo con lo que este tema usa. */
  fuentes: string;
}

const G = 'https://fonts.googleapis.com/css2?';

export const TEMAS: Record<TemaId, Tema> = {
  correspondencia: {
    id: 'correspondencia',
    nombre: 'Correspondencia',
    carrusel: 'baraja',
    manoSize: 15,
    maxChars: 26,
    deco: 'matasellos',
    fuentes:
      G +
      'family=EB+Garamond:ital,wght@0,400;0,500;1,400;1,500&family=Lora:ital,wght@0,400;1,400&family=Homemade+Apple&display=swap',
  },
  'luz-de-vela': {
    id: 'luz-de-vela',
    nombre: 'Luz de vela',
    carrusel: 'coverflow',
    manoSize: 20,
    maxChars: 24,
    deco: 'ninguno',
    fuentes:
      G +
      'family=Fraunces:opsz,wght@9..144,300;9..144,400;9..144,500&family=Karla:wght@300;400;500;600&family=Caveat:wght@400;600&display=swap',
  },
  herbario: {
    id: 'herbario',
    nombre: 'Herbario',
    carrusel: 'abanico',
    manoSize: 19,
    maxChars: 25,
    deco: 'ramita',
    fuentes:
      G +
      'family=Marcellus&family=Karla:wght@300;400;500;600&family=Shadows+Into+Light&display=swap',
  },
  editorial: {
    id: 'editorial',
    nombre: 'Editorial',
    carrusel: 'tira',
    manoSize: 18,
    maxChars: 26,
    deco: 'ninguno',
    fuentes:
      G +
      'family=Archivo:wght@400;600;700&family=Karla:wght@300;400;500;600&family=Nothing+You+Could+Do&display=swap',
  },
};

export const TEMAS_LISTA = Object.values(TEMAS);

export function esTemaValido(v: unknown): v is TemaId {
  return typeof v === 'string' && v in TEMAS;
}

/** Meses de vigencia por plan. `siempre` no vence. */
export const RETENCIONES: Record<string, number | null> = {
  '6m': 6,
  '12m': 12,
  '24m': 24,
  siempre: null,
};

export function calcularVencimiento(retencion: string): string | null {
  const meses = RETENCIONES[retencion];
  if (meses == null) return null;
  const d = new Date();
  d.setMonth(d.getMonth() + meses);
  return d.toISOString();
}
