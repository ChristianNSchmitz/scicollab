"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import NavBar from "@/components/NavBar";
import ScholarImport from "@/components/ScholarImport";
import { toast } from "@/lib/toast";
import {
  getMockProfile, saveMockProfile,
  getPrivacySettings, updatePrivacySettings,
  type PrivacySettings,
} from "@/lib/mock-db";

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`relative inline-flex w-12 h-6 rounded-full transition-colors focus:outline-none ${value ? "bg-blue-600" : "bg-slate-200"}`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${value ? "translate-x-6" : "translate-x-0"}`}
      />
    </button>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">
      {children}
    </label>
  );
}

function Field({ children }: { children: React.ReactNode }) {
  return <div className="space-y-1">{children}</div>;
}

export default function SettingsPage() {
  const router = useRouter();

  // Profile fields
  const [fullName,       setFullName]       = useState("");
  const [institution,    setInstitution]    = useState("");
  const [role,           setRole]           = useState("");
  const [researchDomain, setResearchDomain] = useState("");
  const [bio,            setBio]            = useState("");
  const [orcidId,        setOrcidId]        = useState("");
  const [skillsRaw,      setSkillsRaw]      = useState("");   // comma-separated
  const [techniquesRaw,  setTechniquesRaw]  = useState("");   // comma-separated
  const [website,        setWebsite]        = useState("");
  const [twitter,        setTwitter]        = useState("");
  const [github,         setGithub]         = useState("");
  const [linkedin,       setLinkedin]       = useState("");

  const [privacy,  setPrivacy]  = useState<PrivacySettings | null>(null);
  const [notifs,   setNotifs]   = useState({
    new_matches: true, forks: true, qa_answers: true, follows: true, collab_invites: true,
  });
  const [resetting, setResetting] = useState(false);

  function loadProfileFields() {
    const p = getMockProfile();
    setFullName(p.full_name ?? "");
    setInstitution(p.institution ?? "");
    setRole(p.role ?? "");
    setResearchDomain(p.research_domain ?? "");
    setBio(p.bio ?? "");
    setOrcidId(p.orcid_id ?? "");
    setSkillsRaw((p.skills ?? []).join(", "));
    setTechniquesRaw((p.techniques ?? []).join(", "));
    setWebsite(p.social_links?.website ?? "");
    setTwitter(p.social_links?.twitter ?? "");
    setGithub(p.social_links?.github ?? "");
    setLinkedin(p.social_links?.linkedin ?? "");
  }

  useEffect(() => {
    loadProfileFields();
    setPrivacy(getPrivacySettings());
    const raw = localStorage.getItem("scicollab_notif_prefs");
    if (raw) { try { setNotifs(JSON.parse(raw)); } catch { /* ok */ } }
  }, []);

  function parseCSV(s: string) {
    return s.split(",").map((v) => v.trim()).filter(Boolean);
  }

  function handleSaveProfile() {
    saveMockProfile({
      full_name:       fullName,
      institution:     institution,
      role:            role,
      research_domain: researchDomain,
      bio:             bio || null,
      orcid_id:        orcidId || null,
      skills:          parseCSV(skillsRaw),
      techniques:      parseCSV(techniquesRaw),
      social_links: {
        website:  website  || undefined,
        twitter:  twitter  || undefined,
        github:   github   || undefined,
        linkedin: linkedin || undefined,
      },
    });
    toast("Profile saved");
  }

  function setPrivacyField<K extends keyof PrivacySettings>(k: K, v: PrivacySettings[K]) {
    const updated = updatePrivacySettings({ [k]: v });
    setPrivacy(updated);
  }

  function handleNotifToggle(k: keyof typeof notifs) {
    const updated = { ...notifs, [k]: !notifs[k] };
    setNotifs(updated);
    localStorage.setItem("scicollab_notif_prefs", JSON.stringify(updated));
  }

  function handleReset() {
    if (!confirm("This will clear ALL SciCollab data. Are you sure?")) return;
    setResetting(true);
    Object.keys(localStorage).filter((k) => k.startsWith("scicollab")).forEach((k) => localStorage.removeItem(k));
    router.push("/feed");
  }

  if (!privacy) return (
    <div className="min-h-screen bg-slate-50"><NavBar />
      <div className="flex items-center justify-center h-[60vh]">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <NavBar />
      <div className="max-w-2xl mx-auto px-4 py-10 space-y-6">
        <div className="mb-2">
          <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
          <p className="text-sm text-slate-500 mt-1">Manage your profile, privacy, and notification preferences.</p>
        </div>

        {/* ── Profile ──────────────────────────────────────────────── */}
        <section className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
          <h2 className="font-semibold text-slate-900 text-lg">Profile</h2>

          <div className="grid sm:grid-cols-2 gap-4">
            <Field>
              <Label>Display name *</Label>
              <input value={fullName} onChange={(e) => setFullName(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-50" />
            </Field>
            <Field>
              <Label>Institution</Label>
              <input value={institution} onChange={(e) => setInstitution(e.target.value)}
                placeholder="Johns Hopkins University"
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-50" />
            </Field>
            <Field>
              <Label>Role</Label>
              <input value={role} onChange={(e) => setRole(e.target.value)}
                placeholder="PhD Student, PI, Postdoc…"
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-50" />
            </Field>
            <Field>
              <Label>Research domain</Label>
              <input value={researchDomain} onChange={(e) => setResearchDomain(e.target.value)}
                placeholder="Cell Biology, Genomics…"
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-50" />
            </Field>
          </div>

          <Field>
            <Label>Bio</Label>
            <textarea value={bio} onChange={(e) => setBio(e.target.value)}
              rows={3} placeholder="Tell the community about your research interests and background…"
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-50 resize-none" />
          </Field>

          <Field>
            <Label>Skills <span className="normal-case font-normal text-slate-400">(comma-separated)</span></Label>
            <input value={skillsRaw} onChange={(e) => setSkillsRaw(e.target.value)}
              placeholder="Western Blot, PCR, Cell culture…"
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-50" />
          </Field>

          <Field>
            <Label>Techniques <span className="normal-case font-normal text-slate-400">(comma-separated)</span></Label>
            <input value={techniquesRaw} onChange={(e) => setTechniquesRaw(e.target.value)}
              placeholder="ELISA, Flow Cytometry, RNA-seq…"
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-50" />
          </Field>

          <Field>
            <Label>ORCID iD</Label>
            <input value={orcidId} onChange={(e) => setOrcidId(e.target.value)}
              placeholder="0000-0000-0000-0000"
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-50 font-mono" />
          </Field>

          {/* Social links */}
          <div>
            <Label>Social links</Label>
            <div className="grid sm:grid-cols-2 gap-3">
              {[
                { icon: "🌐", label: "Website", value: website,  setter: setWebsite,  placeholder: "https://yourlab.edu" },
                { icon: "🐦", label: "Twitter / X", value: twitter,  setter: setTwitter,  placeholder: "@handle" },
                { icon: "🐙", label: "GitHub",   value: github,   setter: setGithub,   placeholder: "github.com/username" },
                { icon: "💼", label: "LinkedIn", value: linkedin, setter: setLinkedin, placeholder: "linkedin.com/in/name" },
              ].map(({ icon, label, value, setter, placeholder }) => (
                <div key={label} className="flex items-center gap-2 border border-slate-200 rounded-xl px-3 py-2.5 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-50">
                  <span className="text-base flex-shrink-0">{icon}</span>
                  <input
                    value={value}
                    onChange={(e) => setter(e.target.value)}
                    placeholder={placeholder}
                    className="flex-1 text-sm outline-none bg-transparent min-w-0"
                    aria-label={label}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="pt-1">
            <button onClick={handleSaveProfile}
              className="bg-blue-600 text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-blue-700 transition-colors">
              Save profile
            </button>
          </div>
        </section>

        {/* ── Scholarly metadata import ────────────────────────────── */}
        <ScholarImport defaultQuery={fullName} onImported={loadProfileFields} />

        {/* ── Privacy ──────────────────────────────────────────────── */}
        <section className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
          <h2 className="font-semibold text-slate-900 text-lg">Privacy</h2>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-800">Profile visibility</p>
              <p className="text-xs text-slate-500">Who can see your profile</p>
            </div>
            <select value={privacy.profile_visibility}
              onChange={(e) => setPrivacyField("profile_visibility", e.target.value as PrivacySettings["profile_visibility"])}
              className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-blue-400">
              <option value="public">Public</option>
              <option value="network">Network only</option>
              <option value="private">Private</option>
            </select>
          </div>

          {([
            { key: "email_visible" as const,     label: "Show email on profile",      desc: "Visible to other logged-in users" },
            { key: "show_experiments" as const,  label: "Show my experiments",        desc: "Others can see your public experiments" },
            { key: "show_publications" as const, label: "Show my publications",       desc: "Others can see your publications" },
            { key: "indexed_by_search" as const, label: "Appear in people search",    desc: "Your profile shows up in Discover searches" },
          ] as const).map(({ key, label, desc }) => (
            <div key={key} className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-800">{label}</p>
                <p className="text-xs text-slate-500">{desc}</p>
              </div>
              <Toggle value={privacy[key] as boolean} onChange={(v) => setPrivacyField(key, v)} />
            </div>
          ))}

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-800">Allow messages from</p>
              <p className="text-xs text-slate-500">Who can send you direct messages</p>
            </div>
            <select value={privacy.allow_messages}
              onChange={(e) => setPrivacyField("allow_messages", e.target.value as PrivacySettings["allow_messages"])}
              className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-blue-400">
              <option value="all">Everyone</option>
              <option value="following">People I follow</option>
              <option value="none">No one</option>
            </select>
          </div>
        </section>

        {/* ── Notifications ─────────────────────────────────────────── */}
        <section className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
          <h2 className="font-semibold text-slate-900 text-lg">Notifications</h2>
          {([
            { key: "new_matches" as const,    label: "New experiment matches",   desc: "When a new experiment matches your expertise" },
            { key: "forks" as const,          label: "Protocol forks",           desc: "When someone forks your experiment" },
            { key: "qa_answers" as const,     label: "Q&A answers",              desc: "When your question gets an answer" },
            { key: "follows" as const,        label: "New followers",            desc: "When someone follows you" },
            { key: "collab_invites" as const, label: "Collaboration invites",    desc: "When you receive a collaboration request" },
          ] as const).map(({ key, label, desc }) => (
            <div key={key} className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-800">{label}</p>
                <p className="text-xs text-slate-500">{desc}</p>
              </div>
              <Toggle value={notifs[key]} onChange={() => handleNotifToggle(key)} />
            </div>
          ))}
        </section>

        {/* ── Danger zone ───────────────────────────────────────────── */}
        <section className="bg-white border border-red-200 rounded-2xl p-6">
          <h2 className="font-semibold text-red-700 mb-2">Danger zone</h2>
          <p className="text-sm text-slate-600 mb-4">
            Resetting will remove all your experiments, publications, messages, and profile data from this browser. This cannot be undone.
          </p>
          <button onClick={handleReset} disabled={resetting}
            className="bg-red-600 text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-red-700 transition-colors disabled:opacity-60">
            {resetting ? "Resetting…" : "Reset all data"}
          </button>
        </section>
      </div>
    </div>
  );
}
