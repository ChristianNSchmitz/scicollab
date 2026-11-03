"use client";

import { useEffect, useState, useTransition } from "react";
import { savePushSubscription, removePushSubscription, testPush } from "@/app/actions/push";

/**
 * Switch push messages on or off for this browser. Needs the service worker
 * (public/sw.js); on an iPhone or iPad it works once SciCollab is added to
 * the home screen (Share → Add to Home Screen), from iOS 16.4.
 */
export default function PushSetup({ publicKey }: { publicKey: string | null }) {
  const [state, setState] = useState<"loading" | "unsupported" | "ios-install" | "off" | "on" | "blocked">("loading");
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();

  useEffect(() => {
    (async () => {
      const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
      const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone;
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) { setState(ios && !standalone ? "ios-install" : "unsupported"); return; }
      if (Notification.permission === "denied") { setState("blocked"); return; }
      const reg = await navigator.serviceWorker.register("/sw.js");
      const sub = await reg.pushManager.getSubscription();
      setState(sub ? "on" : "off");
    })().catch(() => setState("unsupported"));
  }, []);

  const turnOn = () => start(async () => {
    setNote("");
    if (!publicKey) { setNote("Push messages are not set up on this server yet."); return; }
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") { setState(permission === "denied" ? "blocked" : "off"); return; }
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const key = Uint8Array.from(atob(publicKey.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
      const r = await savePushSubscription(JSON.parse(JSON.stringify(sub)));
      if ("error" in r) { setNote(r.error); await sub.unsubscribe(); return; }
      setState("on"); setNote("Switched on for this device.");
    } catch { setNote("This browser did not allow it."); }
  });
  const turnOff = () => start(async () => {
    const reg = await navigator.serviceWorker.getRegistration("/sw.js");
    const sub = await reg?.pushManager.getSubscription();
    if (sub) { await removePushSubscription(sub.endpoint); await sub.unsubscribe(); }
    setState("off"); setNote("Switched off for this device.");
  });

  const btn = { height: 34, padding: "0 14px", borderRadius: 999, border: "1px solid var(--rule)", background: "var(--surface)", color: "var(--ink)", font: "600 12.5px/1 var(--sans)", cursor: "pointer" } as const;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <b style={{ fontWeight: 600 }}>This device:</b>
        {state === "loading" && <span style={{ color: "var(--mute)" }}>checking…</span>}
        {state === "on" && <><span style={{ color: "var(--ok)" }}>push messages on</span><button type="button" style={btn} disabled={pending} onClick={turnOff}>Switch off</button>
          <button type="button" style={btn} disabled={pending} onClick={() => start(async () => { const r = await testPush(); setNote("error" in r ? r.error : "Test message sent."); })}>Send a test</button></>}
        {state === "off" && <><span style={{ color: "var(--mute)" }}>push messages off</span><button type="button" style={{ ...btn, background: "var(--ink)", color: "var(--bg)", border: 0 }} disabled={pending} onClick={turnOn}>Switch on</button></>}
        {state === "blocked" && <span style={{ color: "var(--mute)" }}>blocked in this browser's site settings. Allow notifications for this site there, then reload.</span>}
        {state === "ios-install" && <span style={{ color: "var(--mute)" }}>on an iPhone, first add SciCollab to the home screen (Share → Add to Home Screen) and open it from there.</span>}
        {state === "unsupported" && <span style={{ color: "var(--mute)" }}>this browser cannot receive push messages.</span>}
      </div>
      {note && <span role="status" style={{ color: "var(--mute)", fontSize: 12.5 }}>{note}</span>}
    </div>
  );
}
