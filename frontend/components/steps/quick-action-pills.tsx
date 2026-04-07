"use client";

import { useLanguage } from "@/lib/language-context";
import { useCallback, useRef, useState } from "react";

export interface QuickAction {
  name: string;
  label: string;
  icon: string; // SVG path d attribute
  prompt: string;
}

interface Props {
  actions: QuickAction[];
  onAction: (actionName: string, prompt: string) => Promise<void>;
  disabled?: boolean;
}

const CHECK_PATH = "M5 13l4 4L19 7";
const ALERT_PATH = "M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z";
const SPINNER_PATH = "M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15";

export function QuickActionPills({ actions, onAction, disabled = false }: Props) {
  const { t, isRTL } = useLanguage();
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [actionStatus, setActionStatus] = useState<Record<string, "success" | "error">>({});
  const [usageCounts, setUsageCounts] = useState<Record<string, number>>({});
  const [inlineMsg, setInlineMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const statusTimer = useRef<ReturnType<typeof setTimeout>>();
  const msgTimer = useRef<ReturnType<typeof setTimeout>>();

  const handleClick = useCallback(async (name: string, prompt: string) => {
    setLoadingAction(name);
    setInlineMsg(null);
    clearTimeout(statusTimer.current);
    clearTimeout(msgTimer.current);

    try {
      await onAction(name, prompt);
      setActionStatus({ [name]: "success" });
      setUsageCounts((prev) => ({ ...prev, [name]: (prev[name] || 0) + 1 }));
      setInlineMsg({ text: t("slideUpdated"), type: "success" });
    } catch {
      setActionStatus({ [name]: "error" });
      setInlineMsg({ text: t("failedToRefine"), type: "error" });
    } finally {
      setLoadingAction(null);
      statusTimer.current = setTimeout(() => setActionStatus({}), 2000);
      msgTimer.current = setTimeout(() => setInlineMsg(null), 2500);
    }
  }, [onAction]);

  const anyLoading = loadingAction !== null;

  return (
    <div>
      <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-gray-400">{t("quickActions")}</p>
      <div className="flex flex-wrap gap-1.5">
        {actions.map((qa) => {
          const isLoading = loadingAction === qa.name;
          const isDisabled = disabled || (anyLoading && !isLoading);
          const status = actionStatus[qa.name];
          const useCount = usageCounts[qa.name] || 0;
          const isUsed = useCount > 0;

          let pillClass: string;
          let iconPath = qa.icon;
          let iconStroke = 1.5;

          if (isLoading) {
            pillClass = "pill-loading border-blue-300 bg-blue-50 text-blue-500";
            iconPath = SPINNER_PATH;
            iconStroke = 2;
          } else if (status === "success") {
            pillClass = "border-emerald-300 bg-emerald-50 text-emerald-700";
            iconPath = CHECK_PATH;
            iconStroke = 2.5;
          } else if (status === "error") {
            pillClass = "border-rose-300 bg-rose-50 text-rose-600";
            iconPath = ALERT_PATH;
            iconStroke = 2;
          } else if (isUsed) {
            pillClass = "border-blue-200/60 bg-blue-50/50 text-blue-700 hover:border-blue-300 hover:bg-blue-50";
          } else {
            pillClass = "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50 hover:text-gray-900";
          }

          return (
            <button
              key={qa.name}
              onClick={() => handleClick(qa.name, qa.prompt)}
              disabled={isDisabled}
              title={isUsed && !status ? `${t("applied")} ${useCount}x — ${t("clickToApplyAgain")}` : undefined}
              className={`relative inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all duration-200 active:scale-[0.97] ${pillClass} disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none`}
            >
              <svg
                className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={iconStroke}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d={iconPath} />
              </svg>
              {qa.label}

              {/* Usage indicator */}
              {isUsed && !status && !isLoading && (
                useCount === 1 ? (
                  <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-blue-500 ring-2 ring-white" />
                ) : (
                  <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-blue-500 px-1 text-[9px] font-bold text-white ring-2 ring-white">
                    {useCount}
                  </span>
                )
              )}
            </button>
          );
        })}
      </div>

      {/* Inline message */}
      {inlineMsg && (
        <p className={`mt-1.5 text-[10px] font-medium animate-fade-in ${
          inlineMsg.type === "success" ? "text-emerald-600" : "text-rose-500"
        }`}>
          {inlineMsg.type === "success" ? "\u2713 " : ""}{inlineMsg.text}
        </p>
      )}
    </div>
  );
}
