"use client";

import { useLanguage } from "@/lib/language-context";
import { useState } from "react";

interface Props {
  items: string[];
  onChange: (items: string[]) => void;
}

export function BulletListEditor({ items, onChange }: Props) {
  const { isRTL, t } = useLanguage();
  const [editingIdx, setEditingIdx] = useState<number | null>(null);

  function update(idx: number, value: string) {
    const next = [...items];
    next[idx] = value;
    onChange(next);
  }

  function remove(idx: number) {
    onChange(items.filter((_, i) => i !== idx));
  }

  function add() {
    onChange([...items, ""]);
    setEditingIdx(items.length);
  }

  function move(idx: number, dir: "up" | "down") {
    const next = [...items];
    const target = dir === "up" ? idx - 1 : idx + 1;
    [next[idx], next[target]] = [next[target], next[idx]];
    onChange(next);
  }

  return (
    <div className="space-y-1.5" dir={isRTL ? "rtl" : "ltr"}>
      {items.map((item, i) => (
        <div key={i} className="group/bullet flex items-start gap-2">
          {/* Bullet marker */}
          <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gray-300" />

          {/* Content */}
          {editingIdx === i ? (
            <input
              autoFocus
              value={item}
              onChange={(e) => update(i, e.target.value)}
              onBlur={() => setEditingIdx(null)}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); setEditingIdx(null); }
                if (e.key === "Escape") setEditingIdx(null);
              }}
              dir={isRTL ? "rtl" : "ltr"}
              className={`flex-1 rounded border border-[#0091DA] bg-white px-2 py-0.5 text-sm outline-none focus:ring-2 focus:ring-[#0091DA]/20 ${isRTL ? "text-right" : "text-left"}`}
            />
          ) : (
            <span
              onClick={() => setEditingIdx(i)}
              className={`flex-1 cursor-pointer text-sm text-gray-600 hover:text-gray-900 ${isRTL ? "text-right" : "text-left"}`}
            >
              {item || <span className="italic text-gray-400">{t("emptyBullet") || "Empty bullet"}</span>}
            </span>
          )}

          {/* Actions */}
          <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover/bullet:opacity-100">
            <button onClick={() => move(i, "up")} disabled={i === 0}
              className="rounded p-0.5 text-gray-300 hover:text-gray-500 disabled:opacity-30">
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" /></svg>
            </button>
            <button onClick={() => move(i, "down")} disabled={i === items.length - 1}
              className="rounded p-0.5 text-gray-300 hover:text-gray-500 disabled:opacity-30">
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
            </button>
            <button onClick={() => remove(i)} className="rounded p-0.5 text-gray-300 hover:text-red-500">
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>
      ))}

      <button onClick={add}
        className="flex items-center gap-1 text-xs font-medium text-[#0091DA] transition-colors hover:text-[#00338D]">
        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
        {t("addBullet") || "Add bullet"}
      </button>
    </div>
  );
}
