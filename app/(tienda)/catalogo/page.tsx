import { redirect } from 'next/navigation';

/** El catalogo ahora vive en el inicio. Se conserva la ruta por enlaces viejos. */
export default function Catalogo() {
  redirect('/#dedicatorias');
}
