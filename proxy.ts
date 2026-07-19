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
  // Excludes runtime asset paths (ort/models) too, not just pages: this
  // matcher applies to every request hitting the server, not just page
  // navigations, so a returning visitor's client-side fetch of the ONNX
  // runtime or model file would otherwise get redirected to /score exactly
  // like a page navigation would — silently breaking on-device detection
  // for any visitor past their very first page view.
  matcher: ['/((?!score|api|_next|icon|manifest|robots|sitemap|favicon|tiles|privacy|sw\\.js|ort|models|debug).*)'],
};
