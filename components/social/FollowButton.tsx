"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setFollow } from "@/app/actions/social";
import { btn } from "@/components/ui";

/** Follow or unfollow, shown at once and confirmed by the server. */
export default function FollowButton({ personId, following, compact = false }: { personId: string; following: boolean; compact?: boolean }) {
  const [on, setOn] = useState(following);
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <button
      type="button"
      disabled={pending}
      aria-pressed={on}
      onClick={() => {
        const next = !on;
        setOn(next);
        start(async () => {
          const r = await setFollow(personId, next);
          if ("error" in r) setOn(!next);
          else router.refresh();
        });
      }}
      style={{
        ...btn,
        ...(on ? {} : { background: "var(--ink)", color: "var(--bg)" }),
        ...(compact ? { height: 30, padding: "0 10px" } : {}),
      }}
      title={on ? "Stop following. They are not told." : "Their posts, papers and answers appear in your Following feed. Only the two of you see it."}
    >
      {on ? "Following ✓" : "Follow"}
    </button>
  );
}
