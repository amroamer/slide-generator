"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  value: string;
  onChange: (value: string) => void;
  as?: "input" | "textarea";
  className?: string;
  editClassName?: string;
  placeholder?: string;
}

export function EditableText({
  value,
  onChange,
  as = "input",
  className = "",
  editClassName = "",
  placeholder = "Click to edit...",
}: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => { setDraft(value); }, [value]);
  useEffect(() => { if (editing) ref.current?.focus(); }, [editing]);

  function commit() {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed !== value) onChange(trimmed);
  }

  if (editing) {
    const cls = `w-full rounded-lg border border-[#0091DA] bg-white px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-[#0091DA]/20 ${editClassName}`;
    if (as === "textarea") {
      return (
        <textarea
          ref={ref as any}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === "Escape") { setDraft(value); setEditing(false); } }}
          className={cls}
          rows={3}
        />
      );
    }
    return (
      <input
        ref={ref as any}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") { setDraft(value); setEditing(false); } }}
        className={cls}
      />
    );
  }

  return (
    <span
      onClick={() => setEditing(true)}
      className={`group/edit cursor-pointer ${className}`}
      title="Click to edit"
    >
      {value || <span className="italic text-gray-400">{placeholder}</span>}
      <svg className="ml-1 inline h-3 w-3 text-gray-300 opacity-0 transition-opacity group-hover/edit:opacity-100" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
      </svg>
    </span>
  );
}
