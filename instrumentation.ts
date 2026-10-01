/**
 * Runs once when the server starts. On a long-running server (local, or any
 * self-hosted Node process) it checks every 30 minutes for researchers whose
 * OpenAlex data is more than 12 hours old and syncs them. On Vercel, where
 * processes do not live that long, the cron in vercel.json does the same job.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.VERCEL) return;
  if (process.env.SCICOLLAB_DISABLE_SYNC_TIMER === "1") return;
  const g = globalThis as { __scicollabSyncTimer?: ReturnType<typeof setInterval> };
  if (g.__scicollabSyncTimer) return;

  const { syncDue } = await import("@/lib/openalex/sync");
  const tick = () => syncDue(50).catch((e) => console.error("[openalex] scheduled sync failed:", e));
  g.__scicollabSyncTimer = setInterval(tick, 30 * 60 * 1000);
  setTimeout(tick, 15 * 1000);   // first pass shortly after start
}
