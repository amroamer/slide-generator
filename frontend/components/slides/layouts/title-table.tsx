import { textAlign, borderSide, fontClass, renderMd } from "@/lib/rtl-utils";

interface Props { content: any; primary: string; accent: string; config: any; isRTL?: boolean }

const STATUS_COLORS: Record<string, string> = {
  green: "#10B981", met: "#10B981", pass: "#10B981", "on track": "#10B981", yes: "#10B981",
  amber: "#F59E0B", yellow: "#F59E0B", "at risk": "#F59E0B", warning: "#F59E0B", partial: "#F59E0B",
  red: "#EF4444", fail: "#EF4444", "not met": "#EF4444", critical: "#EF4444", "off track": "#EF4444",
};

function getStatusColor(val: string): string | null {
  const norm = val.toLowerCase().trim();
  for (const [key, color] of Object.entries(STATUS_COLORS)) {
    if (norm.includes(key)) return color;
  }
  return null;
}

export function TitleTable({ content, primary, accent, isRTL = false }: Props) {
  const title = content?.title || "";
  const table = content?.data_table;
  const bullets: string[] = (content?.body?.content || []).slice(0, 6);
  const kt = content?.key_takeaway;

  if (!table?.headers?.length) {
    return (
      <div className={`flex h-full flex-col overflow-hidden p-[6%] pb-[8%] ${fontClass(isRTL)}`}>
        <div className="h-[3px] w-full shrink-0" style={{ background: primary }} />
        <h2 className={`mt-3 shrink-0 text-[16px] font-bold leading-snug line-clamp-2 ${textAlign(isRTL)}`} style={{ color: primary }}>{title}</h2>
        <ul className="mt-4 flex-1 space-y-2 overflow-hidden">
          {bullets.map((b, i) => (
            <li key={i} className="flex items-start gap-2 text-[11px] leading-relaxed text-gray-700">
              <span className="mt-[5px] h-[5px] w-[5px] shrink-0 rounded-full" style={{ background: accent }} />
              <span className={`line-clamp-2 ${textAlign(isRTL)} ${fontClass(isRTL)}`}>{renderMd(b)}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  const headers = table.headers as string[];
  const rows = (table.rows || []).slice(0, 9) as any[][];
  const manyColumns = headers.length > 5;
  const cellPad = manyColumns ? "px-1.5 py-1" : "px-2 py-1.5";
  const fontSize = manyColumns ? "text-[8px]" : "text-[9px]";

  return (
    <div className={`flex h-full flex-col overflow-hidden p-[6%] pb-[8%] ${fontClass(isRTL)}`}>
      <div className="h-[3px] w-full shrink-0" style={{ background: primary }} />
      <h2 className={`mt-3 shrink-0 text-[16px] font-bold leading-snug line-clamp-2 ${textAlign(isRTL)}`} style={{ color: primary }}>{title}</h2>

      <div className="mt-3 flex-1 overflow-hidden rounded" dir={isRTL ? "rtl" : "ltr"}>
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {headers.map((h, i) => (
                <th key={i} className={`${cellPad} ${textAlign(isRTL)} ${fontSize} font-semibold uppercase tracking-wide text-white ${fontClass(isRTL)}`} style={{ background: primary }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri} className={ri % 2 === 1 ? "bg-gray-50/60" : ""}>
                {row.map((cell: any, ci: number) => {
                  const val = String(cell ?? "");
                  const statusColor = getStatusColor(val);
                  const isFirstCol = ci === 0;
                  const isNumeric = !isFirstCol && /^[\d$%,.\-+\s]+$/.test(val.trim());
                  return (
                    <td key={ci} dir={isNumeric ? "ltr" : undefined}
                      className={`${cellPad} ${fontSize} border-b border-gray-100 ${isFirstCol ? `font-medium text-gray-900 ${textAlign(isRTL)}` : "text-gray-600"} ${isNumeric ? "text-left tabular-nums" : textAlign(isRTL)} ${fontClass(isRTL)}`}>
                      {statusColor ? (
                        <span className="inline-flex items-center gap-1">
                          <span className="inline-block h-[7px] w-[7px] rounded-full" style={{ background: statusColor }} />
                          <span>{val}</span>
                        </span>
                      ) : val}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {kt && (
        <div className={`mt-2 shrink-0 rounded bg-gray-50/60 py-1 text-[8px] font-semibold leading-snug ${borderSide(isRTL)} ${textAlign(isRTL)}`} style={{ borderColor: accent, color: primary }}>
          <span className="line-clamp-1">{renderMd(kt)}</span>
        </div>
      )}
    </div>
  );
}
