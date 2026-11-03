import { likeTerm } from "./query.ts";

/**
 * Calls for collaborators live in the feed: a "Calls" tab beside Topic groups,
 * My groups and Following, and an "I'm interested" action on every call card.
 * This is the small part of that which is plain logic, kept apart so it can be
 * tested: reading the filters, building the tab's address, and checking the
 * address a form asks to return to.
 */

export type CallStatus = "open" | "filled" | "closed" | "all";
export type CallFilters = { status: CallStatus; term: string; due: string; mine: boolean };

/** The filters of the Calls tab, from the address: unknown values are ignored. */
export function callFilters(sp: { q?: string; status?: string; due?: string; mine?: string }): CallFilters {
  const status: CallStatus = sp.status === "filled" || sp.status === "closed" || sp.status === "all" ? sp.status : "open";
  return {
    status,
    term: likeTerm(sp.q ?? ""),
    due: /^\d{4}-\d{2}-\d{2}$/.test(sp.due ?? "") ? sp.due! : "",
    mine: sp.mine === "1",
  };
}

/** The address of the Calls tab with the filters that are set; "open" is the default and is left out. No fragment: it is also the address a form returns to. */
export function callsHref(p: { q?: string; due?: string; mine?: string; status?: string }): string {
  const params = new URLSearchParams({ feed: "calls" });
  if (p.q) params.set("q", p.q);
  if (p.due) params.set("due", p.due);
  if (p.status && p.status !== "open") params.set("status", p.status);
  if (p.mine) params.set("mine", p.mine);
  return `/home?${params}`;
}

/**
 * Where "I'm interested" returns to. It comes from a form field, so it is
 * accepted only as the feed itself with a plain query string: no other path,
 * no host, no fragment, nothing that could carry markup or a line break.
 */
export function safeBack(raw: unknown): string | null {
  const s = String(raw ?? "");
  return /^\/home(\?[A-Za-z0-9_=&.%+-]*)?$/.test(s) ? s : null;
}
