import { textAlign, flexDir, borderSide, accentBarAlign, fontClass, renderMd } from "@/lib/rtl-utils";

interface Props { content: any; primary: string; accent: string; config: any; isRTL?: boolean }

export function TitleBullets({ content, primary, accent, isRTL = false }: Props) {
  const title = content?.title || "";
  const bullets: string[] = (content?.body?.content || []).slice(0, 7);
  const kt = content?.key_takeaway;
  return (
    <div className={`flex h-full flex-col overflow-hidden p-[6%] pb-[8%] ${fontClass(isRTL)}`}>
      <div className="h-[3px] w-full shrink-0" style={{ background: primary }} />
      <h2 className={`mt-3 shrink-0 text-[16px] font-bold leading-snug line-clamp-2 ${textAlign(isRTL)}`} style={{ color: primary }}>{title}</h2>
      <div className={`mt-1.5 h-[2px] w-[60px] shrink-0 ${accentBarAlign(isRTL)}`} style={{ background: accent }} />
      <ul className="mt-4 flex-1 space-y-2 overflow-hidden">
        {bullets.map((b, i) => (
          <li key={i} className={`flex items-start gap-2 text-[11px] leading-relaxed text-gray-700 ${flexDir(isRTL)}`}>
            <span className="mt-[5px] h-[5px] w-[5px] shrink-0 rounded-full" style={{ background: accent }} />
            <span className={`line-clamp-2 ${textAlign(isRTL)} ${fontClass(isRTL)}`}>{renderMd(b)}</span>
          </li>
        ))}
      </ul>
      {kt && (
        <div className={`mt-2 shrink-0 rounded bg-gray-50/60 py-1.5 text-[9px] font-semibold leading-snug ${borderSide(isRTL)} ${textAlign(isRTL)}`} style={{ borderColor: accent, color: primary }}>
          <span className="line-clamp-2">{renderMd(kt)}</span>
        </div>
      )}
    </div>
  );
}
