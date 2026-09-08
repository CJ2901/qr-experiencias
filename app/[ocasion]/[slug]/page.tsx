import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Experiencia, { type DatosPedido } from '@/components/Experiencia';
import { supabasePublico } from '@/lib/supabase';
import { firmarRuta, firmarRutas } from '@/lib/media';
import { temaDe } from '@/lib/temas';
import { cortarLineas } from '@/lib/wrap';

/**
 * La ruta publica: /[ocasion]/[slug]
 *   /cumpleanos/g7k2mqx91a
 *   /aniversario/n4p8zr2wke
 *
 * La ocasion va en la URL porque es lo que el QR impreso lleva grabado
 * para siempre. El tema visual vive en la base: si el cliente lo cambia,
 * el link y el papel siguen sirviendo.
 */

export const revalidate = 300;
// Mismo datacenter que Supabase East US: cada render hace consulta + firma de URLs.
export const preferredRegion = 'iad1';
export const dynamicParams = true;

type Params = { params: Promise<{ ocasion: string; slug: string }> };

async function traerPedido(ocasion: string, slug: string) {
  const sb = supabasePublico();
  const { data } = await sb
    .from('pedidos')
    .select('*')
    .eq('ocasion', ocasion)
    .eq('slug', slug)
    .eq('estado', 'listo')
    .maybeSingle();
  return data;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { ocasion, slug } = await params;
  const p = await traerPedido(ocasion, slug);
  if (!p) return { title: 'No encontrado' };
  const titulo = p.pareja || p.destinatario;
  return {
    title: titulo,
    description: 'Alguien dejó algo aquí para ti.',
    robots: { index: false, follow: false }, // una carta privada no va a Google
    openGraph: { title: titulo, description: 'Alguien dejó algo aquí para ti.' },
  };
}

export default async function Pagina({ params }: Params) {
  const { ocasion, slug } = await params;
  const p = await traerPedido(ocasion, slug);
  if (!p) notFound();

  const tema = temaDe(p.tema);

  // El corte de renglones se hace aqui, no en el navegador: el ancho del
  // papel es fijo y cada pluma tiene su propio calibre.
  const lineas = cortarLineas(p.mensaje, tema.maxChars);

  const rutas: string[] = Array.isArray(p.fotos) ? p.fotos : [];
  const fotos = await firmarRutas(rutas);
  const fotoFinal = await firmarRuta(p.foto_final);

  const datos: DatosPedido = {
    ocasion: p.ocasion,
    slug: p.slug,
    destinatario: p.destinatario,
    pareja: p.pareja,
    frase_principal: p.frase_principal,
    fecha_texto: p.fecha_texto,
    frase_capitulo: p.frase_capitulo,
    frase_brindis: p.frase_brindis,
    frase_final: p.frase_final,
    emojis: p.emojis,
    texto_boton: p.texto_boton,
    voz_url: p.voz_url,
    cancion_url: p.cancion_url,
  };

  return (
    <>
      {/* solo las fuentes de este tema, no las de los cuatro */}
      <link rel="stylesheet" href={tema.fuentes} />
      <Experiencia
        pedido={datos}
        tema={tema}
        lineas={lineas}
        fotos={fotos}
        fotoFinal={fotoFinal ?? null}
      />
    </>
  );
}
