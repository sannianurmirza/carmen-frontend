const lowMemoryBuild = process.env.LOW_MEMORY_BUILD === "1";

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  reactStrictMode: true,
  basePath: process.env.NEXT_PUBLIC_BASE_PATH !== undefined ? (process.env.NEXT_PUBLIC_BASE_PATH || undefined) : "/carmen-frontend",
  ...(lowMemoryBuild
    ? {
        experimental: {
          workerThreads: false,
          cpus: 1,
        },
      }
    : {}),
};

module.exports = nextConfig;
