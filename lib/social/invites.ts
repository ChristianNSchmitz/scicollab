import { isConfigured } from "@/lib/mode";
import { createClient } from "@/lib/supabase/server";
import { tables } from "@/lib/demo/store";

/**
 * Group invitations (supabase/11). Against Supabase the invite table is
 * private to the group's admins, so looking one up and redeeming it go
 * through two security-definer functions; the demo store does the same in
 * plain code.
 */
export type InvitePeek = { group_id: string; name: string; role: string; valid: boolean } | null;

const demo = () => tables as Record<string, any[]>;

export async function peekInvite(token: string): Promise<InvitePeek> {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null;
  if (isConfigured()) {
    const supabase = await createClient();
    const { data } = await supabase.rpc("peek_group_invite", { p_token: token });
    const row = Array.isArray(data) ? data[0] : data;
    return row ? { group_id: row.group_id, name: row.name, role: row.role, valid: !!row.valid } : null;
  }
  const inv = demo().group_invites.find((i) => i.token === token);
  if (!inv) return null;
  const g = demo().groups.find((x) => x.id === inv.group_id);
  return { group_id: inv.group_id, name: g?.name ?? "a group", role: inv.role, valid: new Date(inv.expires_at) >= new Date() && inv.uses < inv.max_uses };
}

/** Adds the user to the group with the invited role; the group id, or null if the invitation is not valid. */
export async function redeemInvite(token: string, userId: string): Promise<string | null> {
  if (isConfigured()) {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("redeem_group_invite", { p_token: token });
    return error ? null : (data as string);
  }
  const t = demo();
  const inv = t.group_invites.find((i) => i.token === token);
  if (!inv || new Date(inv.expires_at) < new Date() || inv.uses >= inv.max_uses) return null;
  const row = t.group_members.find((m) => m.group_id === inv.group_id && m.user_id === userId);
  if (row && row.role !== "alumni") return inv.group_id;
  if (row) Object.assign(row, { role: inv.role, joined_at: new Date().toISOString() });
  else t.group_members.push({ group_id: inv.group_id, user_id: userId, role: inv.role, joined_at: new Date().toISOString() });
  for (let i = t.group_requests.length - 1; i >= 0; i--) {
    if (t.group_requests[i].group_id === inv.group_id && t.group_requests[i].user_id === userId) t.group_requests.splice(i, 1);
  }
  inv.uses++;
  return inv.group_id;
}
