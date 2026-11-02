import { test } from "node:test";
import assert from "node:assert/strict";
import { parseRepoUrl, checkedLink, onHost } from "../lib/repo-url.ts";

test("GitHub and GitLab links become a repository reference", () => {
  assert.deepEqual(parseRepoUrl("https://github.com/owner/repo"), { provider: "github", host: "github.com", path: "owner/repo", url: "https://github.com/owner/repo" });
  assert.equal(parseRepoUrl("https://github.com/owner/repo.git")?.path, "owner/repo");
  assert.equal(parseRepoUrl("https://github.com/owner/repo/tree/main/src")?.path, "owner/repo");
  assert.equal(parseRepoUrl("https://gitlab.com/group/sub/project/-/tree/main")?.path, "group/sub/project");
  assert.equal(parseRepoUrl("https://gitlab.com/group/project")?.provider, "gitlab");
});

test("anything else is refused, so the server never fetches an arbitrary address", () => {
  for (const bad of ["http://github.com/owner/repo", "https://evil.example/owner/repo", "https://github.com/owner", "https://gitlab.example.org/a/b",
    "https://github.com.evil.example/a/b", "javascript:alert(1)", "not a url", "https://github.com/own er/repo"]) {
    assert.equal(parseRepoUrl(bad), null, bad);
  }
});

/* A stored link is editable by any project member through the database API, so
   what was checked when it was added is checked again before the server fetches. */
test("a stored link whose host or path was rewritten is refused", () => {
  const ok = { provider: "github", host: "github.com", path: "owner/repo", url: "https://github.com/owner/repo" };
  assert.deepEqual(checkedLink(ok), ok);
  for (const tampered of [
    { ...ok, host: "169.254.169.254" },
    { ...ok, host: "internal.example", url: "https://internal.example/owner/repo" },
    { ...ok, provider: "gitlab" },
    { ...ok, path: "someone/else" },
    { ...ok, url: "http://github.com/owner/repo" },
  ]) assert.equal(checkedLink(tampered), null, JSON.stringify(tampered));
});

test("a cached address is kept only when it stays on the link's own host", () => {
  const fallback = "https://github.com/owner/repo";
  assert.equal(onHost("https://github.com/owner/repo/commit/abc", "github.com", fallback), "https://github.com/owner/repo/commit/abc");
  for (const bad of ["https://evil.example/x", "http://github.com/x", "javascript:alert(1)", "https://github.com.evil.example/x", "", null, undefined, 42]) {
    assert.equal(onHost(bad, "github.com", fallback), fallback, String(bad));
  }
});
