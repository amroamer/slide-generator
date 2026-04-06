"use client";

const LAYOUTS = [
  { id: "title_slide", label: "Title", icon: "T" },
  { id: "title_bullets", label: "Bullets", icon: "\u2261" },
  { id: "title_table", label: "Table", icon: "\u2637" },
  { id: "title_chart", label: "Chart", icon: "\u2581\u2583\u2585\u2587" },
  { id: "two_column", label: "2-Col", icon: "\u2225" },
  { id: "section_divider", label: "Divider", icon: "\u2500" },
  { id: "key_takeaway", label: "Takeaway", icon: "\u2605" },
];

interface Props {
  selected: string;
  onChange: (layout: string) => void;
}

export function LayoutSelector({ selected, onChange }: Props) {
  return (
    <div className="flex gap-1.5 overflow-x-auto py-1">
      {LAYOUTS.map((l) => (
        <button
          key={l.id}
          onClick={() => onChange(l.id)}
          className={`flex shrink-0 flex-col items-center rounded-lg border-2 px-3 py-2 transition-all duration-200 ${
            selected === l.id
              ? "border-[#00338D] bg-[#00338D]/5 text-[#00338D]"
              : "border-gray-200 text-gray-500 hover:border-gray-300"
          }`}
          style={{ minWidth: "70px" }}
        >
          <span className="text-lg leading-none">{l.icon}</span>
          <span className="mt-1 text-[10px] font-medium">{l.label}</span>
        </button>
      ))}
    </div>
  );
}
