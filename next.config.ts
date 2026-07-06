import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Besuchte Seiten 30s im Router-Cache halten → Zurück-Navigation ist sofort da.
    // Nach dem Speichern räumen revalidatePath/router.refresh() den Cache ohnehin auf.
    staleTimes: {
      dynamic: 30,
      static: 180,
    },
  },
  async headers() {
    // Große, praktisch unveränderliche Dateien dauerhaft im Browser cachen
    // (Standard wäre max-age=0 → jeder Scanner-Start prüft 11 MB OpenCV neu)
    const immutable = [
      {
        key: "Cache-Control",
        value: "public, max-age=31536000, immutable",
      },
    ];
    return [
      { source: "/opencv/:path*", headers: immutable },
      { source: "/pdf.worker.min.mjs", headers: immutable },
      { source: "/icons/:path*", headers: immutable },
      { source: "/logo.png", headers: immutable },
    ];
  },
};

export default nextConfig;
