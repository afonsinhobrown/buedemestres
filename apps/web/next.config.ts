import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: '/apps/cliente',
        destination: '/trabalhos',
        permanent: false,
      },
      {
        source: '/apps/cliente/',
        destination: '/trabalhos',
        permanent: false,
      },
      {
        source: '/apps/pro',
        destination: '/pro/trabalhos',
        permanent: false,
      },
      {
        source: '/apps/pro/',
        destination: '/pro/trabalhos',
        permanent: false,
      },
    ];
  },
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
