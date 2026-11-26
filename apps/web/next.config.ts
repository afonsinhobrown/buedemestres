import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
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
