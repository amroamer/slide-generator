import { textAlign, flexDir, fontClass, renderMd } from "@/lib/rtl-utils";

interface Props { content: any; primary: string; accent: string; config: any; isRTL?: boolean }

export function KeyTakeaway({ content, primary, accent, isRTL = false }: Props) {
  const title = content?.title || "";
  const kt = content?.key_takeaway || "";
  const bullets: string[] = (content?.body?.content || []).slice(0, 5);
  return (
    <div className={`flex h-full flex-col overflow-hidden p-[6%] pb-[8%] ${fontClass(isRTL)}`}>
      <div className="h-[3px] w-full shrink-0" style={{ background: primary }} />
      <h2 className={`mt-3 shrink-0 text-[16px] font-bold leading-snug line-clamp-2 ${textAlign(isRTL)}`} style={{ color: primary }}>{title}</h2>
      {kt && (
        <div className={`mt-3 shrink-0 rounded-md p-3 ${isRTL ? "border-r-[3px] border-l-0" : "border-l-[3px] border-r-0"} ${textAlign(isRTL)}`} style={{ borderColor: accent, background: `${accent}10` }}>
          <p className={`text-[13px] font-semibold leading-snug line-clamp-3 ${fontClass(isRTL)}`} style={{ color: primary }}>{renderMd(kt)}</p>
        </div>
      )}
      <ul className="mt-3 flex-1 space-y-1.5 overflow-hidden">
        {bullets.map((b, i) => (
          <li key={i} className={`flex items-start gap-1.5 text-[10px] leading-relaxed text-gray-600 ${flexDir(isRTL)}`}>
            <span className="mt-[4px] h-[4px] w-[4px] shrink-0 rounded-full" style={{ background: accent }} />
            <span className={`line-clamp-2 ${textAlign(isRTL)} ${fontClass(isRTL)}`}>{renderMd(b)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
