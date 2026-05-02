import type { NextConfig } from 'next';

const config: NextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  compress: true,

  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.amazonaws.com' },
      { protocol: 'https', hostname: 'cashflowci.com' },
    ],
  },

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};

export default config;
