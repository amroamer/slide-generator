"use client";

import { useEffect, useState } from "react";

interface Props {
  agentName: string;
  agentInitials: string;
  messages: string[];
}

export function AgentThinking({ agentName, agentInitials, messages }: Props) {
  const [msgIdx, setMsgIdx] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setMsgIdx((i) => (i + 1) % messages.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [messages.length]);

  return (
    <div className="flex flex-col items-center gap-6 py-16 animate-fade-in">
      {/* Agent avatar with pulse */}
      <div className="relative">
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-[#00338D] to-[#0055B8] text-2xl font-bold text-white shadow-lg">
          {agentInitials}
        </div>
        <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full border-[3px] border-white bg-[#0091DA] animate-pulse" />
      </div>

      <div className="text-center">
        <p className="text-base font-semibold text-gray-900">{agentName}</p>
        <p className="mt-1 text-sm text-gray-400">is working on your presentation</p>
      </div>

      {/* Thinking dots */}
      <div className="flex items-center gap-1.5">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-2 w-2 rounded-full bg-[#0091DA]"
            style={{
              animation: "pulse-dot 1.4s ease-in-out infinite",
              animationDelay: `${i * 0.2}s`,
            }}
          />
        ))}
      </div>

      {/* Cycling status message */}
      <p key={msgIdx} className="text-sm text-gray-500 animate-fade-in">
        {messages[msgIdx]}
      </p>
    </div>
  );
}
