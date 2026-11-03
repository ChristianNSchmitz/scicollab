/**
 * P0 access tests — the routes that hand out files and data.
 * Demo store only; no database, no network. See tests/access/README.md.
 */
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { reset, as, tables } from "./harness.mts";

beforeEach(reset);
const p = <T,>(v: T) => ({ params: Promise.resolve(v) });
const req = (url = "http://localhost:4400/", init?: RequestInit) => new Request(url, init);

// ── project files (lab data in Mateo's project) ─────────────────────────────
const download = async (user: string | undefined, fileId: string) => {
  as(user);
  const { GET } = await import("../../app/(shell)/projects/[id]/files/[fileId]/download/route.ts");
  return (await GET(req(), p({ id: "pj-mateo", fileId }))).status;
};
test("project file: signed out gets 401", async () => assert.equal(await download(undefined, "pd-mateo-xf"), 401));
test("project file: the owner downloads it", async () => assert.equal(await download("u-mateo", "pd-mateo-xf"), 200));
test("project file: a project member downloads a lab file", async () => assert.equal(await download("u-ingrid", "pd-mateo-xf"), 200));
test("project file: someone the owner granted access downloads it", async () => assert.equal(await download("u-priya", "pd-mateo-xf"), 200));
test("project file: a stranger gets 404 (not 403, so its existence is not confirmed)", async () => assert.equal(await download("u-okafor", "pd-mateo-xf"), 404));
test("project file: a grant for one file does not open another", async () => assert.equal(await download("u-priya", "pd-mateo-nuclei"), 404));
test("project file: a file id from another project is not found", async () => {
  as("u-rivera"); const { GET } = await import("../../app/(shell)/projects/[id]/files/[fileId]/download/route.ts");
  assert.equal((await GET(req(), p({ id: "p-1", fileId: "pd-mateo-xf" }))).status, 404);
});

// ── files attached to a post shared with named people only ──────────────────
const postFile = async (user: string | undefined) => {
  as(user); const { GET } = await import("../../app/api/post-files/[id]/route.ts");
  return (await GET(req(), p({ id: "pf-fb-lena" }))).status;
};
test("post file: signed out gets 401", async () => assert.equal(await postFile(undefined), 401));
test("post file: the author opens it", async () => assert.equal(await postFile("u-lena"), 200));
test("post file: a person the author chose opens it", async () => assert.equal(await postFile("u-mateo"), 200));
test("post file: anyone else gets 404", async () => assert.equal(await postFile("u-priya"), 404));

// ── group files (closed group gr-ebro) ──────────────────────────────────────
const groupFile = async (user: string | undefined, id = "gf-1") => {
  as(user); const { GET } = await import("../../app/api/group-files/[id]/route.ts");
  return (await GET(req(), p({ id }))).status;
};
test("group file: signed out gets 401", async () => assert.equal(await groupFile(undefined), 401));
test("group file: a member opens it", async () => assert.equal(await groupFile("u-lindqvist"), 200));
test("group file: a non-member gets 404", async () => assert.equal(await groupFile("u-priya"), 404));
test("group file: a member of another group gets 404", async () => assert.equal(await groupFile("u-bhatt"), 404));

// ── personal exports ────────────────────────────────────────────────────────
const exports_ = ["settings/export", "you/record/export", "you/publications/export"];
for (const path of exports_) {
  test(`export ${path}: signed out gets 401`, async () => {
    as(undefined); const { GET } = await import(`../../app/(shell)/${path}/route.ts`);
    assert.equal((await GET(req(`http://localhost:4400/${path}`))).status, 401);
  });
}
test("export settings/export: holds no other member's e-mail address", async () => {
  as("u-lena"); const { GET } = await import("../../app/(shell)/settings/export/route.ts");
  const res = await GET(); assert.equal(res.status, 200);
  const text = await res.text();
  for (const other of (tables.profiles as any[]).filter((x) => x.id !== "u-lena" && x.email))
    assert.ok(!text.includes(other.email), `export leaks ${other.email}`);
});

// ── scheduled jobs ──────────────────────────────────────────────────────────
for (const job of ["digest", "openalex"]) {
  test(`cron ${job}: refused without the secret, or with a wrong one`, async () => {
    process.env.CRON_SECRET = "right-secret-for-tests";
    const { GET } = await import(`../../app/api/cron/${job}/route.ts`);
    assert.equal((await GET(req())).status, 401);
    assert.equal((await GET(req("http://localhost:4400/", { headers: { authorization: "Bearer wrong" } }))).status, 401);
    delete process.env.CRON_SECRET;
    assert.equal((await GET(req("http://localhost:4400/", { headers: { authorization: "Bearer undefined" } }))).status, 401, "no secret set must not mean open");
  });
}

// ── front-page showcase (public, signed out) ────────────────────────────────
test("showcase: only public items, and no e-mail addresses", async () => {
  const { GET } = await import("../../app/api/showcase/route.ts");
  for (let i = 0; i < 20; i++) {
    reset();
    const text = await (await GET()).text();
    assert.ok(!/[\w.-]+@[\w-]+\.\w+/.test(text), "an e-mail address reached the front page");
    for (const it of JSON.parse(text).items) {
      const table = { card: "method_cards", question: "questions", dataset: "datasets" }[it.kind as string];
      assert.ok(table, `unexpected kind ${it.kind}`);
      assert.equal((tables[table] as any[]).find((r) => r.id === it.id)?.visibility, "public", `${it.kind} ${it.id} is not public`);
    }
  }
});
test("showcase: shows nothing once nothing is public", async () => {
  for (const t of ["method_cards", "questions", "datasets"]) for (const r of tables[t] as any[]) r.visibility = "lab";
  const { GET } = await import("../../app/api/showcase/route.ts");
  assert.deepEqual((await (await GET()).json()).items, []);
});

// ── e-mail link landing: never leaves the site ──────────────────────────────
const landing = async (next: string) => {
  const { GET } = await import("../../app/auth/callback/route.ts");
  const res = await GET(req(`http://localhost:4400/auth/callback?code=ok&next=${encodeURIComponent(next)}`));
  return new URL(res.headers.get("location")!);
};
for (const evil of ["https://evil.example/x", "//evil.example/x", "/\\evil.example/x", "javascript:alert(1)"]) {
  test(`auth callback: next=${evil} stays on this site`, async () => {
    const to = await landing(evil);
    assert.equal(to.origin, "http://localhost:4400"); assert.equal(to.pathname, "/home");
  });
}
test("auth callback: an ordinary path is followed", async () => assert.equal((await landing("/settings?reset=1")).pathname, "/settings"));
test("auth callback: a bad code goes to the error page", async () => {
  const { GET } = await import("../../app/auth/callback/route.ts");
  assert.equal(new URL((await GET(req("http://localhost:4400/auth/callback?code=bad"))).headers.get("location")!).pathname, "/forgot-password");
});
