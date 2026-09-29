import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SciCollab",
  description:
    "A failed experiment nobody wrote down gets repeated. SciCollab keeps the data, the code, the conditions and the argument in one place — including the runs that didn't work.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&family=Inter:wght@400;500;600&display=swap"
        />
        {/* Apply the stored theme before first paint so the page never flashes. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('sc-theme');if(t)document.documentElement.dataset.theme=t}catch(e){}`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
