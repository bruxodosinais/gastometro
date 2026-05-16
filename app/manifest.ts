import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'TôOrganizado',
    short_name: 'TôOrganizado',
    description:
      'Controle de gastos pessoais com alertas de desperdício por categoria',
    start_url: '/',
    display: 'standalone',
    background_color: '#FFFFFF',
    theme_color: '#5B5BD6',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
