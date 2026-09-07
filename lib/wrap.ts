/**
 * Corta el mensaje en renglones para la carta manuscrita.
 * El ancho del papel es fijo (292 unidades SVG), asi que el corte
 * se hace aqui, en el servidor, y no en el navegador. Una cadena
 * vacia representa un renglon en blanco entre parrafos.
 */
export function cortarLineas(texto: string, max = 27): string[] {
  const parrafos = texto.trim().split(/\n\s*\n/);
  const salida: string[] = [];

  parrafos.forEach((p, i) => {
    if (i > 0) salida.push('');
    let linea = '';
    for (const palabra of p.replace(/\s+/g, ' ').trim().split(' ')) {
      if (!linea) { linea = palabra; continue; }
      if ((linea + ' ' + palabra).length <= max) linea += ' ' + palabra;
      else { salida.push(linea); linea = palabra; }
    }
    if (linea) salida.push(linea);
  });

  return salida;
}
