import type { Metadata, Viewport } from "next";
import "@fontsource-variable/noto-sans";
import "./globals.css";

export const metadata: Metadata = {
  title: "sg-health-monitor",
  description: "Emergency department waiting times published as open data in Singapore. Not for emergency decisions.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
