"use client";

import { createContext, useContext, useState } from "react";

interface ActiveSlideCtx {
  activeSlideId: string | null;
  setActiveSlideId: (id: string | null) => void;
}

const Ctx = createContext<ActiveSlideCtx>({ activeSlideId: null, setActiveSlideId: () => {} });

export function ActiveSlideProvider({ children }: { children: React.ReactNode }) {
  const [activeSlideId, setActiveSlideId] = useState<string | null>(null);
  return <Ctx.Provider value={{ activeSlideId, setActiveSlideId }}>{children}</Ctx.Provider>;
}

export function useActiveSlide() {
  return useContext(Ctx);
}
