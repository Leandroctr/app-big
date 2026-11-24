import type { NextConfig } from "next";

const scriptSources = "'self' 'unsafe-inline' https://cdn.onesignal.com";
const offlineDocumentPath = "/pwa-offline";
const oneSignalAppIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "manifest-src 'self'",
  `script-src ${scriptSources}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  "media-src 'self' data: blob: https:",
  "connect-src 'self' https://onesignal.com https://*.onesignal.com wss://onesignal.com wss://*.onesignal.com https://*.supabase.co wss://*.supabase.co",
  "worker-src 'self' blob:",
  "frame-src 'self' data: blob:",
].join("; ");

export const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [{ source: offlineDocumentPath, destination: "/" }];
  },
  async headers() {
    const rules: Awaited<ReturnType<NonNullable<NextConfig["headers"]>>> = [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        source: "/onesignal/:path*",
        headers: [
          { key: "Service-Worker-Allowed", value: "/" },
          { key: "Content-Type", value: "application/javascript" },
        ],
      },
      {
        source: offlineDocumentPath,
        headers: [
          { key: "Cache-Control", value: "no-cache, max-age=0, must-revalidate" },
          { key: "CDN-Cache-Control", value: "no-store" },
        ],
      },
    ];

    const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;
    if (appId?.length === 36 && oneSignalAppIdPattern.test(appId)) {
      const jsonpSource = `https://api.onesignal.com/sync/${appId}/web`;
      rules.push(
        // Next.js manages Vary for this page. Keep shared caches from mixing its two policies.
        { source: "/", headers: [{ key: "Cache-Control", value: "private, no-store" }] },
        {
          source: "/",
          has: [
            { type: "header", key: "accept", value: "(?:[^,]*,)*\\s*text/html\\s*(?:[;,].*)?" },
          ],
          missing: [
            { type: "header", key: "rsc" },
            { type: "header", key: "next-router-prefetch" },
            { type: "header", key: "next-router-segment-prefetch" },
            { type: "query", key: "code" },
            { type: "query", key: "token_hash" },
            { type: "query", key: "type" },
            { type: "query", key: "error_code" },
            { type: "query", key: "error_description" },
          ],
          // Next.js replaces the matching global header with this complete policy.
          headers: [
            {
              key: "Content-Security-Policy",
              value: `${contentSecurityPolicy}; script-src-elem ${scriptSources} ${jsonpSource}`,
            },
          ],
        },
      );
    }

    return rules;
  },
};

export default nextConfig;
