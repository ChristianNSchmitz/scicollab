/**
 * The loading screen that appears when changing page takes a while
 * (components/NavLoader.tsx). This is the part that is plain logic, kept apart
 * so it can be tested: which clicks count as a page change.
 *
 * Getting this wrong has one bad outcome: a link that does not change the page
 * (a file download, a data export) must not start the loader, because nothing
 * would ever tell it to stop.
 */

/** How long a page change may take before the loading screen appears. Quicker ones never show it. */
export const LOADER_DELAY_MS = 1000;

/** After it appears, how long before the page is dimmed under the spinner. Until then only the thin bar on top moves, so a page that arrives just after the delay is not covered for a split second. */
export const VEIL_DELAY_MS = 600;

/** Routes that answer with a file or data, not a page: following them leaves the page where it is. */
const NOT_PAGES = /^\/(api|auth)(\/|$)|\/(download|export)$/;

/**
 * Does following this link, or submitting this form, change the page of the
 * app? True for another page and for the same page with other parameters (a
 * tab or a filter), since there the old page just sits until the new arrives.
 * False for the page you are already on, a fragment on it, other sites,
 * mail and phone links, downloads, and anything that opens elsewhere.
 */
export function isPageNavigation(a: {
  href: string; base: string; target?: string | null; download?: boolean; modified?: boolean;
}): boolean {
  if (a.modified || a.download) return false;
  if (a.target && a.target !== "_self") return false;
  let to: URL, from: URL;
  try { to = new URL(a.href, a.base); from = new URL(a.base); } catch { return false; }
  if (to.protocol !== "https:" && to.protocol !== "http:") return false;
  if (to.origin !== from.origin) return false;
  if (NOT_PAGES.test(to.pathname)) return false;
  return to.pathname !== from.pathname || to.search !== from.search;
}

/**
 * Has the page change finished? When the address is not the one the change
 * started from: the app changes it only when the new page arrives, since there
 * is no placeholder page in between (a grey stand-in swapped in for a moment
 * and then swapped out again looked like a flicker, so it was removed).
 */
export function navigationFinished(a: { startedAt: string; now: string }): boolean {
  return a.now !== a.startedAt;
}
