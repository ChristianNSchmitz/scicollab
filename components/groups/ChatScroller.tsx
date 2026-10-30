"use client";

import { useLayoutEffect, useRef, type CSSProperties, type ReactNode } from "react";

/** A scrolling message list that starts at the newest message and follows
 *  new ones, unless the reader has scrolled up to read older ones. */
export default function ChatScroller({ count, style, children }: { count: number; style: CSSProperties; children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const pinned = useRef(true);
  useLayoutEffect(() => {
    const el = box.current;
    if (el && pinned.current) el.scrollTop = el.scrollHeight;
  }, [count]);
  return (
    <div ref={box} style={style} onScroll={(e) => {
      const el = e.currentTarget;
      pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    }}>
      {children}
    </div>
  );
}
