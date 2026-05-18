import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['pdf-parse'],
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
