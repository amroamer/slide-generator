import { textAlign, fontClass } from "@/lib/rtl-utils";

interface Props { content: any; primary: string; accent: string; config: any; isRTL?: boolean }

export function TitleSlide({ content, primary, accent, isRTL = false }: Props) {
  const title = content?.title || "";
  const subtitle = (content?.body?.content || [])[0] || "";
  return (
    <div className={`flex h-full flex-col items-center justify-center px-[10%] py-[8%] ${fontClass(isRTL)}`} style={{ background: primary }}>
      <h1 className={`text-center text-[22px] font-bold leading-snug text-white line-clamp-3 ${fontClass(isRTL)}`}>{title}</h1>
      {subtitle && <p className={`mt-3 text-center text-[12px] leading-relaxed text-white/70 line-clamp-2 ${fontClass(isRTL)}`}>{subtitle}</p>}
      <div className="mt-4 h-[2px] w-[80px]" style={{ background: accent }} />
    </div>
  );
}
