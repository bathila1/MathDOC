import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Voice notes are recorded in-browser, so the mic is allowed for our own origin.
  { key: "Permissions-Policy", value: "camera=(), microphone=(self), geolocation=()" },
  // Force HTTPS for two years and cover subdomains. Only meaningful over TLS,
  // so browsers ignore it on localhost.
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  // Isolate our browsing context from anything we open / that opens us.
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // Next's runtime bootstrap is inline, so 'unsafe-inline' is required
      // without nonces (see SECURITY.md for the nonce upgrade path).
      // 'unsafe-eval' is a DEV-ONLY need: React uses eval to rebuild
      // server-side error stacks. Next does not use eval in production, so it
      // is dropped there — that closes the widest injection primitive.
      `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
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
      // No Flash/Java/embed objects, ever — cheap and closes a legacy sink.
      "object-src 'none'",
      // Service worker + manifest may only come from our own origin.
      "worker-src 'self'",
      "manifest-src 'self'",
      ...(isDev ? [] : ["upgrade-insecure-requests"]),
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
