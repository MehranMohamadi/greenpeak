const path = require("node:path")

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
}

module.exports = nextConfig
