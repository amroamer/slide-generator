/** RTL/LTR utilities for slide rendering. */

export function isRTLLanguage(language: string | null | undefined): boolean {
  return language === "arabic" || language === "bilingual";
}

export function textAlign(isRTL: boolean): string {
  return isRTL ? "text-right" : "text-left";
}

export function flexDir(isRTL: boolean): string {
  return isRTL ? "flex-row-reverse" : "flex-row";
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
