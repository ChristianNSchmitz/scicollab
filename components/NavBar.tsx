"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { getNotificationsWithReadState, getMockProfile } from "@/lib/mock-db";
import { initialsOf } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { toggleTheme, getCurrentTheme } from "@/components/ThemeProvider";

const NAV_LINKS = [
  { href: "/feed",         label: "Feed",        icon: "🏠" },
  { href: "/search",       label: "Discover",    icon: "🔍" },
  { href: "/questions",    label: "Q&A",         icon: "💬" },
  { href: "/publications", label: "Publications", icon: "📄" },
  { href: "/projects",     label: "Projects",     icon: "🗂" },
  { href: "/dashboard",    label: "My Lab",       icon: "🧪" },
];

export default function NavBar() {
  const pathname = usePathname();
  const router   = useRouter();

  const [profile, setProfile]     = useState({ full_name: "Researcher", avatar_initials: "R", avatar_color: "bg-slate-600" });
  const [unread,  setUnread]      = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isDark,  setIsDark]      = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  // Refresh unread count (called on mount, path change, and notif-read events)
  const refreshUnread = useCallback(() => {
    setUnread(getNotificationsWithReadState().filter((n) => !n.is_read).length);
  }, []);

  useEffect(() => {
    // Start from the local mock-db profile so the avatar is correct instantly
    // and stays consistent with the profile page even without a Supabase session.
    const local = getMockProfile();
    setProfile({
      full_name: local.full_name,
      avatar_initials: local.avatar_initials || initialsOf(local.full_name),
      avatar_color: local.avatar_color || "bg-blue-600",
    });

    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return; // keep the local profile
      const { data: prof } = await supabase.from("profiles").select("full_name, institution").eq("id", user.id).single();
      const name = prof?.full_name
        || (user.user_metadata?.full_name as string | undefined)
        || user.email
        || local.full_name;
      setProfile({ full_name: name, avatar_initials: initialsOf(name), avatar_color: "bg-blue-600" });
    });
    setIsDark(getCurrentTheme() === "dark");
    refreshUnread();
  }, [pathname, refreshUnread]);

  // Close the user menu on Escape or outside click
  useEffect(() => {
    if (!showUserMenu) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setShowUserMenu(false); };
    const onClick = () => setShowUserMenu(false);
    window.addEventListener("keydown", onKey);
    window.addEventListener("click", onClick);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("click", onClick); };
  }, [showUserMenu]);

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

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
  }

  return (
    <nav className="bg-white border-b border-slate-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-3 sm:px-6">
        <div className="flex items-center justify-between h-14 gap-2">

          {/* Logo */}
          <Link href="/feed" className="flex items-center gap-2 flex-shrink-0">
            <span className="text-lg sm:text-xl font-bold text-blue-600">SciCollab</span>
            <span className="hidden sm:inline text-xs text-slate-400 font-medium bg-slate-100 px-1.5 py-0.5 rounded">beta</span>
          </Link>

          {/* Primary nav links — desktop only; mobile uses the hamburger menu */}
          <div className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map((link) => {
              const active = pathname === link.href || pathname.startsWith(link.href + "/");
              return (
                <Link key={link.href} href={link.href}
                  className={`flex items-center gap-1.5 px-2 lg:px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    active
                      ? "bg-blue-50 text-blue-600"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                  }`}>
                  <span className="text-base">{link.icon}</span>
                  <span className="hidden lg:inline">{link.label}</span>
                </Link>
              );
            })}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-0.5 sm:gap-1.5 flex-shrink-0">
            {/* Upload CTA — always visible */}
            <Link href="/experiments/new"
              className="flex items-center gap-1.5 bg-blue-600 text-white text-sm font-semibold px-3 sm:px-3.5 py-2 rounded-lg hover:bg-blue-700 transition-colors">
              <span className="hidden sm:inline">+ Upload</span>
              <span className="sm:hidden text-base leading-none">+</span>
            </Link>

            {/* Dark mode toggle — hidden on mobile (available in menu) */}
            <button
              onClick={handleThemeToggle}
              title={isDark ? "Switch to light mode" : "Switch to dark mode"}
              className="hidden sm:block p-2 rounded-lg hover:bg-slate-50 transition-colors text-lg leading-none select-none"
              aria-label="Toggle dark mode">
              {isDark ? "☀️" : "🌙"}
            </button>

            {/* Bookmarks — desktop only */}
            <Link href="/bookmarks" className="hidden md:block p-2 rounded-lg hover:bg-slate-50 transition-colors" title="Saved posts" aria-label="Saved posts">
              <span className="text-xl">🔖</span>
            </Link>

            {/* Notifications — always visible */}
            <Link href="/notifications" className="relative p-2 rounded-lg hover:bg-slate-50 transition-colors" aria-label="Notifications">
              <span className="text-xl">🔔</span>
              {unread > 0 && (
                <span className="absolute top-1 right-1 bg-red-500 text-white text-xs font-bold rounded-full w-4 h-4 flex items-center justify-center leading-none">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </Link>

            {/* Messages — desktop only */}
            <Link href="/messages" className="hidden md:block p-2 rounded-lg hover:bg-slate-50 transition-colors" aria-label="Messages">
              <span className="text-xl">✉️</span>
            </Link>

            {/* Settings — desktop only */}
            <Link href="/settings" className="hidden md:block p-2 rounded-lg hover:bg-slate-50 transition-colors" title="Settings" aria-label="Settings">
              <span className="text-xl">⚙️</span>
            </Link>

            {/* Avatar + User menu — desktop only (mobile uses the hamburger) */}
            <div className="relative flex-shrink-0 hidden md:block">
              <button
                onClick={(e) => { e.stopPropagation(); setShowUserMenu((v) => !v); }}
                className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold ${profile.avatar_color} hover:ring-2 hover:ring-blue-200 transition-all`}
                aria-label="User menu"
                title={profile.full_name}>
                {profile.avatar_initials}
              </button>
              {showUserMenu && (
                <div onClick={(e) => e.stopPropagation()}
                  className="absolute right-0 top-10 w-52 bg-white border border-slate-200 rounded-xl shadow-lg py-1 z-50 animate-slide-in">
                  <div className="px-4 py-2.5 border-b border-slate-100">
                    <p className="text-sm font-semibold text-slate-900 truncate">{profile.full_name}</p>
                    <p className="text-xs text-slate-400">View your profile</p>
                  </div>
                  <Link href="/profile/me" onClick={() => setShowUserMenu(false)}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50">
                    <span>👤</span> My Profile
                  </Link>
                  <Link href="/settings" onClick={() => setShowUserMenu(false)}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50">
                    <span>⚙️</span> Settings
                  </Link>
                  <div className="border-t border-slate-100 my-1" />
                  <button onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 text-left">
                    <span>🚪</span> Sign out
                  </button>
                </div>
              )}
            </div>

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
            {/* Signed-in user */}
            <Link href="/profile/me" onClick={() => setMobileOpen(false)}
              className="flex items-center gap-3 px-4 py-3 mb-1 hover:bg-slate-50">
              <span className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold ${profile.avatar_color}`}>
                {profile.avatar_initials}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900 truncate">{profile.full_name}</p>
                <p className="text-xs text-slate-400">View profile</p>
              </div>
            </Link>
            <div className="border-t border-slate-100 mb-1" />
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
            <Link href="/bookmarks" onClick={() => setMobileOpen(false)}
              className="flex items-center gap-2 px-4 py-3 text-sm font-medium text-slate-700">
              <span>🔖</span> Saved Posts
            </Link>
            <Link href="/notifications" onClick={() => setMobileOpen(false)}
              className="flex items-center gap-2 px-4 py-3 text-sm font-medium text-slate-700">
              <span>🔔</span> Notifications{unread > 0 && <span className="ml-auto bg-red-500 text-white text-xs font-bold rounded-full px-1.5 py-0.5 leading-none">{unread}</span>}
            </Link>
            <Link href="/messages" onClick={() => setMobileOpen(false)}
              className="flex items-center gap-2 px-4 py-3 text-sm font-medium text-slate-700">
              <span>✉️</span> Messages
            </Link>
            <Link href="/settings" onClick={() => setMobileOpen(false)}
              className="flex items-center gap-2 px-4 py-3 text-sm font-medium text-slate-700">
              <span>⚙️</span> Settings
            </Link>
            <div className="px-4 py-3 border-t border-slate-100 space-y-2">
              <button onClick={handleThemeToggle}
                className="flex items-center gap-2 text-sm text-slate-600">
                {isDark ? "☀️ Light mode" : "🌙 Dark mode"}
              </button>
              <button onClick={handleLogout}
                className="flex items-center gap-2 text-sm text-red-600">
                🚪 Sign out
              </button>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
