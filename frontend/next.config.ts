import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Use Turbopack (Next.js 16 default)
  turbopack: {},
  
  // Server external packages for Node.js modules
  serverExternalPackages: ["pino", "pino-pretty"],
};

export default nextConfig;
