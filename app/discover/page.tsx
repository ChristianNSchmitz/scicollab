"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import NavBar from "@/components/NavBar";
import { getAllProfiles, isFollowing, toggleFollow, getMockProfile, getCurrentUserId, type Profile } from "@/lib/mock-db";

const DOMAINS = ["All", "Biochemistry", "Cell Biology", "Genomics", "Proteomics", "Organoid Biology", "Genome Editing"] as const;
type Domain = typeof DOMAINS[number];

export default function DiscoverPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [search, setSearch]     = useState("");
  const [domain, setDomain]     = useState<Domain>("All");
  const [follows, setFollows]   = useState<Record<string, boolean>>({});

  useEffect(() => {
    const all = getAllProfiles().filter((p) => p.id !== getCurrentUserId());
    setProfiles(all);
    const f: Record<string, boolean> = {};
    all.forEach((p) => { f[p.id] = isFollowing(p.id); });
    setFollows(f);
  }, []);

  function handleFollow(id: string) {
    const now = toggleFollow(id);
    setFollows((prev) => ({ ...prev, [id]: now }));
  }

  const visible = profiles.filter((p) => {
    const matchDomain = domain === "All" || p.research_domain === domain;
    const matchSearch = !search || p.full_name.toLowerCase().includes(search.toLowerCase()) || p.institution.toLowerCase().includes(search.toLowerCase()) || p.techniques.some((t) => t.toLowerCase().includes(search.toLowerCase()));
    return matchDomain && matchSearch;
  });

  const me = getMockProfile();

  return (
    <div className="min-h-screen bg-slate-50">
      <NavBar />
      <div className="max-w-5xl mx-auto px-4 py-10">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900">Discover Researchers</h1>
          <p className="text-sm text-slate-500 mt-1">Find collaborators matched to your techniques, domain, and interests.</p>
        </div>

        {/* Your profile suggestion area */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl p-5 mb-8 text-white flex items-center justify-between">
          <div>
            <p className="font-semibold text-lg">Welcome, {me.full_name || "Researcher"} 👋</p>
            <p className="text-blue-100 text-sm mt-0.5">
              {me.research_domain ? `Showing researchers in ${me.research_domain} and related fields.` : "Complete your profile to get personalised matches."}
            </p>
          </div>
          <Link href="/profile/me" className="flex-shrink-0 bg-white text-blue-700 text-sm font-semibold px-4 py-2 rounded-xl hover:bg-blue-50 transition-colors">
            My Profile →
          </Link>
        </div>

        {/* Search + domain filter */}
        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          <div className="relative flex-1">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, institution, or technique…"
              className="w-full border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-50 bg-white shadow-sm" />
          </div>
        </div>

        {/* Domain filters */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
          {DOMAINS.map((d) => (
            <button key={d} onClick={() => setDomain(d)}
              className={`flex-shrink-0 text-sm px-4 py-2 rounded-full font-medium transition-colors ${domain === d ? "bg-blue-600 text-white" : "bg-white text-slate-600 border border-slate-200 hover:border-slate-300"}`}>
              {d}
            </button>
          ))}
        </div>

        <p className="text-sm text-slate-500 mb-4">{visible.length} researcher{visible.length !== 1 ? "s" : ""} found</p>

        {/* Grid */}
        {visible.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
            <p className="text-3xl mb-2">🔭</p>
            <p className="font-semibold text-slate-800">No researchers found</p>
            <p className="text-sm text-slate-500 mt-1">Try a different search or domain filter.</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {visible.map((p) => {
              const followed = follows[p.id] ?? false;
              return (
                <div key={p.id} className="bg-white border border-slate-200 rounded-2xl p-5 hover:border-blue-200 hover:shadow-sm transition-all">
                  {/* Avatar + Name */}
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg flex-shrink-0 ${p.avatar_color || "bg-slate-600"}`}>
                      {p.avatar_initials || p.full_name[0]}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="font-semibold text-slate-900 text-sm truncate">{p.full_name}</p>
                        {p.is_verified && <span className="text-blue-600 text-xs flex-shrink-0">✓</span>}
                      </div>
                      <p className="text-xs text-slate-500 truncate">{p.role} · {p.institution}</p>
                    </div>
                  </div>

                  {/* Domain + bio */}
                  <p className="text-xs font-medium text-blue-700 bg-blue-50 rounded-full px-2.5 py-0.5 inline-block mb-2 border border-blue-100">
                    {p.research_domain}
                  </p>
                  {p.bio && <p className="text-xs text-slate-600 line-clamp-2 mb-3 leading-relaxed">{p.bio}</p>}

                  {/* Metrics */}
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    {[
                      { v: p.h_index,           l: "h-index" },
                      { v: p.publication_count,  l: "papers" },
                      { v: p.followers_count,    l: "followers" },
                    ].map((m) => (
                      <div key={m.l} className="text-center bg-slate-50 rounded-lg py-2">
                        <p className="font-bold text-slate-900 text-sm">{m.v}</p>
                        <p className="text-xs text-slate-500">{m.l}</p>
                      </div>
                    ))}
                  </div>

                  {/* Techniques */}
                  {p.techniques.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-4">
                      {p.techniques.slice(0, 3).map((t) => (
                        <span key={t} className="text-xs bg-slate-50 text-slate-600 rounded-full px-2 py-0.5 border border-slate-200">{t}</span>
                      ))}
                      {p.techniques.length > 3 && <span className="text-xs text-slate-400">+{p.techniques.length - 3}</span>}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2">
                    <button onClick={() => handleFollow(p.id)}
                      className={`flex-1 text-sm font-semibold py-2 rounded-xl transition-colors ${followed ? "bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200" : "bg-blue-600 text-white hover:bg-blue-700"}`}>
                      {followed ? "✓ Following" : "+ Follow"}
                    </button>
                    <Link href={`/profile/${p.id}`}
                      className="text-sm border border-slate-200 px-3 py-2 rounded-xl text-slate-600 hover:bg-slate-50 transition-colors">
                      View →
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
