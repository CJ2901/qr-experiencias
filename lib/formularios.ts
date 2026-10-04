import type { TemaId } from './temas';

/**
 * El formulario de la dedicatoria cambia segun DOS cosas:
 *
 *  - la PLANTILLA (tema): cada carrusel recorta las fotos con otra forma
 *    (cuadradas en Correspondencia, verticales en las demas) y algunos
 *    temas usan campos de forma especial (la fecha va en el matasellos);
 *  - la OCASION: los ejemplos y las etiquetas de un cumpleanos no sirven
 *    para una propuesta, donde la ultima frase ES la pregunta.
 *
 * Sin dependencias de servidor: lo usa el formulario en el navegador.
 * Los encuadres salen de app/globals.css (.baraja, .coverflow, .abanico,
 * .tira, .foto-final): si cambias un tamano alla, cambialo aqui.
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

const TEMAS: Record<TemaId, PorTema> = {
  correspondencia: {
    galeria: { aspecto: 1, forma: 'cuadradas' },
    ayudaFotos: 'Se ven como polaroids cuadradas en una baraja. Centra las caras al ajustar.',
    ayudaFecha: 'También sale en el matasellos del sobre: corta se ve mejor («18 jun»).',
    maxFecha: 20,
  },
  'luz-de-vela': {
    galeria: { aspecto: 190 / 236, forma: 'verticales' },
    ayudaFotos: 'Se ven como tarjetas verticales que giran. Funcionan mejor las fotos de noche o con luz cálida.',
    ayudaFecha: 'Aparece debajo de la portada.',
    maxFecha: 30,
  },
  herbario: {
    galeria: { aspecto: 152 / 182, forma: 'verticales' },
    ayudaFotos: 'Se abren en abanico como fotos impresas. Elige retratos o paisajes con aire.',
    ayudaFecha: 'Aparece debajo de la portada, junto a la ramita.',
    maxFecha: 30,
  },
  editorial: {
    galeria: { aspecto: 268 / 330, forma: 'verticales y grandes' },
    ayudaFotos: 'Van grandes y numeradas, como en una revista. Las fotos nítidas lucen más.',
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
