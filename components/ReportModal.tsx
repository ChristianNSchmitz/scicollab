"use client";

import { useState } from "react";
import { addReport, hasReported, MOCK_USER_ID, type Report } from "@/lib/mock-db";

const REASONS: Array<{ value: Report["reason"]; label: string }> = [
  { value: "spam",          label: "Spam" },
  { value: "misinformation",label: "Misinformation" },
  { value: "harassment",    label: "Harassment" },
  { value: "duplicate",     label: "Duplicate" },
  { value: "other",         label: "Other" },
];

interface Props {
  targetType: Report["target_type"];
  targetId: string;
  onClose: () => void;
}

export default function ReportModal({ targetType, targetId, onClose }: Props) {
  const already = hasReported(targetId);
  const [reason, setReason] = useState<Report["reason"]>("spam");
  const [details, setDetails] = useState("");
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit() {
    addReport({
      reporter_id: MOCK_USER_ID,
      target_type: targetType,
      target_id: targetId,
      reason,
      details,
    });
    setSubmitted(true);
    setTimeout(() => onClose(), 2000);
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-bold text-slate-900 mb-4">Report content</h2>

        {already ? (
          <div className="text-center py-6">
            <p className="text-2xl mb-2">✅</p>
            <p className="text-sm text-slate-700 font-medium">Already reported</p>
            <p className="text-xs text-slate-500 mt-1">You have already submitted a report for this content.</p>
            <button onClick={onClose} className="mt-4 text-sm text-blue-600 hover:underline">Close</button>
          </div>
        ) : submitted ? (
          <div className="text-center py-6">
            <p className="text-2xl mb-2">✅</p>
            <p className="text-sm text-slate-700 font-medium">Reported. Our team will review this.</p>
          </div>
        ) : (
          <>
            <div className="space-y-2 mb-4">
              {REASONS.map((r) => (
                <label key={r.value} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="reason"
                    value={r.value}
                    checked={reason === r.value}
                    onChange={() => setReason(r.value)}
                    className="accent-blue-600"
                  />
                  <span className="text-sm text-slate-700">{r.label}</span>
                </label>
              ))}
            </div>

            <textarea
              rows={3}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Additional details (optional)"
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-400 resize-none mb-4"
            />

            <div className="flex gap-2">
              <button
                onClick={handleSubmit}
                className="flex-1 bg-red-600 text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-red-700 transition-colors"
              >
                Submit report
              </button>
              <button
                onClick={onClose}
                className="px-4 text-sm border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
