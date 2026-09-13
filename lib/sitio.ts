import { headers } from 'next/headers';

/**
 * La URL publica del sitio, para armar enlaces que salen de aqui:
 * el del correo del magic link y el que se le enseña al comprador.
 *
 * POR QUE NO ES SIMPLEMENTE process.env.NEXT_PUBLIC_SITE_URL
 * Porque el modo de fallar de esa variable es silencioso y caro. Si en
 * Vercel se queda con el valor de desarrollo, el enlace magico que le
 * llega al comprador apunta a `http://localhost:3000` — a SU maquina, no
 * a la nuestra— y el correo es inservible. No hay error, no hay log: el
 * cliente escribe diciendo que el enlace no funciona.
 *
 * Asi que la variable se respeta, salvo cuando dice localhost y la
 * peticion no viene de localhost. Ahi manda el host real de la peticion,
 * que en Vercel llega en x-forwarded-host y no se puede equivocar.
 */
export async function baseDelSitio(): Promise<string> {
  const configurado = (process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/+$/, '');

  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? '';
  const protocolo = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  const real = host ? `${protocolo}://${host}` : '';

  const esLocal = (u: string) => /localhost|127\.0\.0\.1/.test(u);

  if (!configurado) return real;
  if (esLocal(configurado) && real && !esLocal(real)) {
    console.warn(
      `[sitio] NEXT_PUBLIC_SITE_URL apunta a "${configurado}" pero la petición ` +
        `llegó a "${real}". Se usa el host real; corrige la variable en Vercel.`
    );
    return real;
  }
  return configurado;
}
