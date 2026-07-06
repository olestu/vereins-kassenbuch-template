import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { preconnect } from "react-dom";
import { Toaster } from "sonner";
import { SwRegister } from "@/components/sw-register";
import { DEFAULT_TERMS } from "@/lib/profile";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: DEFAULT_TERMS.appName,
  description: "Belege digital erfassen, Einnahmen und Ausgaben buchen.",
  appleWebApp: {
    capable: true,
    title: "Kassenbuch",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#2a5fc4",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Verbindung zur Datenbank schon beim Laden der Seite aufbauen —
  // spart TLS-Handshake bei der ersten Client-Abfrage (Login, Upload, …)
  preconnect(process.env.NEXT_PUBLIC_SUPABASE_URL!);

  return (
    <html
      lang="de"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster position="top-center" richColors />
        <SwRegister />
      </body>
    </html>
  );
}
