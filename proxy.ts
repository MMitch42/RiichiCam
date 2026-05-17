import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  const visited = request.cookies.get('riichicam_visited');

  if (visited) {
    return NextResponse.redirect(new URL('/score', request.url));
  }

  const response = NextResponse.next();
  response.cookies.set('riichicam_visited', '1', {
    maxAge: 60 * 60 * 24 * 365,
    path: '/',
    sameSite: 'lax',
  });
  return response;
}

export const config = {
  matcher: ['/((?!score|api|_next|icon|manifest|robots|sitemap|favicon).*)'],
};
