/**
 * Every server action, with who is allowed to run it on the seeded data.
 *
 *   owner:    a member who may do this (the call must change something)
 *   stranger: "deny"  -> a signed-in member with no link to the target is refused
 *             "allow" -> any signed-in member may (joining an open group, replying…)
 *             "self"  -> acts only on the caller's own account; tested separately
 *   public:   true for the few actions meant for signed-out visitors
 *
 * The stranger is Priya (u-priya): in no group, project or chat, not a moderator.
 */
import { tables, form } from "./harness.mts";

const A = (f: string) => import(`../../app/actions/${f}.ts`);
const first = (t: string, p: (r: any) => boolean) => (tables[t] as any[]).find(p);

export const STRANGER = "u-priya";

export type Case = {
  name: string; owner: string; stranger: "deny" | "allow" | "self";
  run: () => Promise<unknown>; setup?: () => void; public?: boolean; read?: boolean; note?: string;
};

const card = form({ title: "Test card", method: "m", system: "s", conditions: "c", outcome: "success", outcome_detail: "d", fails_under: "f", tags: "a, b", visibility: "public" });

export const CASES: Case[] = [
  // ── posts and replies
  { name: "posts.createPost", owner: "u-lena", stranger: "allow", run: async () => (await A("posts")).createPost({} as any, form({ title: "T", body: "B", intent: "general", room_id: "reproducibility", audience: "topic" })) },
  { name: "posts.deletePost (someone else's post)", owner: "u-rivera", stranger: "deny", run: async () => (await A("posts")).deletePost("p-1") },
  { name: "posts.editPost (someone else's post)", owner: "u-rivera", stranger: "deny", run: async () => (await A("posts")).editPost("p-1", form({ title: "Edited", body: "Edited body" })) },
  { name: "posts.replyToPost (open post)", owner: "u-lena", stranger: "allow", run: async () => (await A("posts")).replyToPost("p-1", form({ body: "A reply" })) },
  { name: "posts.replyToPost (post shared with named people only)", owner: "u-mateo", stranger: "deny", run: async () => (await A("posts")).replyToPost("fb-lena", form({ body: "A reply" })) },
  { name: "posts.deleteReply (someone else's reply)", owner: "", stranger: "deny", run: async () => { const r = first("post_replies", (x) => x.author_id === "u-okafor"); return (await A("posts")).deleteReply(r.id, r.post_id); } },
  { name: "posts.editReply (someone else's reply)", owner: "", stranger: "deny", run: async () => { const r = first("post_replies", (x) => x.author_id === "u-okafor"); return (await A("posts")).editReply(r.id, r.post_id, form({ body: "Edited" })); } },
  { name: "posts.markHelped (only the post's author)", owner: "", stranger: "deny", run: async () => { const r = first("post_replies", (x) => x.post_id === "p-2" && x.author_id !== "u-priya"); return (await A("posts")).markHelped("p-2", r.id, true); } },

  // ── post interactions
  { name: "post-interactions.repost", owner: "u-lena", stranger: "allow", run: async () => (await A("post-interactions")).repost("p-1", "worth reading") },
  { name: "post-interactions.repost (post shared with named people only)", owner: "", stranger: "deny", run: async () => (await A("post-interactions")).repost("fb-lena", "x") },
  { name: "post-interactions.setSaved", owner: "u-lena", stranger: "allow", run: async () => (await A("post-interactions")).setSaved("p-1", true) },
  { name: "post-interactions.setSaved (post shared with named people only)", owner: "u-mateo", stranger: "deny", run: async () => (await A("post-interactions")).setSaved("fb-lena", true) },
  { name: "post-interactions.sendPost", owner: "u-lena", stranger: "allow", run: async () => (await A("post-interactions")).sendPost("p-1", "u-jonas", "look") },
  { name: "post-interactions.sendPost (post shared with named people only)", owner: "", stranger: "deny", run: async () => (await A("post-interactions")).sendPost("fb-lena", "u-jonas", "look") },
  { name: "social.toggleReaction (post shared with named people only)", owner: "u-mateo", stranger: "deny", run: async () => (await A("social")).toggleReaction("post" as any, "fb-lena", "useful", "/home") },
  { name: "social.toggleReaction", owner: "u-lena", stranger: "allow", run: async () => (await A("social")).toggleReaction("post" as any, "p-1", "useful", "/home") },
  { name: "social.setFollow", owner: "u-lena", stranger: "allow", run: async () => (await A("social")).setFollow("u-jonas", true) },

  // ── calls for collaborators
  { name: "calls.expressInterest", owner: "u-lena", stranger: "allow", run: async () => (await A("calls")).expressInterest("p-4", form({ pitch: "We have the line" })) },
  { name: "calls.setShortlisted (only the call's author)", owner: "u-okafor", stranger: "deny", run: async () => (await A("calls")).setShortlisted("p-4", "u-lindqvist", true) },
  { name: "calls.setCallStatus (only the call's author)", owner: "u-okafor", stranger: "deny", run: async () => (await A("calls")).setCallStatus("p-4", form({ status: "closed" })) },
  { name: "calls.withdrawInterest", owner: "u-mateo", stranger: "self", run: async () => (await A("calls")).withdrawInterest("p-4") },

  // ── data access
  { name: "attachments.requestAccess", owner: "u-lena", stranger: "allow", run: async () => (await A("attachments")).requestAccess("pa-2", form({ message: "May I?" })) },
  { name: "attachments.decideRequest (only the data's owner)", owner: "u-rivera", stranger: "deny", run: async () => (await A("attachments")).decideRequest("ar-1", "granted") },

  // ── method cards and the record
  { name: "cards.createCard", owner: "u-lena", stranger: "allow", run: async () => (await A("cards")).createCard(card) },
  { name: "cards.forkCard (public card)", owner: "u-lena", stranger: "allow", run: async () => (await A("cards")).forkCard("c-0412") },
  { name: "cards.forkCard (someone else's private card)", owner: "u-rivera", stranger: "deny", run: async () => (await A("cards")).forkCard("c-0733") },
  { name: "cards.setVisibility (someone else's card)", owner: "u-rivera", stranger: "deny", run: async () => (await A("cards")).setVisibility("c-0412", "private") },
  { name: "cards.deleteCard (someone else's card)", owner: "u-rivera", stranger: "deny", run: async () => (await A("cards")).deleteCard("c-0412") },
  { name: "record.recordReproduction", owner: "u-lena", stranger: "allow", run: async () => (await A("record")).recordReproduction("c-0412", form({ outcome: "held", note: "same here" })) },
  { name: "record.recordReproduction (someone else's private card)", owner: "", stranger: "deny", run: async () => (await A("record")).recordReproduction("c-0733", form({ outcome: "held", note: "x" })) },
  { name: "record.writeReview", owner: "u-lena", stranger: "allow", run: async () => (await A("record")).writeReview("c-0412", form({ verdict: "clear", body: "Ran from the card." })) },
  { name: "record.writeReview (someone else's private card)", owner: "", stranger: "deny", run: async () => (await A("record")).writeReview("c-0733", form({ verdict: "clear", body: "x" })) },
  { name: "record.toggleRecommendation", owner: "u-lena", stranger: "allow", run: async () => (await A("record")).toggleRecommendation("c-0412") },
  { name: "record.toggleRecommendation (someone else's private card)", owner: "", stranger: "deny", run: async () => (await A("record")).toggleRecommendation("c-0733") },
  { name: "record.nameGuide", owner: "u-lena", stranger: "allow", run: async () => (await A("record")).nameGuide("u-jonas", form({ note: "helped me" })) },

  // ── questions and answers
  { name: "qa.askQuestion", owner: "u-lena", stranger: "allow", run: async () => (await A("qa")).askQuestion(form({ title: "How do I?", body: "Details", tags: "x" })) },
  { name: "qa.postAnswer", owner: "u-lena", stranger: "allow", run: async () => (await A("qa")).postAnswer("q-2291", form({ body: "An answer" })) },
  { name: "qa.acceptAnswer (only the question's author)", owner: "u-rivera", stranger: "deny", run: async () => (await A("qa")).acceptAnswer("q-2291", "a-2") },
  { name: "qa.editAnswer (someone else's answer)", owner: "u-okafor", stranger: "deny", run: async () => (await A("qa")).editAnswer("a-1", "q-2291", form({ body: "Edited" })) },

  // ── reports and moderation
  { name: "reports.reportContent", owner: "u-lena", stranger: "allow", run: async () => (await A("reports")).reportContent("post", "p-1", form({ reason: "spam", note: "x" })) },
  { name: "moderation.closeReport (moderators only)", owner: "u-mod", stranger: "deny", run: async () => (await A("moderation")).closeReport("rp-1", "dismissed", form({ note: "fine" })) },
  { name: "moderation.removeReported (moderators only)", owner: "u-mod", stranger: "deny", run: async () => (await A("moderation")).removeReported("rp-1", form({ note: "removed" })) },

  // ── private messages and small chats
  { name: "messages.sendMessage", owner: "u-lena", stranger: "allow", run: async () => (await A("messages")).sendMessage("u-mateo", form({ body: "Hello" })) },
  { name: "chat.sendChat", owner: "u-lena", stranger: "allow", run: async () => (await A("chat")).sendChat("u-mateo", "Hello") },
  { name: "chats.createChat", owner: "u-lena", stranger: "allow", run: async () => (await A("chats")).createChat(form({ title: "New chat", people: ["u-jonas", "u-mateo"], first: "hi" })) },
  { name: "chats.sendChatRoomMessage (members only)", owner: "u-lena", stranger: "deny", run: async () => (await A("chats")).sendChatRoomMessage("cr-1", form({ body: "hi" })) },
  { name: "chats.addToChat (members only)", owner: "u-lena", stranger: "deny", run: async () => (await A("chats")).addToChat("cr-1", form({ people: "u-jonas" })) },
  { name: "chats.renameChat (members only)", owner: "u-lena", stranger: "deny", run: async () => (await A("chats")).renameChat("cr-1", form({ title: "Renamed" })) },

  // ── groups
  { name: "groups.createGroup", owner: "u-lena", stranger: "allow", run: async () => (await A("groups")).createGroup(form({ name: "New group", description: "d", access: "open" })) },
  { name: "groups.updateGroup (group admins only)", owner: "u-rivera", stranger: "deny", run: async () => (await A("groups")).updateGroup("gr-ebro", form({ name: "Renamed", description: "d", access: "closed" })) },
  { name: "groups.joinGroup (open group)", owner: "u-lena", stranger: "allow", run: async () => (await A("groups")).joinGroup("gr-transfection") },
  { name: "groups.joinGroup (closed group)", owner: "", stranger: "deny", run: async () => (await A("groups")).joinGroup("gr-ebro") },
  { name: "groups.setRole (group admins only)", owner: "u-rivera", stranger: "deny", run: async () => (await A("groups")).setRole("gr-ebro", "u-lindqvist", form({ role: "admin" })) },
  { name: "groups.removeMember (group admins only)", owner: "u-rivera", stranger: "deny", run: async () => (await A("groups")).removeMember("gr-ebro", "u-lindqvist") },
  { name: "groups.addMember (group admins only)", owner: "u-rivera", stranger: "deny", run: async () => (await A("groups")).addMember("gr-ebro", form({ person: "u-jonas", role: "member" })) },
  { name: "groups.linkMethod (members only)", owner: "u-rivera", stranger: "deny", run: async () => (await A("groups")).linkMethod("gr-ebro", form({ card: "c-0355" })) },
  { name: "groups.unlinkMethod (members only)", owner: "u-rivera", stranger: "deny", run: async () => { const m = first("group_methods", (x) => x.group_id === "gr-ebro"); return (await A("groups")).unlinkMethod("gr-ebro", m.card_id); } },
  { name: "groups.addGroupProject (members only)", owner: "u-rivera", stranger: "deny", setup: () => { const t = tables.group_projects as any[]; t.splice(t.findIndex((r) => r.group_id === "gr-ebro" && r.project_id === "p-2"), 1); }, run: async () => (await A("groups")).addGroupProject("gr-ebro", form({ project: "p-2" })) },
  { name: "groups.removeGroupProject (members only)", owner: "u-rivera", stranger: "deny", run: async () => { const m = first("group_projects", (x) => x.group_id === "gr-ebro"); return (await A("groups")).removeGroupProject("gr-ebro", m.project_id); } },
  { name: "groups.deleteGroup (owner only)", owner: "u-rivera", stranger: "deny", run: async () => (await A("groups")).deleteGroup("gr-ebro", form({ confirm: "DELETE" })) },
  { name: "groups.requestToJoin (closed group)", owner: "u-lena", stranger: "allow", run: async () => (await A("groups")).requestToJoin("gr-ebro", form({ note: "please" })) },
  { name: "groups.answerRequest (group owners only)", owner: "u-rivera", stranger: "deny", setup: () => { (tables.group_requests as any[]).push({ group_id: "gr-ebro", user_id: "u-jonas", note: "please", created_at: "2026-11-01T09:00:00.000Z" }); }, run: async () => (await A("groups")).answerRequest("gr-ebro", "u-jonas", true) },
  { name: "groups.revokeInvite (group owners only)", owner: "u-rivera", stranger: "deny", setup: () => { (tables.group_invites as any[]).push({ id: "gi-test", group_id: "gr-ebro", token: "tok-test-123", created_by: "u-rivera", uses_left: 5, expires_at: "2027-01-01T00:00:00.000Z" }); }, run: async () => (await A("groups")).revokeInvite("gr-ebro", "tok-test-123") },
  { name: "groups.removeGroupProject (whoever added it, or an owner)", owner: "u-rivera", stranger: "deny", run: async () => (await A("groups")).removeGroupProject("gr-ebro", "p-1") },
  { name: "groups.createInvite (group admins only)", owner: "u-rivera", stranger: "deny", run: async () => (await A("groups")).createInvite("gr-ebro", form({ days: "7", uses: "5" })) },

  // ── group workspace (members only)
  { name: "group-workspace.sendGroupMessage", owner: "u-rivera", stranger: "deny", run: async () => (await A("group-workspace")).sendGroupMessage("gr-ebro", form({ body: "hi" })) },
  { name: "group-workspace.deleteGroupMessage", owner: "u-rivera", stranger: "deny", run: async () => { const m = first("group_messages", (x) => x.group_id === "gr-ebro"); return (await A("group-workspace")).deleteGroupMessage("gr-ebro", m.id); } },
  { name: "group-workspace.addNote", owner: "u-rivera", stranger: "deny", run: async () => (await A("group-workspace")).addNote("gr-ebro", form({ title: "Note", body: "text" })) },
  { name: "group-workspace.editNote", owner: "u-rivera", stranger: "deny", run: async () => { const n = first("group_notes", (x) => x.group_id === "gr-ebro"); return (await A("group-workspace")).editNote("gr-ebro", n.id, form({ title: "Edited", body: "edited" })); } },
  { name: "group-workspace.pinNote", owner: "u-rivera", stranger: "deny", run: async () => { const n = first("group_notes", (x) => x.group_id === "gr-ebro"); return (await A("group-workspace")).pinNote("gr-ebro", n.id, !n.pinned); } },
  { name: "group-workspace.deleteNote", owner: "u-rivera", stranger: "deny", run: async () => { const n = first("group_notes", (x) => x.group_id === "gr-ebro"); return (await A("group-workspace")).deleteNote("gr-ebro", n.id); } },
  { name: "group-workspace.addTask", owner: "u-rivera", stranger: "deny", run: async () => (await A("group-workspace")).addTask("gr-ebro", form({ title: "Task" })) },
  { name: "group-workspace.toggleTask", owner: "u-rivera", stranger: "deny", run: async () => { const t = first("group_tasks", (x) => x.group_id === "gr-ebro"); return (await A("group-workspace")).toggleTask("gr-ebro", t.id, !t.done_at); } },
  { name: "group-workspace.takeTask", owner: "u-lindqvist", stranger: "deny", run: async () => { const t = first("group_tasks", (x) => x.group_id === "gr-ebro" && x.assignee_id !== "u-lindqvist"); return (await A("group-workspace")).takeTask("gr-ebro", t.id); } },
  { name: "group-workspace.deleteTask", owner: "u-rivera", stranger: "deny", run: async () => { const t = first("group_tasks", (x) => x.group_id === "gr-ebro"); return (await A("group-workspace")).deleteTask("gr-ebro", t.id); } },
  { name: "group-workspace.linkDataset", owner: "u-rivera", stranger: "deny", run: async () => (await A("group-workspace")).linkDataset("gr-ebro", form({ dataset: "d-3" })) },
  { name: "group-workspace.unlinkDataset", owner: "u-rivera", stranger: "deny", run: async () => { const d = first("group_datasets", (x) => x.group_id === "gr-ebro"); return (await A("group-workspace")).unlinkDataset("gr-ebro", d.dataset_id); } },
  { name: "group-workspace.uploadGroupFile", owner: "u-rivera", stranger: "deny", run: async () => (await A("group-workspace")).uploadGroupFile("gr-ebro", form({ file: new File(["hello"], "notes.txt", { type: "text/plain" }) })) },
  { name: "group-workspace.deleteGroupFile", owner: "u-rivera", stranger: "deny", run: async () => (await A("group-workspace")).deleteGroupFile("gr-ebro", "gf-1") },

  // ── projects
  { name: "projects.createProject", owner: "u-lena", stranger: "allow", run: async () => (await A("projects")).createProject(form({ title: "P", summary: "s", visibility: "lab", tags: "x" })) },
  { name: "projects.addEntry (members only)", owner: "u-rivera", stranger: "deny", run: async () => (await A("projects")).addEntry("p-1", form({ body: "entry" })) },
  { name: "projects.depositDataset (members only)", owner: "u-rivera", stranger: "deny", run: async () => (await A("projects")).depositDataset("p-1", form({ title: "D", summary: "s", licence: "CC BY 4.0", visibility: "lab", doi: "" })) },
  { name: "projects.joinProject (lab project)", owner: "", stranger: "deny", run: async () => (await A("projects")).joinProject("p-1") },
  { name: "projects.addProjectMember (owner only)", owner: "u-rivera", stranger: "deny", run: async () => (await A("projects")).addProjectMember("p-1", form({ person: "u-jonas", role: "contributor" })) },
  { name: "projects.removeProjectMember (owner only)", owner: "u-rivera", stranger: "deny", run: async () => (await A("projects")).removeProjectMember("p-1", "u-lindqvist") },
  { name: "projects.updateProject (owner only)", owner: "u-rivera", stranger: "deny", run: async () => (await A("projects")).updateProject("p-1", form({ title: "Renamed", summary: "s", aims: "a", status: "active", visibility: "lab", tags: "x" })) },
  { name: "projects.setProjectRole (owner only)", owner: "u-rivera", stranger: "deny", run: async () => (await A("projects")).setProjectRole("p-1", "u-lindqvist", form({ role: "co-lead" })) },
  { name: "projects.linkProjectMethod (members only)", owner: "u-rivera", stranger: "deny", run: async () => (await A("projects")).linkProjectMethod("p-1", form({ card: "c-0602" })) },
  { name: "projects.unlinkProjectMethod (members only)", owner: "u-rivera", stranger: "deny", run: async () => { const m = first("project_methods", (x) => x.project_id === "p-1"); return (await A("projects")).unlinkProjectMethod("p-1", m.card_id); } },
  { name: "projects.addMilestone (members only)", owner: "u-rivera", stranger: "deny", run: async () => (await A("projects")).addMilestone("p-1", form({ title: "M", due: "2026-12-01" })) },
  { name: "projects.toggleMilestone (members only)", owner: "u-rivera", stranger: "deny", run: async () => { const m = first("project_milestones", (x) => x.project_id === "p-1"); return (await A("projects")).toggleMilestone("p-1", m.id, !m.done_at); } },
  { name: "projects.deleteMilestone (members only)", owner: "u-rivera", stranger: "deny", run: async () => { const m = first("project_milestones", (x) => x.project_id === "p-1"); return (await A("projects")).deleteMilestone("p-1", m.id); } },

  // ── rooms
  { name: "rooms.joinRoom", owner: "u-lena", stranger: "allow", run: async () => (await A("rooms")).joinRoom("western-blot") },

  // ── researcher round: events, jobs and funding, CV, papers (supabase/21)
  { name: "events.createEvent (in a group, members only)", owner: "u-rivera", stranger: "deny", run: async () => (await A("events")).createEvent("gr-ebro", form({ title: "Journal club", kind: "journal_club", starts: "2026-12-01T10:00", tz: "Europe/Berlin" })) },
  { name: "events.createEvent (open event)", owner: "u-lena", stranger: "allow", run: async () => (await A("events")).createEvent(null, form({ title: "Open meeting", kind: "conference", starts: "2026-12-01T10:00", tz: "Europe/Berlin" })) },
  { name: "events.deleteEvent (someone else's event)", owner: "u-okafor", stranger: "deny", run: async () => (await A("events")).deleteEvent("ev-3") },
  { name: "events.rsvp (group event, members only)", owner: "u-rivera", stranger: "deny", run: async () => (await A("events")).rsvp("ev-1", "maybe") },
  { name: "events.rsvp (open event)", owner: "u-lena", stranger: "allow", run: async () => (await A("events")).rsvp("ev-4", "going") },
  { name: "opportunities.postOpportunity", owner: "u-lena", stranger: "allow", run: async () => (await A("opportunities")).postOpportunity(form({ kind: "job", title: "Postdoc", deadline: "2027-01-31" })) },
  { name: "opportunities.setOpportunityStatus (only who posted it)", owner: "u-ingrid", stranger: "deny", run: async () => (await A("opportunities")).setOpportunityStatus("op-1", "closed") },
  { name: "opportunities.deleteOpportunity (only who posted it)", owner: "u-ingrid", stranger: "deny", run: async () => (await A("opportunities")).deleteOpportunity("op-1") },
  { name: "opportunities.saveOpportunity", owner: "u-lena", stranger: "allow", run: async () => (await A("opportunities")).saveOpportunity("op-1", true) },
  { name: "cv.addCvEntry", owner: "u-lena", stranger: "allow", run: async () => (await A("cv")).addCvEntry(form({ kind: "position", title: "Postdoc", start_on: "2024-01" })) },
  { name: "cv.updateCvEntry (someone else's CV)", owner: "u-rivera", stranger: "deny", run: async () => (await A("cv")).updateCvEntry("cv-1", form({ kind: "position", title: "Edited" })) },
  { name: "cv.deleteCvEntry (someone else's CV)", owner: "u-rivera", stranger: "deny", run: async () => (await A("cv")).deleteCvEntry("cv-1") },
  { name: "papers.requestFullText", owner: "u-lena", stranger: "allow", run: async () => (await A("papers")).requestFullText("W-example-0", form({ message: "please" })) },
  { name: "papers.decideFullText (authors only)", owner: "u-rivera", stranger: "deny", run: async () => (await A("papers")).decideFullText("W-example-0", "prq-1", "declined") },
  { name: "papers.uploadPaperFile (authors only)", owner: "u-rivera", stranger: "deny", run: async () => (await A("papers")).uploadPaperFile("W-example-0", form({ file: new File(["%PDF-1.4"], "paper.pdf", { type: "application/pdf" }), access: "private", version: "accepted" })) },
  { name: "papers.commentOnPaper", owner: "u-lena", stranger: "allow", run: async () => (await A("papers")).commentOnPaper("W-example-0", form({ body: "Nice" })) },
  { name: "papers.deletePaperComment (someone else's comment)", owner: "u-rivera", stranger: "deny", run: async () => (await A("papers")).deletePaperComment("W-example-0", "pcm-1") },
  { name: "papers.followPaper", owner: "u-lena", stranger: "allow", run: async () => (await A("papers")).followPaper("W-example-0", true) },
  { name: "feed.mute", owner: "u-lena", stranger: "allow", run: async () => (await A("feed")).mute("person", "u-jonas") },
  { name: "nextcloud.unlinkNextcloud (group members' folder)", owner: "u-rivera", stranger: "deny", run: async () => (await A("nextcloud")).unlinkNextcloud("group", "gr-ebro", "nc-1") },
  { name: "nextcloud.linkNextcloud (members only)", owner: "", stranger: "deny", run: async () => (await A("nextcloud")).linkNextcloud("group", "gr-ebro", form({ url: "https://cloud.example.org/s/AbC123xyz" })) },
  { name: "repos.unlinkRepo (a method card's repository)", owner: "u-rivera", stranger: "deny", run: async () => { const r = first("repo_links", (x) => x.method_id); return (await A("repos")).unlinkRepo("method", r.method_id, r.id); } },

  // ── reads that must not leak to a stranger
  { name: "post-interactions.threadOf (post shared with named people only)", owner: "u-mateo", stranger: "deny", read: true, run: async () => (await A("post-interactions")).threadOf("fb-lena") },
  { name: "attachments.pendingFor (only the owner sees requests)", owner: "u-rivera", stranger: "deny", read: true, run: async () => (await A("attachments")).pendingFor("p-2") },
];
