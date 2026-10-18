/**
 * Detecta errores de tipeo en el dominio del correo ("gmial.com",
 * "hotmal.com") y sugiere el correcto. Es la red de seguridad que queda
 * cuando el comprador pega el mismo correo en los dos campos.
 */

const DOMINIOS = [
  'gmail.com', 'hotmail.com', 'outlook.com', 'yahoo.com', 'icloud.com',
  'live.com', 'hotmail.es', 'outlook.es', 'yahoo.es', 'msn.com',
];

function distancia(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

/** Devuelve el correo corregido, o null si el dominio ya es conocido o no se parece a ninguno. */
export function sugerirCorreo(email: string): string | null {
  const [usuario, dominio] = email.trim().toLowerCase().split('@');
  if (!usuario || !dominio || DOMINIOS.includes(dominio)) return null;
  let mejor: { d: string; dist: number } | null = null;
  for (const d of DOMINIOS) {
    const dist = distancia(dominio, d);
    if (dist <= 2 && (!mejor || dist < mejor.dist)) mejor = { d, dist };
  }
  return mejor ? `${usuario}@${mejor.d}` : null;
}
