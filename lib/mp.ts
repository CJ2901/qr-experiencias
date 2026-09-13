/**
 * Ambiente de Mercado Pago y quien figura como pagador.
 *
 * LA REGLA, COMPROBADA CON DATOS (scripts/probar-pago.mjs, set. 2026)
 * Mercado Pago exige que pagador y cobrador sean de la MISMA naturaleza.
 * Con credenciales TEST- de una cuenta REAL, el cobrador es real, asi que
 * un pagador @testuser.com es una mezcla y MP responde:
 *
 *     403 · code 4390 · "Payer email forbidden"
 *
 * Los usuarios de prueba (@testuser.com) sirven en el flujo de DOS
 * usuarios de prueba: vendedor de prueba + comprador de prueba, usando
 * las credenciales del vendedor de prueba. No es nuestro caso.
 *
 * Por eso aqui NO se sustituye el correo por uno de prueba. Se manda el
 * del comprador, que es real y distinto del de la cuenta. Verificado:
 * ese mismo pago sale `approved / accredited`.
 */

/**
 * QUE AMBIENTE ES ESTE. No se puede deducir del prefijo del token.
 *
 * Lo dijo Mercado Pago al rechazar POST /v1/orders (set. 2026):
 *   "Test credentials are not supported, use test users with production
 *    credentials to sandbox environment"
 *
 * O sea: el sandbox de verdad son las credenciales APP_USR- de un USUARIO
 * DE PRUEBA. Con el prefijo a secas ese caso se leia como produccion y se
 * caian dos cosas a la vez: el cartel de "modo prueba" del checkout y el
 * MP_TEST_PAYER_EMAIL. Por eso el ambiente ahora es explicito.
 *
 *   MP_MODO=prueba       credenciales APP_USR- de un usuario de prueba
 *   MP_MODO=produccion   cuenta real cobrando de verdad
 *   (sin MP_MODO)        se deduce del prefijo, como antes
 */
const MODO = (process.env.MP_MODO ?? '').trim().toLowerCase();
const TOKEN_ES_TEST = (process.env.MP_ACCESS_TOKEN ?? '').startsWith('TEST-');

export const MP_ES_PRUEBA =
  MODO === 'prueba' ? true : MODO === 'produccion' ? false : TOKEN_ES_TEST;

/* No hay MP_MARCAR_PRUEBA / X-Test-Token: esa cabecera hacia falta para
   /v1/payments, que ya no usamos. La Orders API cobra igual con y sin
   ella (medido en scripts/probar-orden-token.mjs), asi que el codigo es
   el mismo en prueba y en produccion — que es como debe ser. */

/** Correo que se manda a Mercado Pago como pagador. */
export function emailPagador(emailUsuario?: string | null): string {
  const forzado = process.env.MP_TEST_PAYER_EMAIL?.trim();

  if (MP_ES_PRUEBA && forzado) {
    // Un @testuser.com aqui es correcto o catastrofico segun QUIEN cobre,
    // y este proceso no puede saberlo sin llamar a MP. Los dos casos:
    //
    //   cobra una cuenta REAL con credenciales TEST-
    //     -> pagador @testuser.com = 403 code 4390 "Payer email forbidden".
    //        Mezclar naturalezas es lo que MP prohibe. Fue lo que nos
    //        costo tres vueltas en set. 2026.
    //   cobra un VENDEDOR DE PRUEBA (nickname TESTUSER…)
    //     -> pagador @testuser.com es JUSTO lo que hay que mandar, y
    //        cualquier gmail real da 403 por la misma regla al reves.
    //
    // Antes esto lo ignoraba y usaba el correo del comprador, lo que hacia
    // imposible el segundo caso. Ahora se respeta lo configurado —quien
    // pone la variable sabe con que cuenta esta cobrando— y solo se avisa.
    if (forzado.endsWith('@testuser.com')) {
      console.warn(
        '[mp] MP_TEST_PAYER_EMAIL es un usuario de prueba (@testuser.com). ' +
          'Correcto SOLO si MP_ACCESS_TOKEN es de un vendedor de prueba. ' +
          'Si es de una cuenta real, esto devuelve 403 "Payer email forbidden": ' +
          'compruebalo con scripts/probar-vendedor-prueba.mjs.'
      );
    }
    return forzado;
  }

  return emailUsuario ?? '';
}
