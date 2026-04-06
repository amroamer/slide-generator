"use client";

import api from "@/lib/api";
import { useCallback, useEffect, useRef, useState } from "react";

/* ================================================================== */
/*  Types                                                              */
/* ================================================================== */

interface Block {
  id: string;
  section_id: string;
  order_index: number;
  block_type: string;
  content_json: Record<string, any>;
  is_visible: boolean;
}

interface Section {
  id: string;
  title: string;
  slug: string;
  order_index: number;
  is_visible: boolean;
  blocks: Block[];
}

type BlockType =
  | "heading"
  | "paragraph"
  | "screenshot"
  | "tip"
  | "warning"
  | "steps"
  | "shortcut_table"
  | "divider";

/* ================================================================== */
/*  Constants                                                          */
/* ================================================================== */

const BLOCK_BORDER_COLORS: Record<string, string> = {
  heading: "border-blue-500",
  paragraph: "border-gray-300",
  screenshot: "border-emerald-500",
  tip: "border-cyan-500",
  warning: "border-amber-500",
  steps: "border-purple-500",
  shortcut_table: "border-indigo-500",
  divider: "border-gray-200",
};

const BLOCK_TYPE_META: { type: BlockType; label: string; color: string; icon: string }[] = [
  { type: "heading", label: "Heading", color: "bg-blue-50 text-blue-700 border-blue-200", icon: "M4 6h16M4 12h8" },
  { type: "paragraph", label: "Paragraph", color: "bg-gray-50 text-gray-700 border-gray-200", icon: "M4 6h16M4 10h16M4 14h16M4 18h10" },
  { type: "screenshot", label: "Screenshot", color: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: "M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" },
  { type: "tip", label: "Tip", color: "bg-cyan-50 text-cyan-700 border-cyan-200", icon: "M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" },
  { type: "warning", label: "Warning", color: "bg-amber-50 text-amber-700 border-amber-200", icon: "M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" },
  { type: "steps", label: "Steps", color: "bg-purple-50 text-purple-700 border-purple-200", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" },
  { type: "shortcut_table", label: "Shortcut Table", color: "bg-indigo-50 text-indigo-700 border-indigo-200", icon: "M3 10h18M3 14h18M10 3v18" },
  { type: "divider", label: "Divider", color: "bg-gray-50 text-gray-500 border-gray-200", icon: "M5 12h14" },
];

/* ================================================================== */
/*  SVG Icon helper                                                    */
/* ================================================================== */

function Ico({ d, className = "h-4 w-4" }: { d: string; className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

/* ================================================================== */
/*  Saved flash indicator                                              */
/* ================================================================== */

function SavedFlash({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-600 animate-fade-in">
      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
      Saved
    </span>
  );
}

/* ================================================================== */
/*  Block type selector popover                                        */
/* ================================================================== */

function BlockTypeSelector({ onSelect, onClose }: { onSelect: (t: BlockType) => void; onClose: () => void }) {
  return (
    <div className="absolute bottom-full left-0 z-20 mb-2 w-80 rounded-xl border border-gray-200 bg-white p-3 shadow-xl animate-fade-in">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-400">Add block</p>
      <div className="grid grid-cols-4 gap-1.5">
        {BLOCK_TYPE_META.map((bt) => (
          <button
            key={bt.type}
            onClick={() => { onSelect(bt.type); onClose(); }}
            className={`flex flex-col items-center gap-1 rounded-lg border p-2 text-center transition hover:shadow-sm ${bt.color}`}
          >
            <Ico d={bt.icon} className="h-4 w-4" />
            <span className="text-[10px] font-medium leading-tight">{bt.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ================================================================== */
/*  Block editors by type                                              */
/* ================================================================== */

function HeadingEditor({ block, onChange }: { block: Block; onChange: (cj: Record<string, any>) => void }) {
  const cj = block.content_json || {};
  const text = cj.text || "";
  const level = cj.level || 2;
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        {[2, 3].map((l) => (
          <button
            key={l}
            onClick={() => onChange({ ...cj, level: l })}
            className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
              level === l ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            H{l}
          </button>
        ))}
      </div>
      <input
        type="text"
        value={text}
        onChange={(e) => onChange({ ...cj, text: e.target.value })}
        placeholder="Heading text..."
        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
      />
    </div>
  );
}

function ParagraphEditor({ block, onChange }: { block: Block; onChange: (cj: Record<string, any>) => void }) {
  const cj = block.content_json || {};
  const text = cj.text || "";
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.style.height = "auto";
      ref.current.style.height = ref.current.scrollHeight + "px";
    }
  }, [text]);

  return (
    <textarea
      ref={ref}
      value={text}
      onChange={(e) => onChange({ ...cj, text: e.target.value })}
      placeholder="Paragraph text..."
      rows={2}
      className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm leading-relaxed focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
    />
  );
}

function ScreenshotEditor({
  block,
  onChange,
  onSave,
  sectionId,
}: {
  block: Block;
  onChange: (cj: Record<string, any>) => void;
  onSave: (cj: Record<string, any>) => void;
  sectionId: string;
}) {
  const cj = block.content_json || {};
  const imagePath = cj.image_path || "";
  const caption = cj.caption || "";
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleUpload(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { data } = await api.post("/guide/screenshots/upload", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const updated = { ...cj, image_path: data.image_path, filename: data.filename, width: data.width, height: data.height };
      onChange(updated);
      onSave(updated);
    } catch (err) {
      console.error("Screenshot upload failed:", err);
    } finally {
      setUploading(false);
    }
  }

  if (!imagePath) {
    return (
      <div className="space-y-2">
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 bg-gray-50/60 py-8 text-sm text-gray-400 transition hover:border-emerald-400 hover:bg-emerald-50/40 hover:text-emerald-600"
        >
          {uploading ? (
            <Spinner />
          ) : (
            <>
              <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <circle cx="12" cy="13" r="3" />
              </svg>
              <span>Click to upload screenshot</span>
            </>
          )}
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])} />
        <input
          type="text"
          value={caption}
          onChange={(e) => onChange({ ...cj, caption: e.target.value })}
          placeholder="Caption (optional)..."
          className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-500 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
        />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
        <img src={imagePath} alt={caption || "Screenshot"} className="w-full" />
        <div className="absolute right-2 top-2 flex gap-1.5">
          <button
            onClick={() => fileRef.current?.click()}
            className="rounded-md bg-white/90 px-2 py-1 text-[11px] font-medium text-gray-700 shadow-sm backdrop-blur hover:bg-white"
          >
            Replace
          </button>
          <button
            onClick={() => { const updated = { ...cj, image_path: "", filename: "", width: 0, height: 0 }; onChange(updated); onSave(updated); }}
            className="rounded-md bg-white/90 px-2 py-1 text-[11px] font-medium text-red-600 shadow-sm backdrop-blur hover:bg-red-50"
          >
            Remove
          </button>
        </div>
      </div>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])} />
      <input
        type="text"
        value={caption}
        onChange={(e) => onChange({ ...cj, caption: e.target.value })}
        placeholder="Caption (optional)..."
        className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-500 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
      />
    </div>
  );
}

function TipEditor({ block, onChange }: { block: Block; onChange: (cj: Record<string, any>) => void }) {
  const cj = block.content_json || {};
  const text = cj.text || "";
  return (
    <div className="rounded-lg border border-cyan-200 bg-cyan-50/60 p-3">
      <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold text-cyan-700">
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
        Tip
      </div>
      <textarea
        value={text}
        onChange={(e) => onChange({ ...cj, text: e.target.value })}
        placeholder="Tip text..."
        rows={2}
        className="w-full resize-none rounded border-0 bg-transparent text-sm leading-relaxed text-cyan-800 placeholder-cyan-400 focus:outline-none"
      />
    </div>
  );
}

function WarningEditor({ block, onChange }: { block: Block; onChange: (cj: Record<string, any>) => void }) {
  const cj = block.content_json || {};
  const text = cj.text || "";
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3">
      <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold text-amber-700">
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
        Warning
      </div>
      <textarea
        value={text}
        onChange={(e) => onChange({ ...cj, text: e.target.value })}
        placeholder="Warning text..."
        rows={2}
        className="w-full resize-none rounded border-0 bg-transparent text-sm leading-relaxed text-amber-800 placeholder-amber-400 focus:outline-none"
      />
    </div>
  );
}

function StepsEditor({ block, onChange }: { block: Block; onChange: (cj: Record<string, any>) => void }) {
  const cj = block.content_json || {};
  const steps: string[] = cj.steps || [""];

  function updateStep(i: number, val: string) {
    const next = [...steps];
    next[i] = val;
    onChange({ ...cj, steps: next });
  }
  function addStep() {
    onChange({ ...cj, steps: [...steps, ""] });
  }
  function removeStep(i: number) {
    const next = steps.filter((_: string, idx: number) => idx !== i);
    onChange({ ...cj, steps: next.length > 0 ? next : [""] });
  }

  return (
    <div className="space-y-1.5">
      {steps.map((s: string, i: number) => (
        <div key={i} className="flex items-start gap-2">
          <span className="mt-2 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-purple-100 text-[10px] font-bold text-purple-700">
            {i + 1}
          </span>
          <input
            type="text"
            value={s}
            onChange={(e) => updateStep(i, e.target.value)}
            placeholder={`Step ${i + 1}...`}
            className="min-w-0 flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
          <button onClick={() => removeStep(i)} className="mt-1 rounded p-1 text-gray-300 hover:bg-red-50 hover:text-red-500 transition" title="Remove step">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}
      <button onClick={addStep} className="flex items-center gap-1 text-[11px] font-medium text-purple-600 hover:text-purple-800 transition">
        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
        Add step
      </button>
    </div>
  );
}

function ShortcutTableEditor({ block, onChange }: { block: Block; onChange: (cj: Record<string, any>) => void }) {
  const cj = block.content_json || {};
  const rows: { key: string; action: string }[] = cj.rows || [{ key: "", action: "" }];

  function updateRow(i: number, field: "key" | "action", val: string) {
    const next = [...rows];
    next[i] = { ...next[i], [field]: val };
    onChange({ ...cj, rows: next });
  }
  function addRow() {
    onChange({ ...cj, rows: [...rows, { key: "", action: "" }] });
  }
  function removeRow(i: number) {
    const next = rows.filter((_: any, idx: number) => idx !== i);
    onChange({ ...cj, rows: next.length > 0 ? next : [{ key: "", action: "" }] });
  }

  return (
    <div className="space-y-1">
      <div className="grid grid-cols-[1fr_2fr_auto] gap-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400 px-1">
        <span>Key / Shortcut</span>
        <span>Action</span>
        <span className="w-6" />
      </div>
      {rows.map((row: { key: string; action: string }, i: number) => (
        <div key={i} className="grid grid-cols-[1fr_2fr_auto] gap-1">
          <input
            type="text"
            value={row.key}
            onChange={(e) => updateRow(i, "key", e.target.value)}
            placeholder="Ctrl+S"
            className="rounded border border-gray-200 px-2 py-1.5 text-xs font-mono focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
          <input
            type="text"
            value={row.action}
            onChange={(e) => updateRow(i, "action", e.target.value)}
            placeholder="Save document"
            className="rounded border border-gray-200 px-2 py-1.5 text-xs focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
          <button onClick={() => removeRow(i)} className="rounded p-1 text-gray-300 hover:bg-red-50 hover:text-red-500 transition" title="Remove row">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}
      <button onClick={addRow} className="flex items-center gap-1 text-[11px] font-medium text-indigo-600 hover:text-indigo-800 transition">
        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
        Add row
      </button>
    </div>
  );
}

function DividerEditor() {
  return <hr className="my-2 border-gray-200" />;
}

/* ================================================================== */
/*  Block editor wrapper                                               */
/* ================================================================== */

function BlockEditor({
  block,
  onChange,
  onSave,
  sectionId,
}: {
  block: Block;
  onChange: (cj: Record<string, any>) => void;
  onSave: (cj: Record<string, any>) => void;
  sectionId: string;
}) {
  switch (block.block_type) {
    case "heading":
      return <HeadingEditor block={block} onChange={onChange} />;
    case "paragraph":
      return <ParagraphEditor block={block} onChange={onChange} />;
    case "screenshot":
      return <ScreenshotEditor block={block} onChange={onChange} onSave={onSave} sectionId={sectionId} />;
    case "tip":
      return <TipEditor block={block} onChange={onChange} />;
    case "warning":
      return <WarningEditor block={block} onChange={onChange} />;
    case "steps":
      return <StepsEditor block={block} onChange={onChange} />;
    case "shortcut_table":
      return <ShortcutTableEditor block={block} onChange={onChange} />;
    case "divider":
      return <DividerEditor />;
    default:
      return <p className="text-xs text-gray-400 italic">Unknown block type: {block.block_type}</p>;
  }
}

/* ================================================================== */
/*  Live preview renderers                                             */
/* ================================================================== */

function PreviewBlock({ block }: { block: Block }) {
  const cj = block.content_json || {};

  switch (block.block_type) {
    case "heading": {
      const Tag = (cj.level || 2) === 2 ? "h2" : "h3";
      const cls = cj.level === 3
        ? "text-lg font-semibold text-gray-800 mt-6 mb-2"
        : "text-2xl font-bold tracking-tight text-gray-900 mt-8 mb-3";
      return <Tag className={cls}>{cj.text || "Untitled"}</Tag>;
    }
    case "paragraph":
      return <p className="text-sm leading-relaxed text-gray-600 mb-3">{cj.text || ""}</p>;
    case "screenshot": {
      const src = cj.image_path;
      if (!src) {
        return (
          <div className="my-4 flex aspect-[16/9] w-full items-center justify-center rounded-xl border-2 border-dashed border-gray-200 bg-gray-50/60">
            <span className="text-xs text-gray-300">No image</span>
          </div>
        );
      }
      return (
        <div className="my-4">
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-gray-50 shadow-sm">
            <img src={src} alt={cj.caption || "Screenshot"} className="w-full" />
          </div>
          {cj.caption && <p className="mt-1.5 text-center text-[11px] italic text-gray-400">{cj.caption}</p>}
        </div>
      );
    }
    case "tip":
      return (
        <div className="my-3 rounded-lg border border-blue-200 bg-blue-50 p-3">
          <div className="flex gap-2">
            <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            <div>
              <span className="text-xs font-semibold text-blue-700">Tip: </span>
              <span className="text-xs text-blue-700">{cj.text || ""}</span>
            </div>
          </div>
        </div>
      );
    case "warning":
      return (
        <div className="my-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <div className="flex gap-2">
            <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            <div>
              <span className="text-xs font-semibold text-amber-700">Warning: </span>
              <span className="text-xs text-amber-700">{cj.text || ""}</span>
            </div>
          </div>
        </div>
      );
    case "steps": {
      const steps: string[] = cj.steps || [];
      return (
        <ol className="my-3 space-y-1.5 pl-1">
          {steps.map((s: string, i: number) => (
            <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
              <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-purple-100 text-[10px] font-bold text-purple-700">{i + 1}</span>
              <span className="leading-relaxed">{s}</span>
            </li>
          ))}
        </ol>
      );
    }
    case "shortcut_table": {
      const rows: { key: string; action: string }[] = cj.rows || [];
      if (rows.length === 0) return null;
      return (
        <div className="my-3 overflow-hidden rounded-lg border border-gray-200">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-3 py-2 text-left font-semibold text-gray-600">Shortcut</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-600">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r: { key: string; action: string }, i: number) => (
                <tr key={i} className="border-t border-gray-100">
                  <td className="px-3 py-1.5"><code className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[11px] text-gray-700">{r.key}</code></td>
                  <td className="px-3 py-1.5 text-gray-600">{r.action}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    case "divider":
      return <hr className="my-6 border-gray-200" />;
    default:
      return null;
  }
}

/* ================================================================== */
/*  Spinner                                                            */
/* ================================================================== */

function Spinner({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

/* ================================================================== */
/*  Main page component                                                */
/* ================================================================== */

export default function GuideEditorPage() {
  /* ---- state ---- */
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [editingSectionTitle, setEditingSectionTitle] = useState<string | null>(null);
  const [sectionTitleDraft, setSectionTitleDraft] = useState("");
  const [addBlockOpen, setAddBlockOpen] = useState<string | null>(null);
  const [newSectionTitle, setNewSectionTitle] = useState("");
  const [addingSectionOpen, setAddingSectionOpen] = useState(false);
  const [savedIndicator, setSavedIndicator] = useState<string | null>(null);
  const [exporting, setExporting] = useState<"pdf" | "docx" | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{ type: "section" | "block"; sectionId: string; blockId?: string } | null>(null);

  /* local block content state for editing before blur-save */
  const [localBlockContent, setLocalBlockContent] = useState<Record<string, Record<string, any>>>({});

  const saveTimerRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  /* ---- load data ---- */
  const loadSections = useCallback(async () => {
    try {
      const { data } = await api.get("/guide/admin");
      const sorted = (data.sections || []).sort((a: Section, b: Section) => a.order_index - b.order_index);
      sorted.forEach((s: Section) => {
        s.blocks = (s.blocks || []).sort((a: Block, b: Block) => a.order_index - b.order_index);
      });
      setSections(sorted);

      /* initialize local block content */
      const lbc: Record<string, Record<string, any>> = {};
      sorted.forEach((s: Section) => {
        s.blocks.forEach((b: Block) => {
          lbc[b.id] = b.content_json || {};
        });
      });
      setLocalBlockContent(lbc);
    } catch (err) {
      console.error("Failed to load guide sections:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSections();
  }, [loadSections]);

  /* ---- flash saved indicator ---- */
  function flashSaved(id: string) {
    setSavedIndicator(id);
    setTimeout(() => setSavedIndicator((prev) => (prev === id ? null : prev)), 1500);
  }

  /* ---- section CRUD ---- */
  async function createSection() {
    if (!newSectionTitle.trim()) return;
    try {
      await api.post("/guide/sections", { title: newSectionTitle.trim() });
      setNewSectionTitle("");
      setAddingSectionOpen(false);
      await loadSections();
    } catch (err) {
      console.error("Failed to create section:", err);
    }
  }

  async function updateSectionTitle(sectionId: string, title: string) {
    try {
      await api.put(`/guide/sections/${sectionId}`, { title });
      setSections((prev) => prev.map((s) => (s.id === sectionId ? { ...s, title } : s)));
      flashSaved(`section-title-${sectionId}`);
    } catch (err) {
      console.error("Failed to update section title:", err);
    }
  }

  async function toggleSectionVisibility(sectionId: string) {
    const section = sections.find((s) => s.id === sectionId);
    if (!section) return;
    try {
      await api.put(`/guide/sections/${sectionId}`, { is_visible: !section.is_visible });
      setSections((prev) => prev.map((s) => (s.id === sectionId ? { ...s, is_visible: !s.is_visible } : s)));
      flashSaved(`section-vis-${sectionId}`);
    } catch (err) {
      console.error("Failed to toggle section visibility:", err);
    }
  }

  async function deleteSection(sectionId: string) {
    try {
      await api.delete(`/guide/sections/${sectionId}`);
      setSections((prev) => prev.filter((s) => s.id !== sectionId));
      setConfirmDelete(null);
    } catch (err) {
      console.error("Failed to delete section:", err);
    }
  }

  async function moveSectionUp(index: number) {
    if (index <= 0) return;
    const ids = sections.map((s) => s.id);
    [ids[index - 1], ids[index]] = [ids[index], ids[index - 1]];
    try {
      await api.post("/guide/sections/reorder", { ids });
      await loadSections();
    } catch (err) {
      console.error("Failed to reorder sections:", err);
    }
  }

  async function moveSectionDown(index: number) {
    if (index >= sections.length - 1) return;
    const ids = sections.map((s) => s.id);
    [ids[index], ids[index + 1]] = [ids[index + 1], ids[index]];
    try {
      await api.post("/guide/sections/reorder", { ids });
      await loadSections();
    } catch (err) {
      console.error("Failed to reorder sections:", err);
    }
  }

  /* ---- block CRUD ---- */
  async function addBlock(sectionId: string, blockType: BlockType) {
    try {
      const defaultContent: Record<string, any> = {};
      if (blockType === "heading") Object.assign(defaultContent, { text: "", level: 2 });
      else if (blockType === "paragraph") Object.assign(defaultContent, { text: "" });
      else if (blockType === "screenshot") Object.assign(defaultContent, { image_path: "", caption: "" });
      else if (blockType === "tip" || blockType === "warning") Object.assign(defaultContent, { text: "" });
      else if (blockType === "steps") Object.assign(defaultContent, { steps: [""] });
      else if (blockType === "shortcut_table") Object.assign(defaultContent, { rows: [{ key: "", action: "" }] });

      await api.post(`/guide/sections/${sectionId}/blocks`, {
        block_type: blockType,
        content_json: defaultContent,
      });
      await loadSections();

      /* auto-expand */
      setExpandedSections((prev) => new Set(prev).add(sectionId));
    } catch (err) {
      console.error("Failed to add block:", err);
    }
  }

  function handleBlockContentChange(blockId: string, contentJson: Record<string, any>) {
    setLocalBlockContent((prev) => ({ ...prev, [blockId]: contentJson }));

    /* also update the in-memory sections for preview */
    setSections((prev) =>
      prev.map((s) => ({
        ...s,
        blocks: s.blocks.map((b) => (b.id === blockId ? { ...b, content_json: contentJson } : b)),
      }))
    );
  }

  function scheduleBlockSave(sectionId: string, blockId: string, contentJson: Record<string, any>) {
    /* debounced save on blur */
    if (saveTimerRef.current[blockId]) clearTimeout(saveTimerRef.current[blockId]);
    saveTimerRef.current[blockId] = setTimeout(async () => {
      try {
        await api.put(`/guide/sections/${sectionId}/blocks/${blockId}`, { content_json: contentJson });
        flashSaved(`block-${blockId}`);
      } catch (err) {
        console.error("Failed to save block:", err);
      }
    }, 500);
  }

  async function toggleBlockVisibility(sectionId: string, blockId: string) {
    const section = sections.find((s) => s.id === sectionId);
    const block = section?.blocks.find((b) => b.id === blockId);
    if (!block) return;
    try {
      await api.put(`/guide/sections/${sectionId}/blocks/${blockId}`, { is_visible: !block.is_visible });
      setSections((prev) =>
        prev.map((s) => ({
          ...s,
          blocks: s.blocks.map((b) => (b.id === blockId ? { ...b, is_visible: !b.is_visible } : b)),
        }))
      );
      flashSaved(`block-vis-${blockId}`);
    } catch (err) {
      console.error("Failed to toggle block visibility:", err);
    }
  }

  async function deleteBlock(sectionId: string, blockId: string) {
    try {
      await api.delete(`/guide/sections/${sectionId}/blocks/${blockId}`);
      setSections((prev) =>
        prev.map((s) => ({
          ...s,
          blocks: s.blocks.filter((b) => b.id !== blockId),
        }))
      );
      setConfirmDelete(null);
    } catch (err) {
      console.error("Failed to delete block:", err);
    }
  }

  async function moveBlockUp(sectionId: string, blockIndex: number) {
    const section = sections.find((s) => s.id === sectionId);
    if (!section || blockIndex <= 0) return;
    const ids = section.blocks.map((b) => b.id);
    [ids[blockIndex - 1], ids[blockIndex]] = [ids[blockIndex], ids[blockIndex - 1]];
    try {
      await api.post(`/guide/sections/${sectionId}/blocks/reorder`, { ids });
      await loadSections();
    } catch (err) {
      console.error("Failed to reorder blocks:", err);
    }
  }

  async function moveBlockDown(sectionId: string, blockIndex: number) {
    const section = sections.find((s) => s.id === sectionId);
    if (!section || blockIndex >= section.blocks.length - 1) return;
    const ids = section.blocks.map((b) => b.id);
    [ids[blockIndex], ids[blockIndex + 1]] = [ids[blockIndex + 1], ids[blockIndex]];
    try {
      await api.post(`/guide/sections/${sectionId}/blocks/reorder`, { ids });
      await loadSections();
    } catch (err) {
      console.error("Failed to reorder blocks:", err);
    }
  }

  /* ---- export ---- */
  async function exportGuide(format: "pdf" | "docx") {
    setExporting(format);
    try {
      const response = await api.post(`/guide/export/${format}`, {}, { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = `User_Guide_Slides_Generator.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export failed:", err);
    } finally {
      setExporting(null);
    }
  }

  /* ---- seed ---- */
  async function seedDefaults() {
    setSeeding(true);
    try {
      await api.post("/guide/seed");
      await loadSections();
    } catch (err) {
      console.error("Seed failed:", err);
    } finally {
      setSeeding(false);
    }
  }

  /* ---- toggle expand ---- */
  function toggleExpand(sectionId: string) {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  }

  /* ================================================================ */
  /*  RENDER                                                           */
  /* ================================================================ */

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Spinner className="h-6 w-6 text-gray-400" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      {/* ---- page header ---- */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-gray-900">User Guide Editor</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage the content of the user guide. Changes are saved automatically.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => window.open("/guide", "_blank")}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 shadow-sm transition hover:bg-gray-50"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            Preview
          </button>
          <button
            onClick={() => exportGuide("pdf")}
            disabled={exporting !== null}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:opacity-50"
          >
            {exporting === "pdf" ? <Spinner className="h-3.5 w-3.5" /> : (
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3M3 17v3a2 2 0 002 2h14a2 2 0 002-2v-3" />
              </svg>
            )}
            Export PDF
          </button>
          <button
            onClick={() => exportGuide("docx")}
            disabled={exporting !== null}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:opacity-50"
          >
            {exporting === "docx" ? <Spinner className="h-3.5 w-3.5" /> : (
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3M3 17v3a2 2 0 002 2h14a2 2 0 002-2v-3" />
              </svg>
            )}
            Export Word
          </button>
          {sections.length === 0 && (
            <button
              onClick={seedDefaults}
              disabled={seeding}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#00338D] px-3 py-2 text-xs font-medium text-white shadow-sm transition hover:bg-[#00338D]/90 disabled:opacity-50"
            >
              {seeding ? <Spinner className="h-3.5 w-3.5" /> : (
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              )}
              Seed Defaults
            </button>
          )}
        </div>
      </div>

      {/* ---- two-column layout ---- */}
      <div className="flex gap-6">
        {/* ======== LEFT COLUMN: Section list + block editor (60%) ======== */}
        <div className="w-[60%] min-w-0 space-y-3">
          {sections.map((section, sIdx) => {
            const isExpanded = expandedSections.has(section.id);
            const isEditingTitle = editingSectionTitle === section.id;

            return (
              <div
                key={section.id}
                className={`rounded-xl border bg-white shadow-sm transition ${
                  section.is_visible ? "border-gray-200" : "border-dashed border-gray-300 bg-gray-50/50"
                }`}
              >
                {/* ---- section header ---- */}
                <div className="flex items-center gap-2 px-4 py-3">
                  {/* expand / collapse */}
                  <button onClick={() => toggleExpand(section.id)} className="rounded p-0.5 text-gray-400 hover:text-gray-700 transition">
                    <svg className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>

                  {/* title */}
                  <div className="min-w-0 flex-1">
                    {isEditingTitle ? (
                      <input
                        autoFocus
                        value={sectionTitleDraft}
                        onChange={(e) => setSectionTitleDraft(e.target.value)}
                        onBlur={() => {
                          if (sectionTitleDraft.trim() && sectionTitleDraft.trim() !== section.title) {
                            updateSectionTitle(section.id, sectionTitleDraft.trim());
                          }
                          setEditingSectionTitle(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                          if (e.key === "Escape") setEditingSectionTitle(null);
                        }}
                        className="w-full rounded border border-blue-300 px-2 py-0.5 text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-200"
                      />
                    ) : (
                      <span
                        className="cursor-pointer text-sm font-semibold text-gray-900 hover:text-blue-700 transition"
                        onDoubleClick={() => {
                          setEditingSectionTitle(section.id);
                          setSectionTitleDraft(section.title);
                        }}
                        title="Double-click to edit"
                      >
                        {section.title}
                      </span>
                    )}
                  </div>

                  <SavedFlash show={savedIndicator === `section-title-${section.id}` || savedIndicator === `section-vis-${section.id}`} />

                  {/* block count badge */}
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">
                    {section.blocks.length} block{section.blocks.length !== 1 ? "s" : ""}
                  </span>
                  {!section.is_visible && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">Hidden</span>
                  )}

                  {/* move up/down */}
                  <button
                    onClick={() => moveSectionUp(sIdx)}
                    disabled={sIdx === 0}
                    className="rounded p-1 text-gray-300 hover:text-gray-600 disabled:opacity-30 transition"
                    title="Move up"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                    </svg>
                  </button>
                  <button
                    onClick={() => moveSectionDown(sIdx)}
                    disabled={sIdx === sections.length - 1}
                    className="rounded p-1 text-gray-300 hover:text-gray-600 disabled:opacity-30 transition"
                    title="Move down"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {/* save section button */}
                  <button
                    onClick={async () => {
                      let saved = 0;
                      for (const b of section.blocks) {
                        const content = localBlockContent[b.id] || b.content_json;
                        try {
                          await api.put(`/guide/sections/${section.id}/blocks/${b.id}`, { content_json: content });
                          saved++;
                        } catch {}
                      }
                      flashSaved(`section-save-${section.id}`);
                    }}
                    className="rounded p-1 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 transition"
                    title="Save all blocks in this section"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </button>
                  {savedIndicator === `section-save-${section.id}` && (
                    <span className="text-[10px] font-medium text-emerald-500 animate-fade-in">Saved</span>
                  )}

                  {/* visibility toggle */}
                  <button
                    onClick={() => toggleSectionVisibility(section.id)}
                    className={`rounded p-1 transition ${section.is_visible ? "text-gray-400 hover:text-gray-600" : "text-gray-300 hover:text-gray-500"}`}
                    title={section.is_visible ? "Hide section" : "Show section"}
                  >
                    {section.is_visible ? (
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    ) : (
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    )}
                  </button>

                  {/* delete */}
                  <button
                    onClick={() => setConfirmDelete({ type: "section", sectionId: section.id })}
                    className="rounded p-1 text-gray-300 hover:bg-red-50 hover:text-red-500 transition"
                    title="Delete section"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>

                {/* ---- section blocks (expanded) ---- */}
                {isExpanded && (
                  <div className="border-t border-gray-100 px-4 py-3 space-y-2.5">
                    {section.blocks.map((block, bIdx) => (
                      <div
                        key={block.id}
                        className={`relative rounded-lg border-l-[3px] bg-white pl-3 pr-2 py-2.5 ${
                          BLOCK_BORDER_COLORS[block.block_type] || "border-gray-200"
                        } ${!block.is_visible ? "opacity-50" : ""}`}
                      >
                        {/* block toolbar row */}
                        <div className="mb-2 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500">
                              {block.block_type}
                            </span>
                            <SavedFlash show={savedIndicator === `block-${block.id}` || savedIndicator === `block-vis-${block.id}`} />
                          </div>
                          <div className="flex items-center gap-1">
                            {/* move up/down */}
                            <button
                              onClick={() => moveBlockUp(section.id, bIdx)}
                              disabled={bIdx === 0}
                              className="rounded p-0.5 text-gray-300 hover:text-gray-600 disabled:opacity-30 transition"
                              title="Move up"
                            >
                              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                              </svg>
                            </button>
                            <button
                              onClick={() => moveBlockDown(section.id, bIdx)}
                              disabled={bIdx === section.blocks.length - 1}
                              className="rounded p-0.5 text-gray-300 hover:text-gray-600 disabled:opacity-30 transition"
                              title="Move down"
                            >
                              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                              </svg>
                            </button>

                            {/* visibility */}
                            <button
                              onClick={() => toggleBlockVisibility(section.id, block.id)}
                              className={`rounded p-0.5 transition ${block.is_visible ? "text-gray-300 hover:text-gray-600" : "text-gray-300 hover:text-gray-500"}`}
                              title={block.is_visible ? "Hide block" : "Show block"}
                            >
                              {block.is_visible ? (
                                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                              ) : (
                                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                                </svg>
                              )}
                            </button>

                            {/* delete */}
                            <button
                              onClick={() => setConfirmDelete({ type: "block", sectionId: section.id, blockId: block.id })}
                              className="rounded p-0.5 text-gray-300 hover:bg-red-50 hover:text-red-500 transition"
                              title="Delete block"
                            >
                              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </div>

                        {/* block content editor */}
                        <div
                          onBlur={() => {
                            const content = localBlockContent[block.id] || block.content_json;
                            scheduleBlockSave(section.id, block.id, content);
                          }}
                        >
                          <BlockEditor
                            block={{ ...block, content_json: localBlockContent[block.id] || block.content_json }}
                            onChange={(cj) => handleBlockContentChange(block.id, cj)}
                            onSave={(cj) => { handleBlockContentChange(block.id, cj); scheduleBlockSave(section.id, block.id, cj); }}
                            sectionId={section.id}
                          />
                        </div>
                      </div>
                    ))}

                    {/* add block button */}
                    <div className="relative">
                      <button
                        onClick={() => setAddBlockOpen(addBlockOpen === section.id ? null : section.id)}
                        className="flex w-full items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-gray-200 py-2.5 text-xs font-medium text-gray-400 transition hover:border-blue-300 hover:text-blue-600"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                        </svg>
                        Add Block
                      </button>
                      {addBlockOpen === section.id && (
                        <BlockTypeSelector
                          onSelect={(type) => addBlock(section.id, type)}
                          onClose={() => setAddBlockOpen(null)}
                        />
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* ---- add section card ---- */}
          <div className="rounded-xl border-2 border-dashed border-gray-200 bg-white/50 transition hover:border-blue-300">
            {addingSectionOpen ? (
              <div className="flex items-center gap-2 px-4 py-3">
                <input
                  autoFocus
                  value={newSectionTitle}
                  onChange={(e) => setNewSectionTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") createSection();
                    if (e.key === "Escape") { setAddingSectionOpen(false); setNewSectionTitle(""); }
                  }}
                  placeholder="Section title..."
                  className="min-w-0 flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
                <button
                  onClick={createSection}
                  className="rounded-lg bg-[#00338D] px-3 py-1.5 text-xs font-medium text-white transition hover:bg-[#00338D]/90"
                >
                  Add
                </button>
                <button
                  onClick={() => { setAddingSectionOpen(false); setNewSectionTitle(""); }}
                  className="rounded-lg px-2 py-1.5 text-xs text-gray-500 hover:bg-gray-100 transition"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setAddingSectionOpen(true)}
                className="flex w-full items-center justify-center gap-2 px-4 py-4 text-sm font-medium text-gray-400 hover:text-blue-600 transition"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Add Section
              </button>
            )}
          </div>
        </div>

        {/* ======== RIGHT COLUMN: Live preview (40%) ======== */}
        <div className="w-[40%] min-w-0">
          <div className="sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-100 px-5 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Live Preview</p>
            </div>
            <div className="px-5 py-4">
              {sections.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <svg className="mb-3 h-10 w-10 text-gray-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                  <p className="text-sm text-gray-400">No sections yet.</p>
                  <p className="text-xs text-gray-300">Add a section or seed defaults to get started.</p>
                </div>
              ) : (
                sections.map((section) => (
                  <div
                    key={section.id}
                    className={`mb-6 ${!section.is_visible ? "opacity-40" : ""}`}
                  >
                    {section.blocks
                      .filter((b) => b.is_visible || !section.is_visible)
                      .map((block) => (
                        <div key={block.id} className={!block.is_visible ? "opacity-40" : ""}>
                          <PreviewBlock block={{ ...block, content_json: localBlockContent[block.id] || block.content_json }} />
                        </div>
                      ))}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ---- delete confirmation modal ---- */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-sm font-semibold text-gray-900">
              Delete {confirmDelete.type === "section" ? "Section" : "Block"}?
            </h3>
            <p className="mt-2 text-xs text-gray-500">
              {confirmDelete.type === "section"
                ? "This will permanently delete the section and all its blocks. This action cannot be undone."
                : "This will permanently delete this block. This action cannot be undone."}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setConfirmDelete(null)}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 transition"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (confirmDelete.type === "section") {
                    deleteSection(confirmDelete.sectionId);
                  } else if (confirmDelete.blockId) {
                    deleteBlock(confirmDelete.sectionId, confirmDelete.blockId);
                  }
                }}
                className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
