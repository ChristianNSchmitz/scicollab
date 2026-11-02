import { test } from "node:test";
import assert from "node:assert/strict";
import { parseShareUrl, hostAllowed, parseListing } from "../lib/nextcloud-url.ts";

test("Nextcloud share links are recognised", () => {
  assert.deepEqual(parseShareUrl("https://cloud.example.org/s/AbC123xyz"), { origin: "https://cloud.example.org", host: "cloud.example.org", token: "AbC123xyz", url: "https://cloud.example.org/s/AbC123xyz" });
  assert.equal(parseShareUrl("https://cloud.example.org/index.php/s/AbC123xyz")?.token, "AbC123xyz");
  assert.equal(parseShareUrl("https://uni.example.org/nextcloud/s/AbC123xyz/")?.origin, "https://uni.example.org/nextcloud");
  assert.equal(parseShareUrl("https://cloud.example.org/s/AbC123xyz/download")?.token, "AbC123xyz");
});

test("other links are refused", () => {
  assert.equal(parseShareUrl("http://cloud.example.org/s/AbC123xyz"), null);
  assert.equal(parseShareUrl("https://user:pw@cloud.example.org/s/AbC123xyz"), null);
  assert.equal(parseShareUrl("https://cloud.example.org/apps/files/?dir=/x"), null);
  assert.equal(parseShareUrl("not a link"), null);
});

test("the operator's host list limits servers", () => {
  assert.equal(hostAllowed("cloud.example.org", ""), true);
  assert.equal(hostAllowed("cloud.example.org", "cloud.example.org, other.org"), true);
  assert.equal(hostAllowed("evil.org", "cloud.example.org"), false);
});

test("a WebDAV listing becomes folders first, then files", () => {
  const ref = parseShareUrl("https://cloud.example.org/s/AbC123xyz")!;
  const xml = `<?xml version="1.0"?><d:multistatus xmlns:d="DAV:">
  <d:response><d:href>/public.php/webdav/</d:href><d:propstat><d:prop><d:resourcetype><d:collection/></d:resourcetype></d:prop></d:propstat></d:response>
  <d:response><d:href>/public.php/webdav/data%20sheet.xlsx</d:href><d:propstat><d:prop><d:getlastmodified>Wed, 28 Oct 2026 10:00:00 GMT</d:getlastmodified><d:getcontentlength>1024</d:getcontentlength><d:resourcetype/></d:prop></d:propstat></d:response>
  <d:response><d:href>/public.php/webdav/raw/</d:href><d:propstat><d:prop><d:resourcetype><d:collection/></d:resourcetype></d:prop></d:propstat></d:response>
  </d:multistatus>`;
  const e = parseListing(xml, ref);
  assert.deepEqual(e.map((x) => [x.name, x.folder, x.size]), [["raw", true, null], ["data sheet.xlsx", false, 1024]]);
  assert.equal(e[1].href, "https://cloud.example.org/s/AbC123xyz/download?path=%2F&files=data%20sheet.xlsx");
  assert.equal(e[1].modified, "2026-10-28T10:00:00.000Z");
});
