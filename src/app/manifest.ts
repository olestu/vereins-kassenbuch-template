import type { MetadataRoute } from "next";
import { DEFAULT_TERMS } from "@/lib/profile";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: DEFAULT_TERMS.appName,
    short_name: "Kassenbuch",
    description: "Belege digital erfassen, Einnahmen und Ausgaben buchen.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#f4f6fa",
    theme_color: "#2a5fc4",
    lang: "de",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
