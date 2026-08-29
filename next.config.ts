import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/w/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors *; default-src 'self'; script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com; connect-src 'self' https://*.convex.cloud https://*.convex.site; img-src 'self' data: blob: https:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com;"
          },
          {
            key: "Cross-Origin-Resource-Policy",
            value: "cross-origin"
          }
        ]
      },
      {
        source: "/:path*",
        headers: [
          {
            key: "X-Frame-Options",
            value: "DENY"
          },
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'none';"
          }
        ]
      }
    ];
  }
};

export default withNextIntl(nextConfig);