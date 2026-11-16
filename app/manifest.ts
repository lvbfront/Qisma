import type { MetadataRoute } from "next";

// Makes the app installable (home screen, standalone window). No service worker and no
// offline caching in this version: the app needs the network for every screen.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "قِسمة",
    short_name: "قِسمة",
    description: "توزيع الدخل على البنود",
    lang: "ar",
    dir: "rtl",
    start_url: "/",
    display: "standalone",
    // The dark tokens: they match the icon, so the splash screen has no seam.
    background_color: "#0f1113",
    theme_color: "#0f1113",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      // The mark sits inside the safe zone on a full-bleed background, so the same file can be masked.
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
