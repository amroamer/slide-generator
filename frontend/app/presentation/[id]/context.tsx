"use client";

import { createContext, useContext } from "react";

interface Presentation {
  id: string;
  title: string;
  status: string;
  current_step: number;
  llm_provider: string | null;
  llm_model: string | null;
  language: string;
  audience: string | null;
  tone: string | null;
  slide_count: number;
}

interface PresentationCtx {
  pres: Presentation | null;
  reload: () => Promise<void>;
}

export const PresentationContext = createContext<PresentationCtx>({
  pres: null,
  reload: async () => {},
});

export function usePresentation() {
  return useContext(PresentationContext);
}
