import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '4mb',
    },
  },
  async rewrites() {
    return [
      {
        source: '/apps/pro',
        destination: '/apps/pro/index.html',
      },
      {
        source: '/apps/cliente',
        destination: '/apps/cliente/index.html',
      },
      {
        source: '/apps/pro/:path((?!_expo|.*\\..*).*)',
        destination: '/apps/pro/index.html',
      },
      {
        source: '/apps/cliente/:path((?!_expo|.*\\..*).*)',
        destination: '/apps/cliente/index.html',
      },
    ];
  },
};

export default nextConfig;
