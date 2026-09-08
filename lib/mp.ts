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

export const MP_ES_PRUEBA = (process.env.MP_ACCESS_TOKEN ?? '').startsWith('TEST-');

/** Correo que se manda a Mercado Pago como pagador. */
export function emailPagador(emailUsuario?: string | null): string {
  const forzado = process.env.MP_TEST_PAYER_EMAIL?.trim();

  if (MP_ES_PRUEBA && forzado) {
    // La trampa que nos costo tres vueltas: dejar un @testuser.com aqui
    // hace fallar TODOS los pagos con 403, y el mensaje de MP no dice por que.
    if (forzado.endsWith('@testuser.com')) {
      console.warn(
        '[mp] MP_TEST_PAYER_EMAIL apunta a un usuario de prueba (@testuser.com). ' +
          'Mercado Pago rechaza eso con 403 "Payer email forbidden" cuando la cuenta ' +
          'cobradora es real. Se ignora y se usa el correo del comprador.'
      );
    } else {
      return forzado;
    }
  }

  return emailUsuario ?? '';
}
