import { NextResponse, type NextRequest } from 'next/server';

/** Protege /admin. La cookie la pone /api/admin/login. */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith('/admin') && pathname !== '/admin/login') {
    if (req.cookies.get('sesion_admin')?.value !== 'ok') {
      const url = req.nextUrl.clone();
      url.pathname = '/admin/login';
      return NextResponse.redirect(url);
    }
  }
  return NextResponse.next();
}

export const config = { matcher: ['/admin/:path*'] };
