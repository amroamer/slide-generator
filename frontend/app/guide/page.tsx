"use client";

import { useLanguage } from "@/lib/language-context";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

interface Block {
  id: string;
  block_type: string;
  content_json: Record<string, any>;
  is_visible: boolean;
}

interface Section {
  id: string;
  title: string;
  slug: string;
  is_visible: boolean;
  blocks: Block[];
}

export default function GuidePage() {
  const { t, isRTL } = useLanguage();
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSlug, setActiveSlug] = useState("");
  const [exporting, setExporting] = useState<string | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    fetch("/slide-generator/api/guide")
      .then((r) => r.json())
      .then((data) => setSections(data.sections || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Intersection observer for TOC highlighting
  useEffect(() => {
    if (sections.length === 0) return;
    observerRef.current?.disconnect();
    observerRef.current = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSlug(entry.target.id);
            break;
          }
        }
      },
      { rootMargin: "-80px 0px -60% 0px", threshold: 0.1 }
    );
    sections.forEach((s) => {
      const el = document.getElementById(s.slug);
      if (el) observerRef.current!.observe(el);
    });
    return () => observerRef.current?.disconnect();
  }, [sections]);

  async function exportGuide(format: "pdf" | "docx") {
    setExporting(format);
    try {
      const r = await fetch(`/slide-generator/api/guide/export/${format}`, { method: "POST" });
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `User_Guide_Slides_Generator.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
    } finally {
      setExporting(null);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-gray-200 border-t-[#00338D]" />
      </div>
    );
  }

  if (sections.length === 0) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <p className="text-lg font-medium text-gray-600">{t("guideEmpty")}</p>
        <p className="text-sm text-gray-400">{t("guideEmptyDesc")}</p>
        <Link href="/dashboard" className="btn-secondary">{t("backToDashboard")}</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-gray-200 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="text-sm text-gray-400 hover:text-gray-600">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
            </Link>
            <h1 className="text-base font-bold text-gray-900">{t("slidesGenerator")} {t("byKPMG")}</h1>
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-500">{t("guideTitle")}</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => exportGuide("pdf")} disabled={!!exporting}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition">
              {exporting === "pdf" ? <Spinner /> : <DownIcon />} PDF
            </button>
            <button onClick={() => exportGuide("docx")} disabled={!!exporting}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition">
              {exporting === "docx" ? <Spinner /> : <DocIcon />} Word
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl gap-10 px-6 py-8">
        {/* TOC sidebar */}
        <nav className="hidden w-[200px] shrink-0 lg:block">
          <div className="sticky top-20 space-y-0.5">
            <p className="mb-3 text-[9px] font-semibold uppercase tracking-wider text-gray-400">{t("contents")}</p>
            {sections.map((s) => (
              <a key={s.id} href={`#${s.slug}`}
                className={`block rounded-md px-2.5 py-1.5 text-[12px] transition-colors ${
                  activeSlug === s.slug ? "bg-blue-50 font-medium text-blue-700" : "text-gray-500 hover:text-gray-700"
                }`}>
                {s.title}
              </a>
            ))}
          </div>
        </nav>

        {/* Main content */}
        <main className="min-w-0 flex-1 max-w-4xl">
          {sections.map((section) => (
            <section key={section.id} id={section.slug} className="scroll-mt-20 pb-12">
              <h2 className="text-2xl font-bold tracking-tight text-gray-900">{section.title}</h2>
              <div className="mt-5 space-y-1">
                {section.blocks.map((block) => (
                  <GuideBlock key={block.id} block={block} />
                ))}
              </div>
            </section>
          ))}
        </main>
      </div>
    </div>
  );
}

/* ── Block renderer ─────────────────────────────────────────── */
function GuideBlock({ block }: { block: Block }) {
  const { t } = useLanguage();
  const c = block.content_json || {};

  switch (block.block_type) {
    case "heading": {
      const lvl = c.level || 2;
      return lvl === 2
        ? <h3 className="mt-8 mb-3 text-lg font-semibold text-gray-800">{c.text}</h3>
        : <h4 className="mt-6 mb-2 text-base font-semibold text-gray-700">{c.text}</h4>;
    }

    case "paragraph":
      return <p className="mb-4 text-sm leading-relaxed text-gray-600">{c.text}</p>;

    case "screenshot":
      return <ScreenshotBlock content={c} />;

    case "tip":
      return (
        <div className="my-4 flex gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4">
          <svg className="h-5 w-5 shrink-0 text-blue-500 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
          <div>
            <p className="text-[11px] font-semibold uppercase text-blue-700 mb-1">{t("tip")}</p>
            <p className="text-sm text-blue-800">{c.text}</p>
          </div>
        </div>
      );

    case "warning":
      return (
        <div className="my-4 flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <svg className="h-5 w-5 shrink-0 text-amber-500 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>
          <div>
            <p className="text-[11px] font-semibold uppercase text-amber-700 mb-1">{t("warning")}</p>
            <p className="text-sm text-amber-800">{c.text}</p>
          </div>
        </div>
      );

    case "steps":
      return (
        <div className="my-4 space-y-2.5">
          {(c.items || []).map((item: string, i: number) => (
            <div key={i} className="flex items-start gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-500 text-[10px] font-bold text-white">{i + 1}</span>
              <p className="pt-0.5 text-sm text-gray-600">{item}</p>
            </div>
          ))}
        </div>
      );

    case "shortcut_table":
      return (
        <div className="my-4 overflow-hidden rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-700">Shortcut</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-700">Action</th>
              </tr>
            </thead>
            <tbody>
              {(c.rows || []).map((row: { key: string; action: string }, i: number) => (
                <tr key={i} className="border-b last:border-0">
                  <td className="px-4 py-2"><code className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs text-gray-700">{row.key}</code></td>
                  <td className="px-4 py-2 text-gray-600">{row.action}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );

    case "divider":
      return <hr className="my-6 border-gray-200" />;

    default:
      return null;
  }
}

/* ── Screenshot with fallback ───────────────────────────────── */
function ScreenshotBlock({ content }: { content: Record<string, any> }) {
  const [error, setError] = useState(false);

  if (!content.image_path || error) {
    return (
      <div className="my-6 flex aspect-[16/9] w-full items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-gray-50/60">
        <div className="flex flex-col items-center gap-2 text-gray-400">
          <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><circle cx="12" cy="13" r="3" /></svg>
          <p className="text-sm">{content.caption || "Screenshot placeholder"}</p>
          <p className="text-[10px]">Upload a screenshot in the Guide Editor</p>
        </div>
      </div>
    );
  }

  return (
    <div className="my-6">
      <div className="relative overflow-hidden rounded-xl border border-gray-200 bg-gray-50 shadow-sm">
        <img src={content.image_path} alt={content.alt || ""} className="w-full" loading="lazy" onError={() => setError(true)} />
        {/* Annotations */}
        {(content.annotations || []).map((ann: { x: number; y: number; number: number; label: string }, i: number) => (
          <div key={i} className="absolute flex h-6 w-6 items-center justify-center rounded-full bg-blue-500 text-[10px] font-bold text-white shadow-lg ring-2 ring-white"
            style={{ left: `${ann.x}%`, top: `${ann.y}%`, transform: "translate(-50%,-50%)" }}
            title={ann.label}>
            {ann.number}
          </div>
        ))}
      </div>
      {content.caption && <p className="mt-2 text-center text-[11px] italic text-gray-400">{content.caption}</p>}
      {content.annotations?.length > 0 && (
        <div className="mt-3 space-y-1">
          {content.annotations.map((ann: { number: number; label: string }, i: number) => (
            <div key={i} className="flex items-start gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-500 text-[9px] font-bold text-white">{ann.number}</span>
              <span className="text-xs text-gray-600">{ann.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Small icons ────────────────────────────────────────────── */
function Spinner() {
  return <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />;
}
function DownIcon() {
  return <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>;
}
function DocIcon() {
  return <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>;
}
