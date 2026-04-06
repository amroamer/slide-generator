"use client";

interface Chip {
  label: string;
  stale?: boolean;
}

interface Props {
  agentName: string;
  chips: Chip[];
}

export function HandoffChips({ agentName, chips }: Props) {
  if (!chips.length) return null;
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-[10px] font-medium text-gray-400">From {agentName}:</span>
      {chips.map((chip, i) => (
        <span key={i} className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-medium ${
          chip.stale ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-600"
        }`}>
          {chip.stale && (
            <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
            </svg>
          )}
          {chip.label}
        </span>
      ))}
    </div>
  );
}
