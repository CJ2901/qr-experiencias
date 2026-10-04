import { NextResponse, type NextRequest } from 'next/server';
import { baseDelSitio } from '@/lib/sitio';
import { qrPng } from '@/lib/qr';

/**
 * GET /api/qr/<ocasion>/<slug> → PNG del QR del regalo.
 *
 * Lo usa el correo 2 (Gmail no pinta imagenes en base64). A proposito NO
 * consulta la base: solo codifica la URL publica que ya va en el correo.
 * Si consultara, responderia distinto para slugs que existen y que no, y
 * eso serviria para adivinar regalos.
 */

export const runtime = 'nodejs';

const SEGMENTO = /^[a-z0-9-]{2,40}$/;

type Params = { params: Promise<{ ocasion: string; slug: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { ocasion, slug } = await params;
  if (!SEGMENTO.test(ocasion) || !SEGMENTO.test(slug)) {
    return NextResponse.json({ error: 'ruta invalida' }, { status: 400 });
  }
  const base = await baseDelSitio();
  const png = await qrPng(`${base}/${ocasion}/${slug}`);
  return new NextResponse(new Uint8Array(png), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
