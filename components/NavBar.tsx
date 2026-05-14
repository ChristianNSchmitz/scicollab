"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { getMockProfile, getNotificationsWithReadState } from "@/lib/mock-db";
import { toggleTheme, getCurrentTheme } from "@/components/ThemeProvider";

const NAV_LINKS = [
  { href: "/feed",         label: "Feed",        icon: "🏠" },
  { href: "/search",       label: "Discover",    icon: "🔍" },
  { href: "/questions",    label: "Q&A",         icon: "💬" },
  { href: "/publications", label: "Publications", icon: "📄" },
  { href: "/dashboard",    label: "My Lab",       icon: "🧪" },
];

export default function NavBar() {
  const pathname = usePathname();

  const [profile, setProfile]     = useState({ full_name: "Researcher", avatar_initials: "R", avatar_color: "bg-slate-600" });
  const [unread,  setUnread]      = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isDark,  setIsDark]      = useState(false);

  // Refresh unread count (called on mount, path change, and notif-read events)
  const refreshUnread = useCallback(() => {
    setUnread(getNotificationsWithReadState().filter((n) => !n.is_read).length);
  }, []);

  useEffect(() => {
    const p = getMockProfile();
    setProfile({
      full_name:       p.full_name,
      avatar_initials: p.avatar_initials || p.full_name?.[0]?.toUpperCase() || "R",
      avatar_color:    p.avatar_color || "bg-slate-600",
    });
    setIsDark(getCurrentTheme() === "dark");
    refreshUnread();
  }, [pathname, refreshUnread]);

  // Listen for notification-read events (dispatched from NotificationsPage)
  useEffect(() => {
    const handler = () => refreshUnread();
    window.addEventListener("sci-notif-read", handler);
    return () => window.removeEventListener("sci-notif-read", handler);
  }, [refreshUnread]);

  // Listen for theme-change events
  useEffect(() => {
    const handler = (e: Event) => setIsDark((e as CustomEvent).detail === "dark");
    window.addEventListener("sci-theme-change", handler);
    return () => window.removeEventListener("sci-theme-change", handler);
  }, []);

  function handleThemeToggle() {
    const next = toggleTheme();
    setIsDark(next === "dark");
  }

  return (
    <nav className="bg-white border-b border-slate-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-14">

          {/* Logo */}
          <Link href="/feed" className="flex items-center gap-2 flex-shrink-0">
            <span className="text-xl font-bold text-blue-600">SciCollab</span>
            <span className="hidden sm:inline text-xs text-slate-400 font-medium bg-slate-100 px-1.5 py-0.5 rounded">beta</span>
          </Link>

          {/* Desktop nav links */}
          <div className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map((link) => {
              const active = pathname === link.href || pathname.startsWith(link.href + "/");
              return (
                <Link key={link.href} href={link.href}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    active
                      ? "bg-blue-50 text-blue-600"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                  }`}>
                  <span className="text-base">{link.icon}</span>
                  {link.label}
                </Link>
              );
            })}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-1.5">
            {/* Upload CTA */}
            <Link href="/experiments/new"
              className="hidden sm:flex items-center gap-1.5 bg-blue-600 text-white text-sm font-semibold px-3.5 py-2 rounded-lg hover:bg-blue-700 transition-colors">
              <span>+</span> Upload
            </Link>

            {/* Dark mode toggle */}
            <button
              onClick={handleThemeToggle}
              title={isDark ? "Switch to light mode" : "Switch to dark mode"}
              className="p-2 rounded-lg hover:bg-slate-50 transition-colors text-lg leading-none select-none"
              aria-label="Toggle dark mode">
              {isDark ? "☀️" : "🌙"}
            </button>

            {/* Notifications */}
            <Link href="/notifications" className="relative p-2 rounded-lg hover:bg-slate-50 transition-colors">
              <span className="text-xl">🔔</span>
              {unread > 0 && (
                <span className="absolute top-1 right-1 bg-red-500 text-white text-xs font-bold rounded-full w-4 h-4 flex items-center justify-center leading-none">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </Link>

            {/* Messages */}
            <Link href="/messages" className="p-2 rounded-lg hover:bg-slate-50 transition-colors">
              <span className="text-xl">✉️</span>
            </Link>

            {/* Avatar */}
            <Link href="/profile/me"
              className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold ${profile.avatar_color} flex-shrink-0`}>
              {profile.avatar_initials}
            </Link>

            {/* Mobile menu toggle */}
            <button onClick={() => setMobileOpen((o) => !o)}
              className="md:hidden p-2 rounded-lg hover:bg-slate-50 transition-colors text-slate-600">
              {mobileOpen ? "✕" : "☰"}
            </button>
          </div>
        </div>

        {/* Mobile nav */}
        {mobileOpen && (
          <div className="md:hidden border-t border-slate-100 py-2">
            {NAV_LINKS.map((link) => {
              const active = pathname === link.href;
              return (
                <Link key={link.href} href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium ${active ? "text-blue-600 bg-blue-50" : "text-slate-700"}`}>
                  <span>{link.icon}</span> {link.label}
                </Link>
              );
            })}
            <Link href="/experiments/new" onClick={() => setMobileOpen(false)}
              className="flex items-center gap-2 px-4 py-3 text-sm font-semibold text-blue-600">
              <span>+</span> Upload Experiment
            </Link>
            <div className="px-4 py-3 border-t border-slate-100">
              <button onClick={handleThemeToggle}
                className="flex items-center gap-2 text-sm text-slate-600">
                {isDark ? "☀️ Light mode" : "🌙 Dark mode"}
              </button>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
