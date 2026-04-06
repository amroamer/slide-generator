"use client";

import { useState } from "react";

interface Props {
  reason: string;
  actionLabel: string;
  onAction: () => void;
  loading?: boolean;
}

export function StaleWarning({ reason, actionLabel, onAction, loading }: Props) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return (
    <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 animate-fade-in">
      <svg className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
      </svg>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-amber-800">Upstream data changed</p>
        <p className="mt-0.5 text-xs text-amber-600">{reason}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button onClick={onAction} disabled={loading}
          className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-medium text-white transition-all hover:bg-amber-600 disabled:opacity-50">
          {loading ? <div className="h-3 w-3 animate-spin rounded-full border-[1.5px] border-white/30 border-t-white" /> : actionLabel}
        </button>
        <button onClick={() => setDismissed(true)} className="text-xs font-medium text-amber-600 hover:text-amber-800">
          Dismiss
        </button>
      </div>
    </div>
  );
}
