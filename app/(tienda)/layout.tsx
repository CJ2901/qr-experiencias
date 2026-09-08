import Link from 'next/link';
import { usuarioActual } from '@/lib/supabase-server';

export default async function TiendaLayout({ children }: { children: React.ReactNode }) {
  const usuario = await usuarioActual();

  return (
    <div className="min-h-dvh bg-stone-50 text-stone-800 antialiased">
      <header className="border-b border-stone-200 bg-white/80 backdrop-blur">
        <nav className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
          <Link href="/catalogo" className="text-sm font-semibold tracking-tight text-stone-900">
            Experiencias QR
          </Link>
          <div className="flex items-center gap-5 text-sm">
            <Link href="/catalogo" className="text-stone-600 hover:text-stone-900">
              Catálogo
            </Link>
            {usuario ? (
              <Link href="/mis-pedidos" className="text-stone-600 hover:text-stone-900">
                Mis pedidos
              </Link>
            ) : (
              <Link href="/entrar" className="text-stone-600 hover:text-stone-900">
                Entrar
              </Link>
            )}
          </div>
        </nav>
      </header>
      {children}
      <footer className="mx-auto max-w-5xl px-5 py-12 text-xs text-stone-400">
        Hecho en Lima
      </footer>
    </div>
  );
}
