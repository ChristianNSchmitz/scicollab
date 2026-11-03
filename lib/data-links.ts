/**
 * Links inside a project (supabase/22-data-links.sql): a dataset points at the
 * code files that produced it and at the notebook entries that discuss its
 * results. Both are optional. The dataset is the hub, so the chain reads both
 * ways: from the data to its code and notes, and from a code file or a notebook
 * entry back to the data it is about.
 *
 * Kept free of imports so the logic can be tested on its own.
 */

export type LinkRow = { dataset_id: string; code_file_id: string | null; entry_id: string | null };

/**
 * What saving a dataset's links changes. `offered` is what the form showed: only
 * those can be linked or unlinked, so an id from another project, or one the
 * form never listed, can neither be added nor knock out a link by omission.
 */
export function planLinks(current: Set<string>, wanted: Set<string>, offered: Set<string>): { add: string[]; remove: string[] } {
  return {
    add: [...wanted].filter((id) => offered.has(id) && !current.has(id)),
    remove: [...current].filter((id) => offered.has(id) && !wanted.has(id)),
  };
}

/** The links of one project as lookups in both directions. */
export function linkIndex(rows: LinkRow[]) {
  const codeOf = new Map<string, string[]>(), entriesOf = new Map<string, string[]>();
  const datasetsOfCode = new Map<string, string[]>(), datasetsOfEntry = new Map<string, string[]>();
  const push = (m: Map<string, string[]>, k: string, v: string) => m.set(k, [...(m.get(k) ?? []), v]);
  for (const r of rows) {
    if (r.code_file_id) { push(codeOf, r.dataset_id, r.code_file_id); push(datasetsOfCode, r.code_file_id, r.dataset_id); }
    if (r.entry_id) { push(entriesOf, r.dataset_id, r.entry_id); push(datasetsOfEntry, r.entry_id, r.dataset_id); }
  }
  return {
    codeOf: (dataset: string) => codeOf.get(dataset) ?? [],
    entriesOf: (dataset: string) => entriesOf.get(dataset) ?? [],
    datasetsOfCode: (code: string) => datasetsOfCode.get(code) ?? [],
    datasetsOfEntry: (entry: string) => datasetsOfEntry.get(entry) ?? [],
  };
}

/** A notebook entry has no title: its date and its first line stand in for one. */
export function entryLabel(body: string, createdAt: string): string {
  const first = String(body ?? "").split(/\r?\n/).map((l) => l.trim()).find(Boolean) ?? "(empty entry)";
  const text = first.length > 70 ? first.slice(0, 69) + "…" : first;
  return `${String(createdAt).slice(0, 10)} · ${text}`;
}

/**
 * May this person change a dataset's links? They must be on the project, and
 * own either the dataset or the project. Used by the action and by the page
 * that decides whether to show the editor, so the two cannot disagree; the
 * database policy (supabase/22, can_link_dataset) is the same rule again.
 */
export function canEditLinks(a: { userId: string; projectOwnerId: string; datasetOwnerId: string; onProject: boolean }): boolean {
  return a.onProject && (a.datasetOwnerId === a.userId || a.projectOwnerId === a.userId);
}
