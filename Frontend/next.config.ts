import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  allowedDevOrigins: [
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
