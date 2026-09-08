import { redirect } from 'next/navigation';

/**
 * Tumba de la contrasena compartida.
 *
 * El panel ya no tiene login propio: usa la misma sesion de Supabase que
 * los clientes, y la autorizacion la da ADMIN_EMAILS. Esta pagina queda
 * solo para que los enlaces viejos y los marcadores no den 404.
 */
export default function LoginObsoleto() {
  redirect('/entrar?destino=/admin');
}
