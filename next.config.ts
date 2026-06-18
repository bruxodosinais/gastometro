import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

// Alvo NATIVO (Capacitor): só quando BUILD_TARGET=native. SEM a env, o build
// web fica IDÊNTICO (mantém redirects + middleware + /api).
const isNative = process.env.BUILD_TARGET === "native";

const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  // SW desnecessário/conflitante no webview nativo → desabilita no alvo native.
  disable: process.env.NODE_ENV === "development" || isNative,
  register: false,
  reloadOnOnline: false,
});

const nextConfig: NextConfig = isNative
  ? {
      // Export estático p/ empacotar no Capacitor. redirects/middleware/API não
      // são suportados em export — ficam de fora do bundle nativo (ver script).
      output: "export",
      trailingSlash: true,
      images: { unoptimized: true },
    }
  : {
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
