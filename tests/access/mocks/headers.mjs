// The signed-in person is whoever the test says (globalThis.__asUser).
// Cookies written by an action are kept per test, never shared.
function jar() { return (globalThis.__cookieJar ??= new Map()); }
export async function cookies() {
  return {
    get(name) {
      if (name === "sc-demo") return globalThis.__asUser ? { name, value: globalThis.__asUser } : undefined;
      const v = jar().get(name); return v === undefined ? undefined : { name, value: v };
    },
    getAll() { return [...jar()].map(([name, value]) => ({ name, value })); },
    has(name) { return name === "sc-demo" ? !!globalThis.__asUser : jar().has(name); },
    set(name, value) { if (typeof name === "object") { value = name.value; name = name.name; } jar().set(name, value); },
    delete(name) { jar().delete(name); },
  };
}
export async function headers() {
  const h = new Headers({ host: "localhost:4400", "x-forwarded-for": "127.0.0.1", origin: "http://localhost:4400" });
  return h;
}
export async function draftMode() { return { isEnabled: false }; }
