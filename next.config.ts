import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

// Without nonces: they're incompatible with partial prerendering (static
// shells can't carry a per-request nonce), so inline scripts stay allowed.
// Everything else is locked to this origin. See docs/deploy.md.
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "media-src 'self'",
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
];

const nextConfig: NextConfig = {
  experimental: {
    agentFeedback: true,
  },
  // Self-contained server in .next/standalone for the Docker image.
  output: "standalone",
  poweredByHeader: false,
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // The app is Spanish-only and has no language prefixes. /es, /es-PY, /en…
  // (from autocomplete or old links) would otherwise be read as a business
  // link and show "Página no encontrada": send them to the same page without
  // the prefix. These words are reserved as business links (lib/slug.ts).
  async redirects() {
    const locales = "es|es-py|es-PY|es-ar|es-AR|es-es|es-ES|en|en-us|en-US|pt|pt-br|pt-BR";
    return [
      { source: `/:locale(${locales})`, destination: "/", permanent: false },
      { source: `/:locale(${locales})/:path*`, destination: "/:path*", permanent: false },
    ];
  },
  // HSTS is added by Caddy (only meaningful over https).
  async headers() {
    const privateLink = [
      { key: "Referrer-Policy", value: "no-referrer" },
      { key: "X-Robots-Tag", value: "noindex, nofollow" },
    ];
    return [
      { source: "/:path*", headers: securityHeaders },
      // Secret links (private turno page, email unsubscribe): never indexed or leaked via Referer.
      { source: "/:slug/turno/:path*", headers: privateLink },
      { source: "/baja/:path*", headers: privateLink },
      { source: "/admin", headers: privateLink },
    ];
  },
};

export default nextConfig;
