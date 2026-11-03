// Module hooks for the access tests: resolve the "@/..." alias and
// extensionless imports the way Next.js does, load JSON without import
// attributes, and stand in for the few Next.js runtime modules that only
// work inside a request (cookies, redirect, revalidation).
import { existsSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const MOCKS = {
  "next/headers": "headers.mjs",
  "next/navigation": "navigation.mjs",
  "next/cache": "cache.mjs",
  "server-only": "empty.mjs",
};
const EXT = ["", ".ts", ".tsx", ".mjs", ".js", "/index.ts", "/index.tsx"];

function find(base) {
  for (const e of EXT) {
    const p = base + e;
    if (existsSync(p) && statSync(p).isFile()) return p;
  }
  return null;
}

export async function resolve(spec, ctx, next) {
  if (MOCKS[spec]) return { url: pathToFileURL(path.join(ROOT, "tests/access/mocks", MOCKS[spec])).href, shortCircuit: true };
  if (spec === "@/lib/supabase/server" && ctx.parentURL?.includes("/app/auth/callback/"))
    return { url: pathToFileURL(path.join(ROOT, "tests/access/mocks/supabase-callback.mjs")).href, shortCircuit: true };
  if (spec.startsWith("@/")) {
    const p = find(path.join(ROOT, spec.slice(2)));
    if (p) return { url: pathToFileURL(p).href, shortCircuit: true };
  }
  if ((spec.startsWith("./") || spec.startsWith("../")) && ctx.parentURL?.startsWith("file:")) {
    const p = find(path.resolve(path.dirname(fileURLToPath(ctx.parentURL)), spec));
    if (p && !p.includes("node_modules")) return { url: pathToFileURL(p).href, shortCircuit: true };
  }
  try {
    return await next(spec, ctx);
  } catch (e) {
    // packages without an exports map ("next/server") need the file name
    if (e?.code === "ERR_MODULE_NOT_FOUND" && !spec.startsWith(".") && !spec.endsWith(".js")) return next(spec + ".js", ctx);
    throw e;
  }
}

export async function load(url, ctx, next) {
  if (url.endsWith(".json") && url.startsWith("file:") && !url.includes("node_modules")) {
    const src = readFileSync(fileURLToPath(url), "utf8");
    return { format: "module", source: `export default ${src};`, shortCircuit: true };
  }
  return next(url, ctx);
}
