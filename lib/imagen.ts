/**
 * Procesado de fotos en el navegador, antes de subirlas.
 *
 * Reducir y re-codificar tiene tres efectos, los tres buscados:
 *  - subidas rapidas desde datos moviles (una foto de 12 MP baja a ~500 KB);
 *  - se descartan los metadatos EXIF, incluida la UBICACION GPS donde se
 *    tomo la foto (muchas veces, la casa de la pareja);
 *  - se respeta la orientacion del celular (imageOrientation: 'from-image').
 */

export interface Area {
  x: number;
  y: number;
  width: number;
  height: number;
}

function aBlob(c: HTMLCanvasElement, calidad = 0.88): Promise<Blob> {
  return new Promise((ok, mal) =>
    c.toBlob((b) => (b ? ok(b) : mal(new Error('no_blob'))), 'image/jpeg', calidad)
  );
}

/** Reduce a `maxLado` px y re-codifica en JPEG. Si el navegador no puede decodificarla, devuelve el archivo tal cual. */
export async function prepararImagen(file: File, maxLado = 2400): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const escala = Math.min(1, maxLado / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * escala);
    c.height = Math.round(bmp.height * escala);
    c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
    bmp.close();
    return await aBlob(c, 0.9);
  } catch {
    return file;
  }
}

/** Recorta `area` (en pixeles de la imagen original) y la deja con ancho maximo `maxAncho`. */
export async function recortar(src: string, area: Area, maxAncho = 1600): Promise<Blob> {
  const img = new Image();
  img.src = src;
  await img.decode();
  const escala = Math.min(1, maxAncho / area.width);
  const c = document.createElement('canvas');
  c.width = Math.round(area.width * escala);
  c.height = Math.round(area.height * escala);
  c.getContext('2d')!.drawImage(img, area.x, area.y, area.width, area.height, 0, 0, c.width, c.height);
  return aBlob(c);
}
