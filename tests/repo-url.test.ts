import { test } from "node:test";
import assert from "node:assert/strict";
import { parseRepoUrl } from "../lib/repo-url.ts";

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
