import type { MetadataRoute } from "next";

// Served at /manifest.webmanifest. Used by browsers ("Install app") and by
// Bubblewrap to build the Android APK (see README → "Android app (APK)").
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: process.env.APP_NAME || "Billing",
    short_name: process.env.APP_SHORT_NAME || "Billing",
    description: "Create bills, generate invoice PDFs and send them on WhatsApp.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f6f7f9",
    theme_color: "#ffffff",
    categories: ["business", "finance", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      {
        name: "New bill",
        short_name: "New bill",
        url: "/?new=1",
        icons: [{ src: "/icons/shortcut-new.png", sizes: "192x192", type: "image/png" }],
      },
    ],
  };
}
