/**
 * Las frases de la dedicatoria se guardan como HTML minimo (solo <br>)
 * porque la pagina del regalo las pinta con innerHTML. Estas dos funciones
 * son el ida y vuelta entre lo que escribe el comprador y lo que se guarda.
 */

/** Texto del formulario → HTML seguro. Escapa todo; solo sobrevive el salto de linea. */
export function aHtmlSeguro(s: string): string {
  return s
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');
}

/** HTML guardado → texto para volver a editarlo (sin esto, cada guardado duplicaria los &amp;). */
export function aTextoEditable(s: string | null | undefined): string {
  return (s ?? '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}
