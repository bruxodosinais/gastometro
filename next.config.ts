import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
  register: false,
  reloadOnOnline: false,
});

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

export default withSerwist(nextConfig);
