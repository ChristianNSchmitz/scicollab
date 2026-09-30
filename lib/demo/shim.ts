import { tables } from "@/lib/demo/store";

/**
 * A Supabase-shaped client backed by the in-memory demo store.
 *
 * Why a shim rather than a data layer: every page already talks PostgREST,
 * and matching that shape here means demo mode needs no changes in any page
 * or server action. The surface implemented is exactly what this codebase
 * uses — from / select / eq / neq / in / or / is / order / limit / single /
 * maybeSingle / insert / update / delete / upsert — and nothing more. If a
 * page starts using something else it will fail loudly here rather than
 * quietly returning the wrong rows.
 *
 * This is a development and review convenience. It is never used when a real
 * Supabase project is configured.
 */

type Row = Record<string, any>;
type Result<T> = { data: T; error: { message: string } | null; count?: number };

const clone = <T,>(v: T): T => (v === undefined ? v : JSON.parse(JSON.stringify(v)));
const uid = () => "d-" + Math.random().toString(36).slice(2, 10);

/** `col.op.value`, as PostgREST spells a filter inside or(). */
function matchLeaf(row: Row, leaf: string): boolean {
  const m = leaf.match(/^([a-z_]+)\.(eq|neq|ilike|like|is|in)\.(.*)$/i);
  if (!m) return false;
  const [, col, op, raw] = m;
  const v = row[col];
  switch (op) {
    case "eq":  return String(v) === raw;
    case "neq": return String(v) !== raw;
    case "is":  return raw === "null" ? v == null : String(v) === raw;
    case "in": {
      const list = raw.replace(/^\(|\)$/g, "").split(",").map((x) => x.trim());
      return list.includes(String(v));
    }
    case "like":
    case "ilike": {
      const rx = new RegExp("^" + raw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/%/g, ".*") + "$", "i");
      return rx.test(String(v ?? ""));
    }
  }
  return false;
}

/** Split on commas that are not inside and(...) / or(...) groups. */
function splitTop(expr: string): string[] {
  const out: string[] = [];
  let depth = 0, cur = "";
  for (const ch of expr) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) { out.push(cur); cur = ""; continue; }
    cur += ch;
  }
  if (cur) out.push(cur);
  return out.map((s) => s.trim()).filter(Boolean);
}

function matchOr(row: Row, expr: string): boolean {
  return splitTop(expr).some((part) => {
    const and = part.match(/^and\(([\s\S]*)\)$/i);
    if (and) return splitTop(and[1]).every((leaf) => matchLeaf(row, leaf));
    return matchLeaf(row, part);
  });
}

class Query implements PromiseLike<Result<Row[]>> {
  private rows: Row[];
  private head = false;
  private wantCount = false;
  private pending: { kind: "insert" | "update" | "upsert" | "delete"; payload?: any } | null = null;

  constructor(private table: string) {
    this.rows = tables[table] ?? [];
    if (!tables[table]) throw new Error(`demo store has no table "${table}"`);
  }

  private view: Row[] | null = null;
  private get working(): Row[] {
    return (this.view ??= [...this.rows]);
  }
  private set working(v: Row[]) { this.view = v; }

  select(_cols?: string, opts?: { count?: string; head?: boolean }) {
    if (opts?.head) this.head = true;
    if (opts?.count) this.wantCount = true;
    return this;
  }

  eq(col: string, val: unknown)  { this.working = this.working.filter((r) => String(r[col]) === String(val)); return this; }
  neq(col: string, val: unknown) { this.working = this.working.filter((r) => String(r[col]) !== String(val)); return this; }
  is(col: string, val: unknown)  { this.working = this.working.filter((r) => (val === null ? r[col] == null : r[col] === val)); return this; }
  in(col: string, vals: unknown[]) {
    const set = new Set(vals.map(String));
    this.working = this.working.filter((r) => set.has(String(r[col])));
    return this;
  }
  or(expr: string) { this.working = this.working.filter((r) => matchOr(r, expr)); return this; }

  order(col: string, opts?: { ascending?: boolean }) {
    const dir = opts?.ascending === false ? -1 : 1;
    this.working = [...this.working].sort((a, b) => {
      const x = a[col], y = b[col];
      if (x === y) return 0;
      // booleans sort false-then-true ascending, matching Postgres
      if (typeof x === "boolean" || typeof y === "boolean") return (Number(x) - Number(y)) * dir;
      return (x > y ? 1 : -1) * dir;
    });
    return this;
  }

  limit(n: number) { this.working = this.working.slice(0, n); return this; }

  insert(payload: Row | Row[]) { this.pending = { kind: "insert", payload }; return this; }
  update(payload: Row)         { this.pending = { kind: "update", payload }; return this; }
  upsert(payload: Row)         { this.pending = { kind: "upsert", payload }; return this; }
  delete(_opts?: { count?: string }) { this.pending = { kind: "delete" }; if (_opts?.count) this.wantCount = true; return this; }

  /** Apply a staged write. Filters added after insert/update/delete apply here. */
  private commit(): Row[] {
    const p = this.pending;
    if (!p) return this.working;
    this.pending = null;

    if (p.kind === "insert" || p.kind === "upsert") {
      const incoming = (Array.isArray(p.payload) ? p.payload : [p.payload]).map((r: Row) => ({
        id: r.id ?? uid(),
        created_at: r.created_at ?? new Date().toISOString(),
        ...r,
      }));
      const written: Row[] = [];
      for (const row of incoming) {
        const existing = p.kind === "upsert" ? this.rows.findIndex((r) => r.id === row.id) : -1;
        if (existing >= 0) { Object.assign(this.rows[existing], row); written.push(this.rows[existing]); }
        else { this.rows.unshift(row); written.push(row); }
      }
      return written;
    }

    if (p.kind === "update") {
      this.working.forEach((r) => Object.assign(r, p.payload));
      return this.working;
    }

    // delete
    const doomed = new Set(this.working);
    for (let i = this.rows.length - 1; i >= 0; i--) if (doomed.has(this.rows[i])) this.rows.splice(i, 1);
    return [...doomed];
  }

  private settle(): Result<Row[]> {
    const rows = this.commit();
    return {
      data: this.head ? ([] as Row[]) : clone(rows),
      error: null,
      ...(this.wantCount ? { count: rows.length } : {}),
    };
  }

  async single(): Promise<Result<Row | null>> {
    const { data, error } = this.settle();
    const row = (data as Row[])[0] ?? null;
    return row
      ? { data: row, error: null }
      : { data: null, error: { message: "No rows found" } };
  }

  async maybeSingle(): Promise<Result<Row | null>> {
    const { data } = this.settle();
    return { data: (data as Row[])[0] ?? null, error: null };
  }

  then<R1 = Result<Row[]>, R2 = never>(
    onfulfilled?: ((v: Result<Row[]>) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((r: unknown) => R2 | PromiseLike<R2>) | null
  ): PromiseLike<R1 | R2> {
    return Promise.resolve(this.settle()).then(onfulfilled, onrejected);
  }
}

export function createDemoClient(userId: string | null) {
  return {
    auth: {
      async getUser() {
        if (!userId) return { data: { user: null }, error: null };
        const me = (tables.profiles as Row[]).find((p) => p.id === userId);
        return {
          data: { user: { id: userId, email: me?.email ?? "demo@scicollab.test", user_metadata: {} } },
          error: null,
        };
      },
      async signOut() { return { error: null }; },
    },
    from(table: string) { return new Query(table); },
  };
}
