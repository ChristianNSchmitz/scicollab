"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { ShowItem } from "@/lib/showcase";

/**
 * The front page's rolling "most active right now": up to five public items
 * (method cards, question threads, shared datasets), one at a time, with
 * arrows. Read-only — it shows summaries and links to the item, nothing more.
 *
 * It refreshes once a minute while it is on screen and the tab is visible.
 * When a new item reaches the top it is shown, unless the visitor is using
 * the arrows at that moment; then a short notice offers it instead.
 *
 * `mountId`: render into an element of the design artboard (the board is
 * static HTML, so the carousel is portalled into its slot). Without it, the
 * carousel renders where it is placed.
 */

const REFRESH_MS = 60_000;
const QUIET_MS = 30_000;          // after a click, do not move the visitor's view for this long

const mono = (size: number, weight = 400, lh = 1) => `${weight} ${size}px/${lh} var(--mono)`;

export default function LiveShowcase({ initial, mountId }: { initial: ShowItem[]; mountId?: string }) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => {
    if (!mountId) return;
    const el = document.getElementById(mountId);
    if (!el) return;
    el.replaceChildren();          // drop the pre-rendered placeholder
    setHost(el);
  }, [mountId]);

  const view = <Carousel initial={initial} />;
  if (!mountId) return view;
  return host ? createPortal(view, host) : null;
}

function Carousel({ initial }: { initial: ShowItem[] }) {
  const [items, setItems] = useState<ShowItem[]>(initial);
  const [at, setAt] = useState(0);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const [notice, setNotice] = useState<ShowItem | null>(null);
  const [announce, setAnnounce] = useState("");
  const root = useRef<HTMLElement>(null);
  const touched = useRef(0);
  const known = useRef(new Set(initial.map((i) => i.id)));
  const current = items[Math.min(at, items.length - 1)];

  const go = useCallback((delta: number) => {
    if (items.length < 2) return;
    touched.current = Date.now();
    setNotice(null);
    setAt((i) => (i + delta + items.length) % items.length);
  }, [items.length]);

  // The latest values for the refresh timer, which outlives renders.
  const state = useRef({ items, at });
  state.current = { items, at };

  // Refresh: once a minute, only while on screen and the tab is visible.
  useEffect(() => {
    let stop = false;
    const tick = async () => {
      const el = root.current;
      if (document.visibilityState !== "visible" || !el || el.getClientRects().length === 0) return;
      try {
        const res = await fetch("/api/showcase", { cache: "no-store" });
        if (!res.ok) return;
        const body = (await res.json()) as { items?: ShowItem[] };
        if (stop || !Array.isArray(body.items)) return;
        const next = body.items.slice(0, 5);
        const { items: prev, at: shownAt } = state.current;

        const arrived = next.filter((i) => !known.current.has(i.id));
        arrived.forEach((i) => known.current.add(i.id));
        if (arrived.length) setFresh((s) => new Set([...s, ...arrived.map((i) => i.id)]));

        const showing = prev[Math.min(shownAt, prev.length - 1)];
        const newTop = next[0] && prev[0]?.id !== next[0].id ? next[0] : null;
        const quiet = Date.now() - touched.current > QUIET_MS;
        setItems(next);
        if (newTop && quiet) {
          setAt(0); setNotice(null);
          setAnnounce(`New at number 1: ${newTop.title}`);
        } else {
          const keep = showing ? next.findIndex((i) => i.id === showing.id) : -1;
          setAt(keep >= 0 ? keep : 0);
          if (newTop) setNotice(newTop);
        }
      } catch {
        /* offline or asleep: keep what is shown */
      }
    };
    const id = window.setInterval(tick, REFRESH_MS);
    const onShow = () => { if (document.visibilityState === "visible") tick(); };
    document.addEventListener("visibilitychange", onShow);
    return () => { stop = true; window.clearInterval(id); document.removeEventListener("visibilitychange", onShow); };
  }, []);

  if (!items.length || !current) {
    return (
      <section ref={root} aria-label="Most active on SciCollab" style={frame}>
        <Head pos="" />
        <div style={{ padding: 28, font: "400 14px/1.6 var(--sans)", color: "var(--mute)" }}>
          Nothing has been shared publicly yet. The first public method cards, questions and datasets will appear here.
        </div>
      </section>
    );
  }

  const n = items.length;
  return (
    <section
      ref={root}
      aria-roledescription="carousel"
      aria-label="Most active on SciCollab this month"
      style={frame}
      onKeyDown={(e) => { if (e.key === "ArrowRight") go(1); if (e.key === "ArrowLeft") go(-1); }}
    >
      <Head pos={`${Math.min(at, n - 1) + 1} / ${n}`}>
        <Arrow label="Previous" disabled={n < 2} onClick={() => go(-1)}>‹</Arrow>
        <Arrow label="Next" disabled={n < 2} onClick={() => go(1)}>›</Arrow>
      </Head>

      {notice && (
        <button
          type="button"
          onClick={() => { setAt(0); setNotice(null); touched.current = Date.now(); }}
          style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 12px", border: 0, borderBottom: "1px solid var(--rule)", background: "var(--flag)", color: "#0D0D0D", font: mono(11, 500, 1.4), cursor: "pointer" }}
        >
          ↑ New at #1: {notice.title} — show it
        </button>
      )}

      <div role="group" aria-roledescription="slide" aria-label={`${Math.min(at, n - 1) + 1} of ${n}`} style={{ minHeight: 400 }}>
        <Slide item={current} isNew={fresh.has(current.id)} />
      </div>

      <div style={{ display: "flex", gap: 6, justifyContent: "center", padding: "0 0 10px", background: "var(--surface)" }} aria-hidden="true">
        {items.map((it, i) => (
          <span key={it.id} style={{ width: 18, height: 3, background: i === at ? "var(--ink)" : "var(--rule)" }} />
        ))}
      </div>
      <div style={{ padding: "11px 12px", borderTop: "1px solid var(--rule)", background: "var(--bg)", font: mono(11, 400, 1.4), color: "var(--mute)" }}>
        {FOOT[current.kind]}
        <div style={{ marginTop: 5, fontSize: 10 }}>Live · public items only · ranked by activity in the last 30 days · refreshes every minute</div>
      </div>
      <div aria-live="polite" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>{announce}</div>
    </section>
  );
}

const frame: React.CSSProperties = { position: "relative", border: "1px solid var(--ink)", background: "var(--surface)", textAlign: "left" };

const FOOT: Record<ShowItem["kind"], React.ReactNode> = {
  card: <>This is a <span style={{ color: "var(--ink)" }}>Method Card</span> — structured, versioned, forkable, and it records the conditions under which the method fails.</>,
  question: <>This is a <span style={{ color: "var(--ink)" }}>question thread</span> — asked with its context, answered by peers, the useful answer marked.</>,
  dataset: <>This is a <span style={{ color: "var(--ink)" }}>shared dataset</span> — deposited with its licence and provenance, open to every member.</>,
};

function Head({ pos, children }: { pos: string; children?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px 8px 12px", borderBottom: "1px solid var(--ink)", background: "var(--ink)", color: "var(--bg)" }}>
      <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--signal)", flexShrink: 0 }} />
      <span style={{ font: mono(10, 700), letterSpacing: ".12em", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>LIVE · MOST ACTIVE THIS MONTH</span>
      <span style={{ marginLeft: "auto", font: mono(11, 500), whiteSpace: "nowrap", flexShrink: 0 }}>{pos}</span>
      {children}
    </div>
  );
}

function Arrow({ label, disabled, onClick, children }: { label: string; disabled: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button" aria-label={label} disabled={disabled} onClick={onClick}
      style={{ width: 28, height: 24, flexShrink: 0, border: "1px solid var(--bg)", background: "transparent", color: "var(--bg)", font: mono(15, 700), cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.35 : 1, padding: 0 }}
    >
      {children}
    </button>
  );
}

const OUTCOME = {
  success: { label: "SUCCESS", color: "var(--ok)" },
  partial: { label: "PARTIAL", color: "var(--flag-ink)" },
  negative: { label: "NEGATIVE RESULT", color: "#B33600" },
} as const;

function Badge({ text, color }: { text: string; color: string }) {
  return <span style={{ display: "inline-flex", padding: "3px 6px", border: `1px solid ${color}`, color, font: mono(10, 500), whiteSpace: "nowrap" }}>{text}</span>;
}

function Grid({ fields }: { fields: { label: string; value: string }[] }) {
  if (!fields.length) return null;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 1, background: "var(--rule)", border: "1px solid var(--rule)", marginBottom: 16 }}>
      {fields.map((f) => (
        <div key={f.label} style={{ background: "var(--surface)", padding: "9px 11px", minWidth: 0 }}>
          <div style={{ font: mono(9), color: "var(--mute)", marginBottom: 5 }}>{f.label}</div>
          <div style={{ font: mono(12, 400, 1.3), overflowWrap: "anywhere" }}>{f.value}</div>
        </div>
      ))}
    </div>
  );
}

function Slide({ item, isNew }: { item: ShowItem; isNew: boolean }) {
  const top = (badge: React.ReactNode, meta: string) => (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderBottom: "1px solid var(--rule)", background: "var(--bg)", flexWrap: "wrap" }}>
      {badge}
      {isNew && <Badge text="NEW IN TOP 5" color="var(--ink)" />}
      <span style={{ font: mono(10), color: "var(--mute)" }}>{meta}</span>
      <span style={{ marginLeft: "auto", font: mono(10), color: "var(--mute)" }}>{item.stats}</span>
    </div>
  );
  const title = (
    <a href={item.href} style={{ display: "block", font: mono(17, 500, 1.3), marginBottom: 6, color: "var(--ink)", textDecoration: "none" }}>
      {item.title}
    </a>
  );
  const byline = <div style={{ font: mono(11, 400, 1.4), color: "var(--mute)", marginBottom: 16 }}>{item.byline}</div>;

  if (item.kind === "card") {
    const o = item.outcome ? OUTCOME[item.outcome] : null;
    return (
      <>
        {top(o ? <Badge text={o.label} color={o.color} /> : <Badge text="ONGOING" color="var(--mute)" />, `${item.code} · v${item.version}`)}
        <div style={{ padding: 16 }}>
          {title}{byline}
          <Grid fields={item.fields} />
          {item.failsUnder && (
            <>
              <div style={{ font: mono(9), color: "var(--mute)", marginBottom: 7 }}>FAILS UNDER</div>
              <div style={{ borderLeft: "3px solid var(--signal)", padding: "9px 11px", background: "var(--bg)", font: "400 13px/1.5 var(--sans)" }}>{item.failsUnder}</div>
            </>
          )}
        </div>
      </>
    );
  }

  if (item.kind === "question") {
    return (
      <>
        {top(<Badge text="QUESTION THREAD" color="var(--ink)" />, `${item.answers} answer${item.answers === 1 ? "" : "s"}${item.accepted ? " · answered" : ""}`)}
        <div style={{ padding: 16 }}>
          {title}{byline}
          <p style={{ margin: "0 0 14px", font: "400 14px/1.6 var(--sans)" }}>{item.excerpt}</p>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {item.tags.map((t) => <span key={t} style={{ font: mono(10.5), border: "1px solid var(--rule)", padding: "3px 6px", color: "var(--mute)" }}>{t}</span>)}
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {top(<Badge text="SHARED DATASET" color="var(--ok)" />, "")}
      <div style={{ padding: 16 }}>
        {title}{byline}
        <Grid fields={item.fields} />
        {item.summary && <p style={{ margin: 0, font: "400 14px/1.6 var(--sans)" }}>{item.summary}</p>}
      </div>
    </>
  );
}
