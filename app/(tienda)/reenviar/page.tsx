import FormReenviar from '@/components/tienda/FormReenviar';

export const metadata = { title: 'Reenviar mi enlace', robots: { index: false } };

export default function Reenviar() {
  return (
    <main className="mx-auto max-w-md px-5 py-16">
      <h1 className="text-2xl font-semibold tracking-tight text-stone-900">¿Perdiste tu enlace?</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-stone-600">
        Escribe el correo con el que compraste y te reenviamos el enlace para editar
        tu dedicatoria, o el de tu regalo si ya lo publicaste.
      </p>
      <FormReenviar />
    </main>
  );
}
