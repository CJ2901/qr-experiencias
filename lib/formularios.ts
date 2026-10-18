import type { TemaId } from './temas';

/**
 * El formulario de la dedicatoria cambia segun DOS cosas:
 *
 *  - la PLANTILLA (tema): ayudas propias y campos que algunos temas usan
 *    de forma especial (la fecha va en el matasellos de Correspondencia);
 *  - la OCASION: los ejemplos y las etiquetas de un cumpleanos no sirven
 *    para una propuesta, donde la ultima frase ES la pregunta.
 *
 * Sin dependencias de servidor: lo usa el formulario en el navegador.
 * Los encuadres salen de app/globals.css (.polaroid .pl-ventana y
 * .foto-final): si cambias un tamano alla, cambialo aqui.
 */

export interface Encuadre {
  /** ancho / alto */
  aspecto: number;
  forma: string;
}

interface PorTema {
  galeria: Encuadre;
  ayudaFotos: string;
  ayudaFecha: string;
  maxFecha: number;
  ayudaFrases?: string;
}

interface PorOcasion {
  portada: string;
  fecha: string;
  carta: string;
  capitulo: string;
  brindis: string;
  final: string;
  /** En una propuesta la frase final es LA pregunta: va a la vista, no escondida. */
  finalDestacada?: { etiqueta: string; ayuda: string };
}

export interface ConfigFormulario extends PorTema, PorOcasion {
  fotoFinal: Encuadre;
}

/** Las cuatro plantillas muestran la galeria en una polaroid (.pl-ventana 10/9). */
const POLAROID: Encuadre = { aspecto: 10 / 9, forma: 'de polaroid' };

const TEMAS: Record<TemaId, PorTema> = {
  correspondencia: {
    galeria: POLAROID,
    ayudaFotos: 'Se ven en una polaroid que pasa sola de foto en foto. Centra las caras al ajustar.',
    ayudaFecha: 'Aparece en la portada y también en el matasellos del sobre.',
    maxFecha: 20,
  },
  'luz-de-vela': {
    galeria: POLAROID,
    ayudaFotos: 'Se ven en una polaroid que pasa sola de foto en foto. Las fotos con luz cálida lucen más aquí.',
    ayudaFecha: 'Aparece debajo de la portada.',
    maxFecha: 30,
  },
  herbario: {
    galeria: POLAROID,
    ayudaFotos: 'Se ven en una polaroid que pasa sola de foto en foto. Los retratos y paisajes con aire lucen más.',
    ayudaFecha: 'Aparece debajo de la portada, junto a la ramita.',
    maxFecha: 30,
  },
  editorial: {
    galeria: POLAROID,
    ayudaFotos: 'Se ven en una polaroid que pasa sola de foto en foto. Las fotos nítidas lucen más.',
    ayudaFecha: 'Aparece debajo de la portada.',
    maxFecha: 30,
    ayudaFrases: 'Este estilo no usa cursivas: frases cortas y directas funcionan mejor.',
  },
};

const OCASIONES: Record<string, PorOcasion> = {
  cumpleanos: {
    portada: 'Hoy es el cumpleaños de mi persona favorita',
    fecha: '18 de junio',
    carta: 'Feliz cumpleaños. Quería escribirte algo que puedas volver a leer…',
    capitulo: 'Cada año tuyo es un capítulo nuevo',
    brindis: 'Por muchos cumpleaños más juntos',
    final: 'Feliz cumpleaños, mi amor',
  },
  aniversario: {
    portada: 'Un año más eligiéndote',
    fecha: 'Desde el 14 de febrero',
    carta: 'Todavía me acuerdo del día en que…',
    capitulo: 'Lo mejor de mi historia empezó contigo',
    brindis: 'Por todos los aniversarios que nos faltan',
    final: 'Te elegiría otra vez',
  },
  cumplemes: {
    portada: 'Un mes más a tu lado',
    fecha: 'Nuestro mes 8',
    carta: 'Otro mes contigo y sigo sin creérmelo…',
    capitulo: 'Contando meses, sumando recuerdos',
    brindis: 'Por el siguiente mes, y el siguiente',
    final: 'Feliz cumple mes',
  },
  propuesta: {
    portada: 'Tengo algo importante que preguntarte',
    fecha: 'Hoy',
    carta: 'Desde que te conocí, mis días…',
    capitulo: 'Quiero seguir escribiendo esta historia contigo',
    brindis: 'Por lo que viene',
    final: '¿Quieres ser mi novia?',
    finalDestacada: {
      etiqueta: 'La pregunta',
      ayuda: 'Es lo último que va a leer, después de la carta y las fotos.',
    },
  },
  'porque-si': {
    portada: 'No necesito una fecha para decirte esto',
    fecha: 'Un martes cualquiera',
    carta: 'No es una fecha especial, pero quería decirte que…',
    capitulo: 'Los días contigo no necesitan motivo',
    brindis: 'Por los días normales a tu lado',
    final: 'Gracias por existir',
  },
};

export function configFormulario(tema: TemaId, ocasion: string): ConfigFormulario {
  return {
    ...TEMAS[tema],
    ...(OCASIONES[ocasion] ?? OCASIONES.cumpleanos),
    // .marco-final .foto-final: todo el ancho x 210 px
    fotoFinal: { aspecto: 8 / 5, forma: 'horizontal' },
  };
}
