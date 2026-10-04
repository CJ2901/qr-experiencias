import Link from 'next/link';
import { MARCA } from '@/lib/marca';

export default function TiendaLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-stone-50 text-stone-800 antialiased">
      <header className="border-b border-stone-200 bg-white/80 backdrop-blur">
        <nav className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
          <Link href="/" className="text-sm font-semibold tracking-tight text-stone-900">
            {MARCA}
          </Link>
          <div className="flex items-center gap-5 text-sm">
            <Link href="/#dedicatorias" className="text-stone-600 hover:text-stone-900">
              Dedicatorias
            </Link>
            <Link href="/reenviar" className="text-stone-600 hover:text-stone-900">
              Mi enlace
            </Link>
          </div>
        </nav>
      </header>
      {children}
      <footer className="mx-auto max-w-5xl px-5 py-12 text-xs text-stone-400">
        {MARCA} · Hecho en Lima
      </footer>
    </div>
  );
}
