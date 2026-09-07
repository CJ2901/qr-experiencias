const ALFABETO = '23456789abcdefghjkmnpqrstuvwxyz';

/** Slug corto, sin caracteres que se confundan al dictarlo por telefono. */
export function nuevoSlug(largo = 10): string {
  const bytes = new Uint8Array(largo);
  crypto.getRandomValues(bytes);
  let s = '';
  for (const b of bytes) s += ALFABETO[b % ALFABETO.length];
  return s;
}
