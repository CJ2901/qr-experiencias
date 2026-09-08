/**
 * Las ocasiones que acepta el checkout.
 *
 * Vive aqui y no dentro de la pagina porque el servidor TIENE que validar
 * contra la misma lista: `ocasion` es clave foranea de la tabla `ocasiones`,
 * asi que un valor inventado revienta el INSERT... DESPUES de haber cobrado.
 * Validarlo antes de llamar a Mercado Pago cierra ese hueco.
 */

export const OCASIONES = [
  { valor: 'cumpleanos', etiqueta: 'Cumpleaños' },
  { valor: 'aniversario', etiqueta: 'Aniversario' },
  { valor: 'cumplemes', etiqueta: 'Cumple mes' },
  { valor: 'propuesta', etiqueta: '¿Quieres ser mi novia?' },
  { valor: 'porque-si', etiqueta: 'Porque sí' },
] as const;

export const OCASION_POR_DEFECTO = 'cumpleanos';

export function esOcasionValida(valor: unknown): valor is string {
  return typeof valor === 'string' && OCASIONES.some((o) => o.valor === valor);
}
