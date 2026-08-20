import type { Metadata, Viewport } from "next";
import Script from "next/script";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "OC Lead Desk",
    template: "%s · OC Lead Desk",
  },
  description: "Work a 40k med spa lead list: search, qualify, contact and track every deal.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-full">
        <Script id="sidebar-mode" strategy="beforeInteractive">
          {`try{var s=localStorage.getItem("lead-desk.sidebar");if(s==="rail"||s==="hidden"||s==="open")document.documentElement.dataset.sidebar=s}catch(e){}`}
        </Script>
        {children}
      </body>
    </html>
  );
}
