import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Voice notes are recorded in-browser, so the mic is allowed for our own origin.
  { key: "Permissions-Policy", value: "camera=(), microphone=(self), geolocation=()" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // Next.js needs inline styles/scripts for its runtime; images may come
      // from R2 presigned URLs; connect covers Supabase + R2 uploads.
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      // Uploaded videos / voice notes stream from R2 presigned URLs (https)
      // and locally-recorded audio previews use blob:.
      "media-src 'self' blob: https:",
      "font-src 'self' data:",
      // wss for Supabase Realtime (task chat).
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.r2.cloudflarestorage.com",
      // Inline task videos: only YouTube (privacy mode) and Facebook players.
      "frame-src https://www.youtube-nocookie.com https://www.youtube.com https://www.facebook.com https://web.facebook.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  // web-push uses Node crypto/https; keep it out of the bundler so it runs
  // from node_modules at runtime (otherwise sends can silently fail).
  serverExternalPackages: ["web-push"],
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
