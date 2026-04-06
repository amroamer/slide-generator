import { fontClass } from "@/lib/rtl-utils";

interface Props { content: any; primary: string; accent: string; config: any; isRTL?: boolean }

export function SectionDivider({ content, primary, isRTL = false }: Props) {
  const title = content?.title || "";
  return (
    <div className={`flex h-full items-center justify-center px-[10%] py-[8%] ${fontClass(isRTL)}`} style={{ background: primary }}>
      <h1 className={`text-center text-[24px] font-bold leading-snug text-white line-clamp-3 ${fontClass(isRTL)}`}>{title}</h1>
    </div>
  );
}
