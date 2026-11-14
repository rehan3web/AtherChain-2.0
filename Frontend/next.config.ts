import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  agentRules: false,
  allowedDevOrigins: [
    ...(process.env.REPLIT_DEV_DOMAIN ? [process.env.REPLIT_DEV_DOMAIN] : []),
    "127.0.0.1",
    "192.168.100.102:3000",
    "https://192.168.100.102:3000",
    "http://192.168.100.102:3000",
    "https://localhost:3000",
    "http://localhost:3000",
    "localhost:3000",
    "192.168.100.102",
    "192.168.100.130",
    "http://192.168.100.130:3000",
    "192.168.100.130:3000",
    "atherchain.tech",
    "https://atherchain.tech",
  ],
  trailingSlash: true,
  experimental: {
    optimizeCss: true,
    scrollRestoration: true,
    optimizePackageImports: [
      "lucide-react",
      "@tabler/icons-react",
      "recharts",
      "framer-motion"
    ],
  },
  async redirects() {
    return [
      {
        source: '/register',
        destination: '/signup',
        permanent: true,
      },
    ]
  }
};

export default nextConfig;
