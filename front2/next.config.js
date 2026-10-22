const path = require("node:path")

const internalApiBase = (
  process.env.GREENPEAK_INTERNAL_API_BASE_URL ||
  process.env.ANALYTICS_PROXY_BASE_URL ||
  "http://127.0.0.1:8000/api/v1"
).replace(/\/$/, "")

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Produce a self-contained production server so deployment does not need to
  // run npm ci on the memory-constrained host.
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname),
  turbopack: {
    root: path.join(__dirname),
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  async redirects() {
    return [
      {
        source: "/analytics/intermarket",
        destination: "/market-comparison",
        permanent: false,
      },
      {
        source: "/analytics/institutional",
        destination: "/market-comparison",
        permanent: false,
      },
      {
        source: "/settings",
        destination: "/profile#dashboard-settings",
        permanent: false,
      },
    ]
  },
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${internalApiBase}/:path*`,
      },
    ]
  },
}

module.exports = nextConfig
