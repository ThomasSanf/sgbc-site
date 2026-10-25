import type { NextConfig } from 'next';
const nextConfig: NextConfig = {
  trailingSlash: true,
  images: { unoptimized: true },
  serverExternalPackages: ['@libsql/client', 'libsql', 'pdfkit'],
  outputFileTracingIncludes: { '/api/store/order-receipt': ['./assets/fonts/NotoSansTC-Regular.otf'] },
  async headers() {
    return [
      { source: '/:path*', headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'X-Frame-Options', value: 'DENY' },
      ] },
      { source: '/admin/:path*', headers: [
        { key: 'Cache-Control', value: 'private, no-store' },
        { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
        { key: 'Content-Security-Policy', value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'" },
      ] },
      ...['/checkout/:path*', '/api/store/order-confirmation/:path*', '/api/store/order-receipt/:path*', '/api/store/ecpg-return/:path*', '/api/store/ecpay-return/:path*'].map(source => ({ source, headers: [
        { key: 'Cache-Control', value: 'private, no-store, max-age=0' },
        { key: 'Referrer-Policy', value: 'no-referrer' },
        { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' },
      ] })),
    ];
  },
};
export default nextConfig;
