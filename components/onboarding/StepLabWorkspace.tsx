"use client";

import { useState } from "react";
import { OnboardingData } from "@/app/onboarding/page";

type Props = {
  data: OnboardingData;
  updateData: (fields: Partial<OnboardingData>) => void;
  onNext: () => void;
  onBack: () => void;
};

const ROLES = [
  "PhD Student",
  "Postdoctoral Researcher",
  "Principal Investigator",
  "Research Scientist",
  "Lab Manager",
  "Research Engineer",
  "MSc / Undergraduate",
  "Industry R&D",
];

export default function StepLabWorkspace({ data, updateData, onNext, onBack }: Props) {
  const [inviteInput, setInviteInput] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate() {
    const e: Record<string, string> = {};
    if (!data.labMode) e.labMode = "Please choose to create or join a workspace";
    if (data.labMode === "create" && !data.labName.trim()) e.labName = "Lab name is required";
    if (data.labMode === "join" && !data.labJoinCode.trim()) e.labJoinCode = "Workspace code is required";
    if (!data.role) e.role = "Please select your role";
    return e;
  }

  function handleNext() {
    const e = validate();
    if (Object.keys(e).length > 0) {
      setErrors(e);
      return;
    }
    onNext();
  }

  function addInvite() {
    const email = inviteInput.trim();
    if (email && email.includes("@") && !data.inviteEmails.includes(email)) {
      updateData({ inviteEmails: [...data.inviteEmails, email] });
      setInviteInput("");
    }
  }

  function removeInvite(email: string) {
    updateData({ inviteEmails: data.inviteEmails.filter((e) => e !== email) });
  }

  return (
    <div className="space-y-6">
      {/* Mode selection */}
      <div>
        <p className="text-sm font-medium text-slate-700 mb-3">
          Lab workspace <span className="text-blue-500">*</span>
        </p>
        <div className="grid grid-cols-2 gap-4">
          <button
            type="button"
            onClick={() => { updateData({ labMode: "create" }); setErrors(prev => ({ ...prev, labMode: "" })); }}
            className={`border-2 rounded-xl p-5 text-left transition-all ${
              data.labMode === "create"
                ? "border-blue-500 bg-blue-50"
                : "border-slate-200 hover:border-slate-300"
            }`}
          >
            <div className="text-2xl mb-2">🔬</div>
            <div className="font-semibold text-slate-900 text-sm">Create a new workspace</div>
            <div className="text-xs text-slate-500 mt-1">Start fresh — you become the PI / admin</div>
          </button>
          <button
            type="button"
            onClick={() => { updateData({ labMode: "join" }); setErrors(prev => ({ ...prev, labMode: "" })); }}
            className={`border-2 rounded-xl p-5 text-left transition-all ${
              data.labMode === "join"
                ? "border-blue-500 bg-blue-50"
                : "border-slate-200 hover:border-slate-300"
            }`}
          >
            <div className="text-2xl mb-2">👥</div>
            <div className="font-semibold text-slate-900 text-sm">Join an existing workspace</div>
            <div className="text-xs text-slate-500 mt-1">Enter an invite code from your PI</div>
          </button>
        </div>
        {errors.labMode && <p className="text-xs text-red-500 mt-2">{errors.labMode}</p>}
      </div>

      {/* Conditional fields */}
      {data.labMode === "create" && (
        <div className="space-y-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
          <Field label="Lab / Group Name" required error={errors.labName}>
            <input
              type="text"
              placeholder="Chen Lab · MIT Brain & Cognitive Sciences"
              value={data.labName}
              onChange={(e) => { updateData({ labName: e.target.value }); setErrors(prev => ({ ...prev, labName: "" })); }}
              className={inputClass(!!errors.labName)}
            />
          </Field>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Invite colleagues <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <div className="flex gap-2">
              <input
                type="email"
                placeholder="colleague@institution.edu"
                value={inviteInput}
                onChange={(e) => setInviteInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addInvite())}
                className={inputClass(false) + " flex-1"}
              />
              <button
                type="button"
                onClick={addInvite}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition-colors flex-shrink-0"
              >
                Add
              </button>
            </div>
            {data.inviteEmails.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {data.inviteEmails.map((email) => (
                  <span
                    key={email}
                    className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 text-xs px-2.5 py-1 rounded-full border border-blue-100"
                  >
                    {email}
                    <button
                      type="button"
                      onClick={() => removeInvite(email)}
                      className="text-blue-400 hover:text-blue-700"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
            <p className="text-xs text-slate-400 mt-1.5">Press Enter or click Add — they&apos;ll receive an invite email</p>
          </div>

          <div className="bg-amber-50 border border-amber-100 rounded-lg px-4 py-3 text-xs text-amber-700">
            <strong>PI Permissions:</strong> As workspace creator you can set access levels, endorse method cards, manage versioning, and track knowledge reuse across projects.
          </div>
        </div>
      )}

      {data.labMode === "join" && (
        <div className="space-y-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
          <Field label="Workspace Invite Code" required error={errors.labJoinCode}>
            <input
              type="text"
              placeholder="e.g. CHEN-LAB-2026"
              value={data.labJoinCode}
              onChange={(e) => { updateData({ labJoinCode: e.target.value.toUpperCase() }); setErrors(prev => ({ ...prev, labJoinCode: "" })); }}
              className={inputClass(!!errors.labJoinCode) + " font-mono tracking-wider"}
            />
          </Field>
          <p className="text-xs text-slate-500">
            Ask your PI or lab admin for the invite code. Don&apos;t have one?{" "}
            <button
              type="button"
              onClick={() => updateData({ labMode: "create" })}
              className="text-blue-600 hover:underline"
            >
              Create a new workspace instead
            </button>
          </p>
        </div>
      )}

      {/* Role */}
      <Field label="Your Role" required error={errors.role}>
        <select
          value={data.role}
          onChange={(e) => { updateData({ role: e.target.value }); setErrors(prev => ({ ...prev, role: "" })); }}
          className={inputClass(!!errors.role) + " cursor-pointer"}
        >
          <option value="">Select your role…</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        <p className="text-xs text-slate-400 mt-1.5">This powers peer-matching and expert routing for Q&A</p>
      </Field>

      {/* Navigation */}
      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onBack}
          className="flex-1 border border-slate-200 text-slate-700 py-3 rounded-xl font-semibold hover:bg-slate-50 transition-colors"
        >
          ← Back
        </button>
        <button
          type="button"
          onClick={handleNext}
          className="flex-[2] bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors"
        >
          Continue to Expertise →
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">
        {label}
        {required && <span className="text-blue-500 ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-red-500 mt-1.5">{error}</p>}
    </div>
  );
}

function inputClass(hasError: boolean) {
  return `w-full border rounded-lg px-3 py-2.5 text-sm outline-none transition-colors bg-white ${
    hasError
      ? "border-red-300 focus:border-red-500 focus:ring-2 focus:ring-red-100"
      : "border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-50"
  }`;
}
