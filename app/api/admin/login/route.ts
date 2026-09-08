import { NextResponse } from 'next/server';

/**
 * ELIMINADO. Aqui vivia el login por contrasena compartida del panel.
 *
 * Se quito porque esa cookie (`sesion_admin=ok`) no identificaba a nadie,
 * no se podia revocar y servia igual copiada a otro navegador. El panel
 * ahora exige sesion de Supabase + correo en ADMIN_EMAILS.
 *
 * Se responde 410 en vez de borrar la ruta para que quede claro que
 * desaparecio a proposito, y no por un despliegue a medias.
 */
export async function POST() {
  return NextResponse.json(
    { error: 'El panel ya no usa contraseña. Entra con tu correo en /entrar.' },
    { status: 410 }
  );
}

export async function DELETE() {
  // Limpia la cookie vieja en navegadores que todavia la carguen.
  const res = NextResponse.json({ ok: true });
  res.cookies.delete('sesion_admin');
  return res;
}
