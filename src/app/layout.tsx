import type { Metadata, Viewport } from "next";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import { themeInitScript } from "@/components/ThemeToggle";
import "./globals.css";

export const metadata: Metadata = {
  title: "Billing",
  description: "Create bills, generate invoice PDFs and send them on WhatsApp.",
  applicationName: "Billing",
  appleWebApp: { capable: true, title: "Billing", statusBarStyle: "default" },
  formatDetection: { telephone: false },   // don't turn numbers in bills into phone links
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#ffffff",                    // updated live by ThemeToggle in dark mode
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // data-theme is set by the script below before React loads, hence suppressHydrationWarning.
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
