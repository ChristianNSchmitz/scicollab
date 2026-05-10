"use client";

import { useState } from "react";
import { OnboardingData } from "@/app/onboarding/page";

type Props = {
  data: OnboardingData;
  updateData: (fields: Partial<OnboardingData>) => void;
  onNext: () => void;
};

const SSO_PROVIDERS = [
  { name: "Google Scholar / Institutional SSO", icon: "🏛️" },
  { name: "ORCID", icon: "🆔" },
];

export default function StepAccountCreation({ data, updateData, onNext }: Props) {
  const [showPassword, setShowPassword] = useState(false);
  const [orcidVerified, setOrcidVerified] = useState(false);
  const [orcidChecking, setOrcidChecking] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate() {
    const e: Record<string, string> = {};
    if (!data.fullName.trim()) e.fullName = "Full name is required";
    if (!data.email.trim() || !data.email.includes("@")) e.email = "Valid email is required";
    if (!data.password || data.password.length < 8) e.password = "Password must be at least 8 characters";
    if (!data.institution.trim()) e.institution = "Institution is required";
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

  function simulateOrcidVerify() {
    if (!data.orcidId.trim()) return;
    setOrcidChecking(true);
    setTimeout(() => {
      setOrcidChecking(false);
      setOrcidVerified(true);
    }, 1200);
  }

  const isOrcidFormat = /^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/.test(data.orcidId);

  return (
    <div className="space-y-6">
      {/* SSO options */}
      <div>
        <p className="text-sm font-medium text-slate-700 mb-3">Quick sign up with</p>
        <div className="grid grid-cols-2 gap-3">
          {SSO_PROVIDERS.map((p) => (
            <button
              key={p.name}
              type="button"
              className="flex items-center justify-center gap-2 border border-slate-200 rounded-lg px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all"
            >
              <span>{p.icon}</span>
              <span>{p.name}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-slate-200" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-white px-3 text-xs text-slate-400">or continue with email</span>
        </div>
      </div>

      {/* Form fields */}
      <div className="grid sm:grid-cols-2 gap-4">
        <Field
          label="Full Name"
          required
          error={errors.fullName}
          hint="As it appears on your publications"
        >
          <input
            type="text"
            placeholder="Dr. Alex Chen"
            value={data.fullName}
            onChange={(e) => { updateData({ fullName: e.target.value }); setErrors(prev => ({ ...prev, fullName: "" })); }}
            className={inputClass(!!errors.fullName)}
          />
        </Field>

        <Field label="Institution" required error={errors.institution}>
          <input
            type="text"
            placeholder="MIT, Johns Hopkins, ETH Zurich…"
            value={data.institution}
            onChange={(e) => { updateData({ institution: e.target.value }); setErrors(prev => ({ ...prev, institution: "" })); }}
            className={inputClass(!!errors.institution)}
          />
        </Field>
      </div>

      <Field label="Email Address" required error={errors.email}>
        <input
          type="email"
          placeholder="alex.chen@mit.edu"
          value={data.email}
          onChange={(e) => { updateData({ email: e.target.value }); setErrors(prev => ({ ...prev, email: "" })); }}
          className={inputClass(!!errors.email)}
        />
      </Field>

      <Field label="Password" required error={errors.password}>
        <div className="relative">
          <input
            type={showPassword ? "text" : "password"}
            placeholder="At least 8 characters"
            value={data.password}
            onChange={(e) => { updateData({ password: e.target.value }); setErrors(prev => ({ ...prev, password: "" })); }}
            className={inputClass(!!errors.password) + " pr-10"}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
          >
            {showPassword ? "Hide" : "Show"}
          </button>
        </div>
        {data.password && (
          <PasswordStrength password={data.password} />
        )}
      </Field>

      {/* ORCID */}
      <Field
        label="ORCID iD"
        hint="Optional but recommended — verifies your academic identity and builds credibility"
      >
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="0000-0000-0000-0000"
            value={data.orcidId}
            onChange={(e) => { updateData({ orcidId: e.target.value }); setOrcidVerified(false); }}
            className={inputClass(false) + " flex-1 font-mono text-sm"}
          />
          <button
            type="button"
            onClick={simulateOrcidVerify}
            disabled={!isOrcidFormat || orcidChecking || orcidVerified}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-all flex-shrink-0 ${
              orcidVerified
                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                : isOrcidFormat && !orcidChecking
                ? "bg-blue-600 text-white hover:bg-blue-700"
                : "bg-slate-100 text-slate-400 cursor-not-allowed"
            }`}
          >
            {orcidChecking ? "Verifying…" : orcidVerified ? "✓ Verified" : "Verify"}
          </button>
        </div>
        {orcidVerified && (
          <p className="text-xs text-emerald-600 mt-1.5 flex items-center gap-1">
            <span>✓</span> ORCID identity verified — your profile will show an academic badge
          </p>
        )}
        {!orcidVerified && data.orcidId && !isOrcidFormat && (
          <p className="text-xs text-amber-600 mt-1.5">Format: 0000-0000-0000-0000</p>
        )}
      </Field>

      <div className="pt-2">
        <button
          type="button"
          onClick={handleNext}
          className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors"
        >
          Continue to Lab Workspace →
        </button>
      </div>
    </div>
  );
}

function PasswordStrength({ password }: { password: string }) {
  const checks = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ];
  const score = checks.filter(Boolean).length;
  const labels = ["Weak", "Fair", "Good", "Strong"];
  const colors = ["bg-red-400", "bg-amber-400", "bg-blue-400", "bg-emerald-500"];

  return (
    <div className="mt-2">
      <div className="flex gap-1 mb-1">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-all ${i < score ? colors[score - 1] : "bg-slate-200"}`}
          />
        ))}
      </div>
      <p className="text-xs text-slate-500">{labels[score - 1] || "Too short"}</p>
    </div>
  );
}

function Field({
  label,
  required,
  hint,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
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
      {hint && !error && <p className="text-xs text-slate-400 mt-1.5">{hint}</p>}
      {error && <p className="text-xs text-red-500 mt-1.5">{error}</p>}
    </div>
  );
}

function inputClass(hasError: boolean) {
  return `w-full border rounded-lg px-3 py-2.5 text-sm outline-none transition-colors ${
    hasError
      ? "border-red-300 focus:border-red-500 focus:ring-2 focus:ring-red-100"
      : "border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-50"
  }`;
}
