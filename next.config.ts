import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  redirects: async () => [
    { source: '/lancar', destination: '/lancamentos', permanent: true },
  ],
};

export default nextConfig;
