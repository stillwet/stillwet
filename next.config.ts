import type { NextConfig } from "next";

/** Vercel skew protection allows deploymentId ≤ 32 chars; git SHAs are 40. */
function readNextDeploymentId(): string | undefined {
  const raw =
    process.env.VERCEL_GIT_COMMIT_SHA?.trim() || process.env.DEPLOYMENT_VERSION?.trim();
  if (!raw) return undefined;
  return raw.length > 32 ? raw.slice(0, 32) : raw;
}

const securityHeaders: { key: string; value: string }[] = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  /**
   * Lets Next.js detect client/server version skew after deploy (avoids "Server Action not found"
   * when an old tab calls actions from a previous build). Vercel sets VERCEL_GIT_COMMIT_SHA at build.
   */
  deploymentId: readNextDeploymentId(),
  /**
   * Next 16 defaults `experimental.lockDistDir` to true: it acquires a native lock under
   * `.next/lock` before `cleanDistDir`. On Vercel that can fail with
   * `ENOENT: lstat '.next/lock'` (single isolated build per machine — locking is unnecessary).
   */
  experimental: {
    lockDistDir: false,
    /** All listing artwork uses chunked staging API; proxy limit applies to chunk route bodies. */
    proxyClientMaxBodySize: "32mb",
    /**
     * Shop profile photo upload uses a Server Action (accepts up to 15 MB before WebP compression).
     * Default Next.js limit is 1 MB, which surfaces as a generic RSC error in production.
     */
    serverActions: {
      bodySizeLimit: "16mb",
    },
  },
  /**
   * First compile of a route segment can exceed the default chunk script timeout on slow disks /
   * Windows Defender scanning `.next`; stale caches also manifest as ChunkLoadError — use
   * `npm run dev:fresh` and hard-reload the browser.
   */
  webpack: (config, { dev, isServer }) => {
    if (dev && !isServer && config.output) {
      config.output.chunkLoadTimeout = 300_000;
    }
    return config;
  },
  /** Next 16: silence “webpack config but no turbopack config” when `next build` defaults to Turbopack. */
  turbopack: {},
  serverExternalPackages: [
    "pg",
    "pgpass",
    "pg-connection-string",
    "pg-pool",
    "pg-protocol",
    "pg-types",
    "prisma",
    "@prisma/client",
    "@prisma/adapter-pg",
  ],
  async headers() {
    const headers = [...securityHeaders];
    if (process.env.VERCEL_ENV === "production") {
      headers.unshift(
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains",
        },
        {
          key: "Content-Security-Policy",
          value: "upgrade-insecure-requests",
        },
      );
    }
    return [
      { source: "/:path*", headers },
      {
        source: "/admin/:path*",
        headers: [{ key: "Cache-Control", value: "no-store, must-revalidate" }],
      },
    ];
  },
  async redirects() {
    return [
      { source: "/favicon.ico", destination: "/icon", permanent: false },
      { source: "/apple-touch-icon.png", destination: "/apple-icon", permanent: false },
      {
        source: "/apple-touch-icon-precomposed.png",
        destination: "/apple-icon",
        permanent: false,
      },
      { source: "/shop/sub", destination: "/shop/all", permanent: true },
      { source: "/shop/sub/tag/:slug", destination: "/shop/tag/:slug", permanent: true },
      { source: "/shop/domme", destination: "/shop/all", permanent: true },
      { source: "/shop/domme/tag/:slug", destination: "/shop/tag/:slug", permanent: true },
      { source: "/s/:shopSlug/sub", destination: "/s/:shopSlug/all", permanent: true },
      { source: "/s/:shopSlug/sub/tag/:slug", destination: "/s/:shopSlug/tag/:slug", permanent: true },
      { source: "/s/:shopSlug/domme", destination: "/s/:shopSlug/all", permanent: true },
      { source: "/s/:shopSlug/domme/tag/:slug", destination: "/s/:shopSlug/tag/:slug", permanent: true },
      { source: "/collection/sub", destination: "/shop/all", permanent: true },
      { source: "/collection/domme", destination: "/shop/all", permanent: true },
      { source: "/category/domme", destination: "/shop/tag/mug", permanent: true },
      { source: "/category/domme-mugs", destination: "/shop/tag/mug", permanent: true },
      { source: "/category/domme-tees", destination: "/shop/tag/t-shirt", permanent: true },
      {
        source: "/category/domme-website-services",
        destination: "/shop/all",
        permanent: true,
      },
      { source: "/category/photo-printed", destination: "/shop/all", permanent: true },
      { source: "/category/photo-printed-mugs", destination: "/shop/tag/mug", permanent: true },
      {
        source: "/category/photo-printed-canvas",
        destination: "/shop/tag/canvas-print",
        permanent: true,
      },
      { source: "/category/used", destination: "/shop/all", permanent: true },
    ];
  },
};

export default nextConfig;
