/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    // Always-revalidate the app-shell documents so an installed PWA loads the
    // CURRENT build on launch instead of a cached older one. These pages are
    // static HTML that reference content-hashed JS chunks, so serving a fresh
    // document is what makes the running code fresh — without this, an
    // already-installed home-screen PWA can keep booting an old cached page
    // (and old chunk refs) indefinitely after a deploy. "no-cache" still lets
    // the browser store the doc and revalidate (cheap 304s when unchanged);
    // it just forbids using it without checking with the server first.
    const revalidate = [{ key: 'Cache-Control', value: 'no-cache, must-revalidate' }];
    return [
      { source: '/', headers: revalidate },
      { source: '/score', headers: revalidate },
    ];
  },
};

export default nextConfig;
