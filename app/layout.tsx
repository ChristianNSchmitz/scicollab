import type { Metadata } from "next";
import Script from "next/script";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

/* Self-hosted at build time: no request to Google before text can show, no
   reflow when the web font swaps in, and visitors' addresses never reach a
   third party. globals.css reads them through --font-sans / --font-mono. */
const sans = Inter({ subsets: ["latin"], weight: ["400", "500", "600"], display: "swap", variable: "--font-sans" });
const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500", "700"], display: "swap", variable: "--font-mono" });

export const metadata: Metadata = {
  title: "SciCollab",
  description:
    "The network for scientists: exchange ideas, discuss your work in groups, and share data and methods, including the runs that didn't work.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="light" data-look="glass" className={`${sans.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        {/* Apply the stored theme and look before first paint so the page never flashes.
            Glass is the default look; "classic" is the earlier square, monospace one. */}
        <Script id="sc-theme" strategy="beforeInteractive">
          {`try{var t=localStorage.getItem('sc-theme');if(t)document.documentElement.dataset.theme=t;var q=new URLSearchParams(location.search).get('look');if(q==='glass'||q==='classic')localStorage.setItem('sc-look',q);if(localStorage.getItem('sc-look')==='classic')delete document.documentElement.dataset.look}catch(e){}`}
        </Script>
      </head>
      <body>{children}</body>
    </html>
  );
}
