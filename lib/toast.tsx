"use client";
import { useState, useEffect, useRef } from "react";

export type ToastType = "success" | "error" | "info";
export type Toast = { id: string; message: string; type: ToastType };

const EVENT = "sci-toast";

// ─── Public API ──────────────────────────────────────────────
// Uses a DOM CustomEvent so the call works across any module boundary
// or React component, with no context provider needed at the call site.

/** Show a toast — callable from anywhere, no hook or context required. */
export function toast(message: string, type: ToastType = "success") {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<{ message: string; type: ToastType }>(EVENT, {
      detail: { message, type },
    })
  );
}

/** Hook alias for components that prefer hook style. */
export function useToast() {
  return { toast };
}

// ─── Provider ────────────────────────────────────────────────
// Mount once in layout.tsx. Listens for sci-toast events and renders the stack.

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // Use a ref for remove so the event listener effect has zero deps
  // and survives React Strict Mode's intentional double-invoke cleanup.
  const removeRef = useRef<(id: string) => void>(() => {});

  removeRef.current = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    clearTimeout(timers.current[id]);
    delete timers.current[id];
  };

  useEffect(() => {
    function handle(e: Event) {
      const { message, type } = (e as CustomEvent<{ message: string; type: ToastType }>).detail;
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setToasts((prev) => [...prev.slice(-4), { id, message, type }]);
      timers.current[id] = setTimeout(() => removeRef.current(id), 4000);
    }
    window.addEventListener(EVENT, handle);
    return () => {
      window.removeEventListener(EVENT, handle);
      // Also clear all pending timers on unmount
      Object.values(timers.current).forEach(clearTimeout);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // empty deps — handler is stable via ref

  const ICON: Record<ToastType, string> = { success: "✅", error: "❌", info: "ℹ️" };
  const COLOR: Record<ToastType, string> = {
    success: "bg-emerald-600",
    error:   "bg-red-600",
    info:    "bg-blue-600",
  };

  return (
    <>
      {children}
      <div
        role="region"
        aria-live="polite"
        aria-label="Notifications"
        className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`${COLOR[t.type]} text-white text-sm font-medium px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 pointer-events-auto animate-slide-in`}
          >
            <span aria-hidden="true">{ICON[t.type]}</span>
            <span className="flex-1">{t.message}</span>
            <button
              onClick={() => removeRef.current(t.id)}
              aria-label="Dismiss"
              className="ml-2 opacity-70 hover:opacity-100 text-white leading-none"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </>
  );
}
