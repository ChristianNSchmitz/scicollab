"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setFollow } from "@/app/actions/social";
import { btn } from "@/components/ui";

/** Follow or unfollow, shown at once and confirmed by the server. */
export default function FollowButton({ personId, following, compact = false, inline = false }: { personId: string; following: boolean; compact?: boolean; inline?: boolean }) {
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
      style={inline
        // In a post's header: a light "+ Follow" next to the name.
        ? { border: 0, background: "none", padding: "2px 4px", borderRadius: 999, color: on ? "var(--mute)" : "var(--link)", font: "600 12.5px/1.2 var(--sans)", cursor: "pointer" }
        : {
            ...btn,
            ...(on ? {} : { background: "var(--ink)", color: "var(--bg)" }),
            ...(compact ? { height: 30, padding: "0 10px" } : {}),
          }}
      title={on ? "Stop following. They are not told." : "Their posts, papers and answers appear in your Following feed. Only the two of you see it."}
    >
      {on ? "Following ✓" : inline ? "+ Follow" : "Follow"}
    </button>
  );
}
