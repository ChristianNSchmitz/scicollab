"use client";

import { useEffect } from "react";

/** Reads saved theme from localStorage and applies .dark to <html> before first paint. */
export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const saved = localStorage.getItem("scicollab_theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    if (saved === "dark" || (!saved && prefersDark)) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, []);

  return <>{children}</>;
}

/** Toggle between light and dark. Returns the new theme. */
export function toggleTheme(): "light" | "dark" {
  const isDark = document.documentElement.classList.toggle("dark");
  const theme  = isDark ? "dark" : "light";
  localStorage.setItem("scicollab_theme", theme);
  window.dispatchEvent(new CustomEvent("sci-theme-change", { detail: theme }));
  return theme;
}

/** Read current theme synchronously. */
export function getCurrentTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}
