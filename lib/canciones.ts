/**
 * Las canciones que se pueden elegir para el regalo.
 *
 * Los mp3 viven en public/canciones/<id>.mp3 (se sirven estaticos, sin
 * pasar por Supabase). Para agregar una: copia el mp3 con ese nombre y
 * suma una linea aqui. Para quitarla: borra la linea (los regalos que ya
 * la usaban se quedan sin musica, no se rompen).
 *
 * LICENCIA: solo musica con permiso de uso comercial (p. ej. Pixabay Music
 * o una biblioteca con licencia pagada). Una cancion comercial conocida
 * sin licencia expone al negocio a reclamos de derechos de autor.
 */

export interface Cancion {
  id: string;
  titulo: string;
  ambiente: string;
}

export const CANCIONES: Cancion[] = [
  { id: 'piano-romantico', titulo: 'Piano romántico', ambiente: 'Suave y emotiva' },
  { id: 'acustica-calida', titulo: 'Acústica cálida', ambiente: 'Guitarra, íntima' },
  { id: 'ukelele-alegre', titulo: 'Ukelele alegre', ambiente: 'Para cumpleaños y celebraciones' },
  { id: 'cinematica', titulo: 'Cinemática', ambiente: 'Cuerdas, para una propuesta' },
];

export const esCancionValida = (id: unknown): id is string =>
  typeof id === 'string' && CANCIONES.some((c) => c.id === id);

export const urlCancion = (id: string | null | undefined): string | null =>
  esCancionValida(id) ? `/canciones/${id}.mp3` : null;
