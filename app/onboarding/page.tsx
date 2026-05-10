"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import StepAccountCreation from "@/components/onboarding/StepAccountCreation";
import StepLabWorkspace from "@/components/onboarding/StepLabWorkspace";
import StepExpertiseTags from "@/components/onboarding/StepExpertiseTags";
import StepNotifications from "@/components/onboarding/StepNotifications";

export type OnboardingData = {
  // Step A
  fullName: string;
  email: string;
  password: string;
  institution: string;
  orcidId: string;
  // Step B
  labMode: "create" | "join" | "";
  labName: string;
  labJoinCode: string;
  inviteEmails: string[];
  role: string;
  // Step C
  researchDomain: string;
  subfields: string[];
  techniques: string[];
  // Step D
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

  function updateData(fields: Partial<OnboardingData>) {
    setData((prev) => ({ ...prev, ...fields }));
  }

  function next() {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep((s) => s + 1);
      window.scrollTo(0, 0);
    } else {
      // Final step — go to dashboard
      router.push("/dashboard");
    }
  }

  function back() {
    if (currentStep > 0) {
      setCurrentStep((s) => s - 1);
      window.scrollTo(0, 0);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top bar */}
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
                {/* Step circle */}
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
                    {idx < currentStep ? (
                      <CheckIcon />
                    ) : (
                      step.id
                    )}
                  </div>
                  <div className="mt-1.5 text-center">
                    <div className={`text-xs font-medium ${idx <= currentStep ? "text-blue-600" : "text-slate-400"}`}>
                      {step.label}
                    </div>
                  </div>
                </div>
                {/* Connector line */}
                {idx < STEPS.length - 1 && (
                  <div className="flex-1 h-0.5 mx-2 mt-[-16px] step-connector"
                    style={{ backgroundColor: idx < currentStep ? "#2563eb" : "#e2e8f0" }}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Step card */}
        <div className="w-full max-w-2xl bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Step header */}
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

          {/* Step content */}
          <div className="px-8 py-8">
            {currentStep === 0 && (
              <StepAccountCreation data={data} updateData={updateData} onNext={next} />
            )}
            {currentStep === 1 && (
              <StepLabWorkspace data={data} updateData={updateData} onNext={next} onBack={back} />
            )}
            {currentStep === 2 && (
              <StepExpertiseTags data={data} updateData={updateData} onNext={next} onBack={back} />
            )}
            {currentStep === 3 && (
              <StepNotifications data={data} updateData={updateData} onNext={next} onBack={back} />
            )}
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
