/**
 * Variables de entorno que, si faltan, tienen que fallar diciendo cual.
 *
 * POR QUE EXISTE ESTE ARCHIVO
 * El proyecto estaba lleno de `process.env.X!`. Esa exclamacion no
 * comprueba nada: solo le promete a TypeScript que el valor existe. Si no
 * existe, lo que llega a Supabase es `undefined` y el error que sube es
 * generico. En local se nota enseguida; en Vercel el usuario ve
 *
 *   Application error: a server-side exception has occurred
 *   Digest: 4262007512
 *
 * y no hay forma de saber que faltaba una variable. Paso el 13/09/2026 en
 * el primer despliegue, porque `.env*` esta en .gitignore —como debe— y
 * ninguna variable habia sido cargada en el panel de Vercel.
 *
 * Con `requerir()` el mensaje que queda en los Runtime Logs de Vercel dice
 * el nombre exacto de la variable que falta. El digest sigue siendo opaco
 * para el visitante, pero para nosotros deja de ser una adivinanza.
 */
export function requerir(nombre: string): string {
  const v = process.env[nombre];
  if (!v) {
    throw new Error(
      `Falta la variable de entorno ${nombre}. ` +
        `En Vercel: Settings > Environment Variables, y vuelve a desplegar ` +
        `(las NEXT_PUBLIC_ se incrustan al construir, no al arrancar).`
    );
  }
  return v;
}
