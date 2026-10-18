/**
 * La fecha del regalo se elige con calendario (yyyy-mm-dd) pero se guarda
 * como texto ya escrito ("18 de junio de 2026"): es lo que se pinta en la
 * portada y no depende de la zona horaria de quien abre el regalo.
 */

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

/** "2026-06-18" → "18 de junio de 2026". Sin Date(): nada de zonas horarias. */
export function isoATexto(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return '';
  return `${Number(m[3])} de ${MESES[Number(m[2]) - 1]} de ${m[1]}`;
}

/** "18 de junio de 2026" → "2026-06-18". '' si el texto no tiene ese formato (fechas antiguas escritas a mano). */
export function textoAIso(texto: string | null | undefined): string {
  const m = /^(\d{1,2}) de ([a-záéíóú]+) de (\d{4})$/i.exec((texto ?? '').trim());
  if (!m) return '';
  const mes = MESES.indexOf(m[2].toLowerCase()) + 1;
  if (!mes) return '';
  return `${m[3]}-${String(mes).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}

/** Para el matasellos: "18 JUN". Si el texto es libre, sus primeros 6 caracteres. */
export function fechaCorta(texto: string | null | undefined): string {
  const t = (texto ?? '').trim();
  const m = /^(\d{1,2}) de ([a-záéíóú]+)/i.exec(t);
  if (m) return `${m[1]} ${m[2].slice(0, 3).toUpperCase()}`;
  return t.slice(0, 6);
}
