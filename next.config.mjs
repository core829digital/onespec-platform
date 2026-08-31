import createNextIntlPlugin from "next-intl/plugin";

// Keep this file as .mjs (not .ts): a TS config is transpiled to CommonJS,
// which makes `next-intl/plugin` resolve to its CJS build that hard-requires
// `@swc/core`. The native SWC binary is blocked by Windows application-control
// on some machines. The ESM build of the plugin pulls no native binding.
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

// The embeddable widget (/w/*) runs a strict CSP but must be framable anywhere.
// - font-src needs 'self' + data: because next/font self-hosts .woff2 under
//   /_next/static/media and inlines some as data: URIs.
// - Vercel Speed Insights injects /_vercel/... (same-origin = 'self') plus
//   https://va.vercel-scripts.com; allow both so it does not get CSP-blocked.
const WIDGET_CSP = [
  "frame-ancestors *",
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com https://va.vercel-scripts.com",
  "connect-src 'self' https://*.convex.cloud https://*.convex.site https://va.vercel-scripts.com https://vitals.vercel-insights.com",
  "img-src 'self' data: blob: https:",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  async headers() {
    return [
      {
        source: "/w/:path*",
        headers: [
          { key: "Content-Security-Policy", value: WIDGET_CSP },
          { key: "Cross-Origin-Resource-Policy", value: "cross-origin" },
        ],
      },
      {
        // Baseline hardening for every non-widget route. The widget (/w/*) is
        // excluded so its permissive CSP (declared above) is not overridden.
        source: "/((?!w/).*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none';" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
