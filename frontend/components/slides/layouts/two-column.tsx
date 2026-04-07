import { textAlign, flexDir, borderSide, fontClass, renderMd } from "@/lib/rtl-utils";

interface Props { content: any; primary: string; accent: string; config: any; isRTL?: boolean }

export function TwoColumn({ content, primary, accent, isRTL = false }: Props) {
  const title = content?.title || "";
  const bullets: string[] = content?.body?.content || [];
  const mid = Math.ceil(bullets.length / 2);
  const left = bullets.slice(0, mid).slice(0, 5);
  const right = bullets.slice(mid).slice(0, 5);
  const kt = content?.key_takeaway;
  return (
    <div className={`flex h-full flex-col overflow-hidden p-[6%] pb-[8%] ${fontClass(isRTL)}`}>
      <div className="h-[3px] w-full shrink-0" style={{ background: primary }} />
      <h2 className={`mt-3 shrink-0 text-[16px] font-bold leading-snug line-clamp-2 ${textAlign(isRTL)}`} style={{ color: primary }}>{title}</h2>
      <div className={`mt-3 flex flex-1 gap-4 overflow-hidden ${flexDir(isRTL)}`}>
        <div className="flex-1 space-y-1.5 overflow-hidden">
          {left.map((b, i) => (
            <p key={i} className={`flex items-start gap-1.5 text-[10px] leading-relaxed text-gray-700 ${flexDir(isRTL)}`}>
              <span className="mt-[4px] h-[4px] w-[4px] shrink-0 rounded-full" style={{ background: accent }} />
              <span className={`line-clamp-2 ${textAlign(isRTL)} ${fontClass(isRTL)}`}>{renderMd(b)}</span>
            </p>
          ))}
        </div>
        <div className="w-px shrink-0 bg-gray-200" />
        <div className="flex-1 space-y-1.5 overflow-hidden">
          {right.map((b, i) => (
            <p key={i} className={`flex items-start gap-1.5 text-[10px] leading-relaxed text-gray-700 ${flexDir(isRTL)}`}>
              <span className="mt-[4px] h-[4px] w-[4px] shrink-0 rounded-full" style={{ background: accent }} />
              <span className={`line-clamp-2 ${textAlign(isRTL)} ${fontClass(isRTL)}`}>{renderMd(b)}</span>
            </p>
          ))}
        </div>
      </div>
      {kt && (
        <div className={`mt-2 shrink-0 rounded bg-gray-50/60 py-1 text-[8px] font-semibold leading-snug ${borderSide(isRTL)} ${textAlign(isRTL)}`} style={{ borderColor: accent, color: primary }}>
          <span className="line-clamp-1">{renderMd(kt)}</span>
        </div>
      )}
    </div>
  );
}
