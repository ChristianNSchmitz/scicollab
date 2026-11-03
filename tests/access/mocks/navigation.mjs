// redirect() and notFound() end a request in Next.js by throwing; so do these,
// with the target kept so a test can say where the person was sent.
export class Redirect extends Error {
  constructor(url) { super(`NEXT_REDIRECT ${url}`); this.url = url; this.digest = `NEXT_REDIRECT;replace;${url};307;`; }
}
export class NotFound extends Error {
  constructor() { super("NEXT_NOT_FOUND"); this.digest = "NEXT_HTTP_ERROR_FALLBACK;404"; }
}
export function redirect(url) { throw new Redirect(url); }
export function permanentRedirect(url) { throw new Redirect(url); }
export function notFound() { throw new NotFound(); }
export function forbidden() { throw new NotFound(); }
export function unauthorized() { throw new Redirect("/login"); }
export const RedirectType = { push: "push", replace: "replace" };
