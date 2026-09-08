import { redirect } from 'next/navigation';
import { usuarioActual } from '@/lib/supabase-server';
import { esCorreoAdmin } from '@/lib/admin';

/**
 * La puerta del panel.
 *
 * QUE CAMBIO Y POR QUE
 * Antes bastaba con la cookie `sesion_admin=ok`, puesta tras acertar una
 * contrasena compartida. Esa cookie no identificaba a nadie, no se podia
 * revocar y valia igual para cualquiera que la copiara. Ahora el panel
 * exige DOS cosas: sesion real de Supabase (el mismo magic link de los
 * clientes) y que ese correo este en ADMIN_EMAILS.
 *
 * Anadir "Entrar con Google" despues no toca este archivo: Supabase
 * devuelve el mismo usuario, y la lista de correos sigue siendo la puerta.
 */

/** Para paginas: si no es admin, lo manda a entrar. */
export async function requerirAdminPagina(destino = '/admin') {
  const usuario = await usuarioActual();
  if (!usuario) redirect(`/entrar?destino=${encodeURIComponent(destino)}`);
  if (!esCorreoAdmin(usuario.email)) redirect('/admin/sin-acceso');
  return usuario;
}

/**
 * Para server actions. Lanza en vez de redirigir.
 *
 * ESTO NO ES OPCIONAL: una server action es un endpoint publico con un id
 * adivinable. Sin esta linea, cualquiera podia pedir una URL firmada de
 * subida a nuestro bucket privado, o sobrescribir el pedido de otro.
 */
export async function requerirAdmin() {
  const usuario = await usuarioActual();
  if (!esCorreoAdmin(usuario?.email)) {
    throw new Error('No autorizado.');
  }
  return usuario!;
}
