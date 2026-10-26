import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { ServiceWorker } from "@/components/ServiceWorker";
import { WalletProvider } from "@/lib/wallet";
import "./globals.css";

export const metadata: Metadata = {
  title: "Qeep — post-quantum MUSD wallet",
  description:
    "Qeep is a MUSD wallet on Mezo. Spend daily with a normal key; large moves need a post-quantum Vault Key.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: { capable: true, title: "Qeep", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#0d1117",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Sora:wght@600;700;800&display=swap"
        />
      </head>
      <body>
        <WalletProvider>{children}</WalletProvider>
        <ServiceWorker />
      </body>
    </html>
  );
}
