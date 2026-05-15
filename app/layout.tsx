import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import ThemeProvider from "@/components/ThemeProvider";
import { ToastProvider } from "@/lib/toast";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SciCollab — Science Made Easy",
  description:
    "Where scientists debug their research together. A collaborative platform for live and unpublished raw science — every experiment, successful or not, becomes a building block for the next breakthrough.",
  keywords: ["science", "research", "collaboration", "peer review", "methodology", "negative results"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      {/* Inline script: apply .dark before first paint to prevent flash */}
      <head>
        <script dangerouslySetInnerHTML={{ __html: `
          (function(){
            try {
              var t = localStorage.getItem('scicollab_theme');
              var d = window.matchMedia('(prefers-color-scheme: dark)').matches;
              if (t === 'dark' || (!t && d)) document.documentElement.classList.add('dark');
            } catch(e){}
          })();
        `}} />
      </head>
      <body className="min-h-full flex flex-col bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100">
        <ThemeProvider>
          <ToastProvider>
            {children}
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
