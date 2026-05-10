"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
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
  fullName: "",
  email: "",
  password: "",
  institution: "",
  orcidId: "",
  labMode: "",
  labName: "",
  labJoinCode: "",
  inviteEmails: [],
  role: "",
  researchDomain: "",
  subfields: [],
  techniques: [],
  notifyNewMatch: true,
  notifyAnswerRequest: true,
  notifyFork: true,
  notifyEndorsement: true,
  digestFrequency: "daily",
};

const STEPS = [
  { id: "A", label: "Account", description: "Create your account" },
  { id: "B", label: "Lab", description: "Join or create a workspace" },
  { id: "C", label: "Expertise", description: "Tag your research area" },
  { id: "D", label: "Notifications", description: "Set your preferences" },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [data, setData] = useState<OnboardingData>(INITIAL_DATA);
  const [submitError, setSubmitError] = useState("");

  function updateData(fields: Partial<OnboardingData>) {
    setData((prev) => ({ ...prev, ...fields }));
  }

  function next() {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep((s) => s + 1);
      window.scrollTo(0, 0);
    }
    // Final step is handled by handleComplete
  }

  function back() {
    if (currentStep > 0) {
      setCurrentStep((s) => s - 1);
      window.scrollTo(0, 0);
    }
  }

  async function handleComplete() {
    setSubmitError("");
    const supabase = createClient();

    // 1. Create the auth user
    const { data: authData, error: signUpError } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: { full_name: data.fullName },
      },
    });

    if (signUpError) {
      setSubmitError(signUpError.message);
      throw signUpError;
    }

    const userId = authData.user?.id;
    if (!userId) {
      setSubmitError("Account creation failed. Please try again.");
      throw new Error("No user ID returned");
    }

    // 2. Save profile to database
    const { error: profileError } = await supabase.from("profiles").insert({
      id: userId,
      full_name: data.fullName,
      institution: data.institution,
      orcid_id: data.orcidId || null,
      role: data.role,
      research_domain: data.researchDomain,
      subfields: data.subfields,
      techniques: data.techniques,
      lab_mode: data.labMode,
      lab_name: data.labName || null,
      notify_new_match: data.notifyNewMatch,
      notify_answer_request: data.notifyAnswerRequest,
      notify_fork: data.notifyFork,
      notify_endorsement: data.notifyEndorsement,
      digest_frequency: data.digestFrequency,
    });

    if (profileError) {
      // Profile save failed but auth succeeded — user can still access dashboard
      console.error("Profile save error:", profileError.message);
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <Link href="/" className="text-xl font-bold text-blue-600">SciCollab</Link>
        <span className="text-sm text-slate-500">
          Already have an account?{" "}
          <Link href="/login" className="text-blue-600 hover:underline">Sign in</Link>
        </span>
      </div>

      <div className="flex-1 flex flex-col items-center py-12 px-4">
        {/* Step progress */}
        <div className="w-full max-w-2xl mb-10">
          <div className="flex items-center gap-0">
            {STEPS.map((step, idx) => (
              <div key={step.id} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-shrink-0">
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-300 ${
                      idx < currentStep
                        ? "bg-blue-600 text-white"
                        : idx === currentStep
                        ? "bg-blue-600 text-white ring-4 ring-blue-100"
                        : "bg-white text-slate-400 border-2 border-slate-200"
                    }`}
                  >
                    {idx < currentStep ? <CheckIcon /> : step.id}
                  </div>
                  <div className="mt-1.5 text-center">
                    <div className={`text-xs font-medium ${idx <= currentStep ? "text-blue-600" : "text-slate-400"}`}>
                      {step.label}
                    </div>
                  </div>
                </div>
                {idx < STEPS.length - 1 && (
                  <div
                    className="flex-1 h-0.5 mx-2 mt-[-16px] step-connector"
                    style={{ backgroundColor: idx < currentStep ? "#2563eb" : "#e2e8f0" }}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Step card */}
        <div className="w-full max-w-2xl bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-8 py-6 border-b border-slate-100 bg-slate-50">
            <div className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-1">
              Step {currentStep + 1} of {STEPS.length}
            </div>
            <h1 className="text-xl font-bold text-slate-900">{STEPS[currentStep].description}</h1>
            {currentStep === 0 && (
              <p className="text-sm text-slate-500 mt-1">
                Goal: zero-friction onboarding — up and uploading in under 5 minutes.
              </p>
            )}
          </div>

          <div className="px-8 py-8">
            {submitError && (
              <div className="mb-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
                {submitError}
              </div>
            )}
            {currentStep === 0 && <StepAccountCreation data={data} updateData={updateData} onNext={next} />}
            {currentStep === 1 && <StepLabWorkspace data={data} updateData={updateData} onNext={next} onBack={back} />}
            {currentStep === 2 && <StepExpertiseTags data={data} updateData={updateData} onNext={next} onBack={back} />}
            {currentStep === 3 && <StepNotifications data={data} updateData={updateData} onComplete={handleComplete} onBack={back} />}
          </div>
        </div>

        <p className="text-xs text-slate-400 mt-6 text-center max-w-sm">
          By creating an account you agree to our Terms of Service and Privacy Policy.
          Your data is stored on EU servers and is GDPR compliant.
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
