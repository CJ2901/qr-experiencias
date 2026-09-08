/**
 * Quien es admin. SOLO funciones puras: este modulo lo importa el
 * middleware, que corre en el runtime Edge y no puede tocar next/headers.
 * Lo que necesita sesion vive en lib/admin-server.ts.
 */

/** Correos autorizados, de ADMIN_EMAILS separados por coma. */
export function correosAdmin(): string[] {
  return (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Sin lista configurada NADIE es admin.
 * Es deliberado: una variable vacia no puede abrir el panel a todos.
 */
export function esCorreoAdmin(email?: string | null): boolean {
  const lista = correosAdmin();
  if (!lista.length) return false;
  return !!email && lista.includes(email.trim().toLowerCase());
}
