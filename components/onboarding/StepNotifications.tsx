"use client";

import { useState } from "react";
import { OnboardingData } from "@/app/onboarding/page";

type Props = {
  data: OnboardingData;
  updateData: (fields: Partial<OnboardingData>) => void;
  onComplete: () => Promise<void>;
  onBack: () => void;
};

type NotificationItem = {
  key: keyof Pick<
    OnboardingData,
    "notifyNewMatch" | "notifyAnswerRequest" | "notifyFork" | "notifyEndorsement"
  >;
  icon: string;
  title: string;
  description: string;
};

const NOTIFICATION_ITEMS: NotificationItem[] = [
  {
    key: "notifyNewMatch",
    icon: "🔬",
    title: "New Experiment Match",
    description: "A new experiment matching your technique tags was uploaded",
  },
  {
    key: "notifyAnswerRequest",
    icon: "❓",
    title: "Answer Request",
    description: "A researcher linked your experiment and asked a question in your expertise area",
  },
  {
    key: "notifyFork",
    icon: "🔁",
    title: "Protocol Forked",
    description: "Someone forked your protocol or method card",
  },
  {
    key: "notifyEndorsement",
    icon: "⭐",
    title: "Endorsement Received",
    description: "A PI or peer endorsed one of your answers or contributions",
  },
];

export default function StepNotifications({ data, updateData, onComplete, onBack }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleFinish() {
    setSubmitting(true);
    setError("");
    try {
      await onComplete();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Something went wrong. Please try again.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  const enabledCount = NOTIFICATION_ITEMS.filter((item) => data[item.key]).length;

  return (
    <div className="space-y-6">
      <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-600">
        <strong className="text-slate-900">Pull-based, not push-spam</strong> — SciCollab only notifies you about what matters to your current work. You can adjust these at any time in your settings.
      </div>

      {/* Notification toggles */}
      <div className="space-y-3">
        {NOTIFICATION_ITEMS.map((item) => (
          <div
            key={item.key}
            className={`flex items-start gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${
              data[item.key]
                ? "border-blue-200 bg-blue-50"
                : "border-slate-200 bg-white hover:border-slate-300"
            }`}
            onClick={() => updateData({ [item.key]: !data[item.key] })}
          >
            <div className="text-2xl flex-shrink-0 mt-0.5">{item.icon}</div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-slate-900 text-sm">{item.title}</div>
              <div className="text-xs text-slate-500 mt-0.5">{item.description}</div>
            </div>
            <div className="flex-shrink-0">
              <Toggle enabled={data[item.key]} />
            </div>
          </div>
        ))}
      </div>

      {/* Digest frequency */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-3">
          Notification frequency
        </label>
        <div className="grid grid-cols-3 gap-3">
          {(["realtime", "daily", "weekly"] as const).map((freq) => {
            const labels = { realtime: "Real-time", daily: "Daily digest", weekly: "Weekly digest" };
            const descs = {
              realtime: "Instant email",
              daily: "One email/day",
              weekly: "One email/week",
            };
            return (
              <button
                key={freq}
                type="button"
                onClick={() => updateData({ digestFrequency: freq })}
                className={`border-2 rounded-xl p-3 text-left transition-all ${
                  data.digestFrequency === freq
                    ? "border-blue-500 bg-blue-50"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <div className="text-sm font-semibold text-slate-900">{labels[freq]}</div>
                <div className="text-xs text-slate-500 mt-0.5">{descs[freq]}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Summary of choices */}
      <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4">
        <p className="text-sm font-semibold text-emerald-800 mb-1">Almost done! Here&apos;s your setup summary:</p>
        <ul className="text-xs text-emerald-700 space-y-1">
          <li>✓ Account created for <strong>{data.fullName || "you"}</strong> at <strong>{data.institution || "your institution"}</strong></li>
          <li>✓ {data.labMode === "create" ? `Lab workspace "${data.labName || "your lab"}" created` : "Joining existing lab workspace"}</li>
          <li>✓ {data.researchDomain || "Research domain"} · {data.techniques.length} technique tag{data.techniques.length !== 1 ? "s" : ""}</li>
          <li>✓ {enabledCount} notification type{enabledCount !== 1 ? "s" : ""} enabled · {data.digestFrequency === "realtime" ? "Real-time" : data.digestFrequency === "daily" ? "Daily digest" : "Weekly digest"}</li>
        </ul>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Navigation */}
      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onBack}
          disabled={submitting}
          className="flex-1 border border-slate-200 text-slate-700 py-3 rounded-xl font-semibold hover:bg-slate-50 transition-colors disabled:opacity-50"
        >
          ← Back
        </button>
        <button
          type="button"
          onClick={handleFinish}
          disabled={submitting}
          className="flex-[2] bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors disabled:opacity-70 flex items-center justify-center gap-2"
        >
          {submitting ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Setting up your workspace…
            </>
          ) : (
            "Complete Setup & Go to Dashboard →"
          )}
        </button>
      </div>
    </div>
  );
}

function Toggle({ enabled }: { enabled: boolean }) {
  return (
    <div
      className={`w-10 h-6 rounded-full relative transition-colors duration-200 ${
        enabled ? "bg-blue-600" : "bg-slate-300"
      }`}
    >
      <div
        className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${
          enabled ? "translate-x-5" : "translate-x-1"
        }`}
      />
    </div>
  );
}
