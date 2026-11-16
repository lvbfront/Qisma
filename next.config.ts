import type { NextConfig } from "next";
import { PHASE_PRODUCTION_BUILD } from "next/constants";

// NEXT_PUBLIC_* values are copied into the bundle while building. If the host only provides
// them at run time, the build "succeeds" and the deployed app cannot reach Supabase at all.
// So a production build without them stops here, with a message that says what to fix.
const REQUIRED_AT_BUILD = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"];

const nextConfig: NextConfig = {
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
  // Security headers from the Next.js PWA guide.
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          // The guide uses DENY. SAMEORIGIN still blocks other sites from framing the app
          // (clickjacking) and keeps same-origin frames, which the responsive checks use.
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default function config(phase: string): NextConfig {
  if (phase === PHASE_PRODUCTION_BUILD) {
    const missing = REQUIRED_AT_BUILD.filter((name) => !process.env[name]);
    if (missing.length > 0) {
      throw new Error(
        `Missing at BUILD time: ${missing.join(", ")}. Set them in the host's environment ` +
          "variables so they are available while building (not only at run time), then rebuild. " +
          "Locally they come from .env.local (see .env.example).",
      );
    }
  }
  return nextConfig;
}
