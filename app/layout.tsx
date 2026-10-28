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
    "A failed experiment nobody wrote down gets repeated. SciCollab keeps the data, the code, the conditions and the argument in one place — including the runs that didn't work.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="light" className={`${sans.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        {/* Apply the stored theme before first paint so the page never flashes. */}
        <Script id="sc-theme" strategy="beforeInteractive">
          {`try{var t=localStorage.getItem('sc-theme');if(t)document.documentElement.dataset.theme=t}catch(e){}`}
        </Script>
      </head>
      <body>{children}</body>
    </html>
  );
}
