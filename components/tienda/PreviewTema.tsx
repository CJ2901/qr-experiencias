import type { TemaId } from '@/lib/temas';

/**
 * Miniatura viva de un tema. Reutiliza las variables de globals.css
 * via data-tema, asi el catalogo no puede desincronizarse del producto:
 * si cambias un color del tema, la tarjeta del catalogo cambia sola.
 */
export default function PreviewTema({
  tema,
  alto = 200,
}: {
  tema: TemaId;
  alto?: number;
}) {
  return (
    <div
      data-tema={tema}
      className="relative w-full overflow-hidden rounded-xl"
      style={{ height: alto, background: 'var(--bg)' }}
    >
      <div
        className="absolute inset-0"
        style={{ background: 'var(--lienzo)' }}
        aria-hidden
      />
      <div className="relative flex h-full flex-col items-center justify-center gap-2 px-5 text-center">
        <span
          style={{
            fontFamily: 'var(--disp)',
            color: 'var(--acc)',
            fontSize: 11,
            letterSpacing: '.3em',
            textTransform: 'uppercase',
          }}
        >
          Para
        </span>
        <span
          style={{
            fontFamily: 'var(--disp)',
            color: tema === 'editorial' ? 'var(--ink)' : 'var(--acc)',
            fontSize: 30,
            lineHeight: 1,
            fontStyle: tema === 'editorial' || tema === 'herbario' ? 'normal' : 'italic',
            fontWeight: tema === 'editorial' ? 700 : 400,
          }}
        >
          Cris
        </span>
        <span
          style={{
            fontFamily: 'var(--hand)',
            color: 'var(--ink)',
            fontSize: 15,
            marginTop: 6,
            opacity: 0.92,
          }}
        >
          Hay algo dentro para ti
        </span>
        <span
          className="mt-2 h-1.5 w-24 rounded-full"
          style={{ background: 'var(--acc)', opacity: 0.75 }}
          aria-hidden
        />
      </div>
    </div>
  );
}
