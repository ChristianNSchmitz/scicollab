"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { saveMockProfile, registerUser } from "@/lib/mock-db";
import StepAccountCreation from "@/components/onboarding/StepAccountCreation";
import StepLabWorkspace from "@/components/onboarding/StepLabWorkspace";
import StepExpertiseTags from "@/components/onboarding/StepExpertiseTags";
import StepNotifications from "@/components/onboarding/StepNotifications";

export type OnboardingData = {
  fullName: string;
  email: string;
  password: string;
  institution: string;
  orcidId: string;
  orcidVerified: boolean;
  labMode: "create" | "join" | "";
  labName: string;
  labJoinCode: string;
  inviteEmails: string[];
  role: string;
  researchDomain: string;
  subfields: string[];
  techniques: string[];
  notifyNewMatch: boolean;
  notifyAnswerRequest: boolean;
  notifyFork: boolean;
  notifyEndorsement: boolean;
  digestFrequency: "realtime" | "daily" | "weekly";
};

const INITIAL_DATA: OnboardingData = {
  fullName: "", email: "", password: "", institution: "", orcidId: "", orcidVerified: false,
  labMode: "", labName: "", labJoinCode: "", inviteEmails: [], role: "",
  researchDomain: "", subfields: [], techniques: [],
  notifyNewMatch: true, notifyAnswerRequest: true, notifyFork: true, notifyEndorsement: true,
  digestFrequency: "daily",
};

const STEPS = [
  { id: "A", label: "Account",       description: "Create your account" },
  { id: "B", label: "Lab",           description: "Join or create a workspace" },
  { id: "C", label: "Expertise",     description: "Tag your research area" },
  { id: "D", label: "Notifications", description: "Set your preferences" },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [data, setData] = useState<OnboardingData>(INITIAL_DATA);

  function updateData(fields: Partial<OnboardingData>) {
    setData((prev) => ({ ...prev, ...fields }));
  }
  function next() {
    if (currentStep < STEPS.length - 1) { setCurrentStep((s) => s + 1); window.scrollTo(0, 0); }
  }
  function back() {
    if (currentStep > 0) { setCurrentStep((s) => s - 1); window.scrollTo(0, 0); }
  }

  async function handleComplete() {
    // Register (or re-login) the user — sets the session
    registerUser(data.email || `user-${Date.now()}@scicollab.local`, data.password || "scicollab123", data.fullName || "Researcher");
    // Save profile for this user
    saveMockProfile({
      full_name:       data.fullName || "Researcher",
      institution:     data.institution,
      orcid_id:        data.orcidId || null,
      orcid_verified:  data.orcidVerified,
      role:            data.role,
      research_domain: data.researchDomain,
      techniques:      data.techniques,
    });
    router.push("/dashboard");
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-700 via-indigo-700 to-blue-900 flex flex-col">
      {/* Nav */}
      <div className="px-6 py-4 flex items-center justify-between">
        <Link href="/" className="text-xl font-bold text-white">SciCollab</Link>
        <span className="text-sm text-blue-200">
          Already have an account?{" "}
          <Link href="/login" className="text-white font-semibold hover:underline">Sign in</Link>
        </span>
      </div>

      <div className="flex-1 flex flex-col items-center py-10 px-4">
        {/* Step progress */}
        <div className="w-full max-w-2xl mb-8">
          <div className="flex items-center gap-0">
            {STEPS.map((step, idx) => (
              <div key={step.id} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-shrink-0">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-300 ${
                    idx < currentStep
                      ? "bg-white text-blue-700"
                      : idx === currentStep
                      ? "bg-white text-blue-700 ring-4 ring-white/30"
                      : "bg-white/20 text-white border-2 border-white/40"
                  }`}>
                    {idx < currentStep ? <CheckIcon /> : step.id}
                  </div>
                  <div className="mt-1.5 text-center">
                    <div className={`text-xs font-medium ${idx <= currentStep ? "text-white" : "text-blue-200"}`}>
                      {step.label}
                    </div>
                  </div>
                </div>
                {idx < STEPS.length - 1 && (
                  <div className="flex-1 h-0.5 mx-2 mt-[-16px]"
                    style={{ backgroundColor: idx < currentStep ? "white" : "rgba(255,255,255,0.25)" }} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Card */}
        <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="px-8 py-5 border-b border-slate-100 bg-slate-50">
            <div className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-0.5">
              Step {currentStep + 1} of {STEPS.length}
            </div>
            <h1 className="text-xl font-bold text-slate-900">{STEPS[currentStep].description}</h1>
            {currentStep === 0 && (
              <p className="text-sm text-slate-500 mt-1">
                Zero-friction onboarding — up and uploading in under 5 minutes.
              </p>
            )}
          </div>

          <div className="px-8 py-8">
            {currentStep === 0 && <StepAccountCreation data={data} updateData={updateData} onNext={next} />}
            {currentStep === 1 && <StepLabWorkspace data={data} updateData={updateData} onNext={next} onBack={back} />}
            {currentStep === 2 && <StepExpertiseTags data={data} updateData={updateData} onNext={next} onBack={back} />}
            {currentStep === 3 && <StepNotifications data={data} updateData={updateData} onComplete={handleComplete} onBack={back} />}
          </div>
        </div>

        <p className="text-xs text-blue-200 mt-6 text-center max-w-sm">
          By creating an account you agree to our Terms of Service and Privacy Policy.
          Your data is stored locally on this device.
        </p>
      </div>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}
