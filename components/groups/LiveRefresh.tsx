"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Re-renders the page every `seconds` while the tab is visible, so a group's
 * chat picks up new messages. Near-time, like the chat dock: research
 * conversations do not need a socket. Skips a round while someone is typing.
 */
export default function LiveRefresh({ seconds = 10 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState !== "visible") return;
      const el = document.activeElement as HTMLTextAreaElement | HTMLInputElement | null;
      if (el && (el.tagName === "TEXTAREA" || el.tagName === "INPUT") && el.value) return;
      router.refresh();
    };
    const id = window.setInterval(tick, seconds * 1000);
    return () => window.clearInterval(id);
  }, [router, seconds]);
  return null;
}
