import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import ServiceWorkerRegistrar from "@/components/ServiceWorkerRegistrar";

const geist = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Ittige Factory",
  description: "Expense tracker for Ittige Brick Factory",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Ittige Factory",
  },
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/icon-192.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#EA580C",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geist.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <ServiceWorkerRegistrar />
        {children}
      </body>
    </html>
  );
}
