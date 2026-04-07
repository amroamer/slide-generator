/** RTL/LTR utilities and text rendering helpers for slide rendering. */

import React from "react";

/** Parse **bold** markdown into React elements. */
export function renderMd(text: string): React.ReactNode {
  if (!text || typeof text !== "string" || !text.includes("**")) return text;
  const parts = text.split(/\*\*(.*?)\*\*/g);
  if (parts.length === 1) return text;
  return React.createElement(React.Fragment, null,
    ...parts.map((part, i) =>
      i % 2 === 1
        ? React.createElement("strong", { key: i }, part)
        : part || null
    )
  );
}

export function isRTLLanguage(language: string | null | undefined): boolean {
  return language === "arabic" || language === "bilingual";
}

export function textAlign(isRTL: boolean): string {
  return isRTL ? "text-right" : "text-left";
}

export function flexDir(_isRTL: boolean): string {
  // dir="rtl" on the parent container already reverses flex flow.
  // Adding flex-row-reverse would double-reverse back to LTR.
  return "flex-row";
}

export function borderSide(isRTL: boolean): string {
  return isRTL ? "border-r-2 border-l-0 pr-2.5 pl-0" : "border-l-2 border-r-0 pl-2.5 pr-0";
}

export function accentBarAlign(isRTL: boolean): string {
  return isRTL ? "ml-auto mr-0" : "mr-auto ml-0";
}

export function fontClass(isRTL: boolean): string {
  return isRTL ? "font-arabic" : "";
}

export function slideNumberPos(isRTL: boolean): string {
  return isRTL ? "bottom-[0.5%] left-[2.5%]" : "bottom-[0.5%] right-[2.5%]";
}
