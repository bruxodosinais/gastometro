import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  redirects: async () => [
    { source: '/lancar', destination: '/lancamentos', permanent: true },
    {
      source: '/:path*',
      has: [{ type: 'host', value: 'gastometro-alpha.vercel.app' }],
      destination: 'https://toorganizado.com.br/:path*',
      permanent: true,
    },
  ],
};

export default nextConfig;
