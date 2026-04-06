"use client";

import { createContext, useCallback, useContext, useState } from "react";
import api from "./api";

export interface StepState {
  status: "not_started" | "completed" | "stale";
  lastModified: string | null;
  staleReason: string | null;
  version?: number;
  slideCount?: number;
  missingSlides?: string[];
  orphanedSlides?: string[];
  lastExported?: string | null;
}

export interface PipelineState {
  currentStep: number;
  steps: {
    input: StepState;
    plan: StepState;
    content: StepState;
    design: StepState;
    export: StepState;
  };
  hasStaleSteps: boolean;
  hasInput: boolean;
  hasPlan: boolean;
  hasContent: boolean;
  hasDesign: boolean;
  hasExport: boolean;
  loaded: boolean;
  refreshPipeline: () => Promise<void>;
}

const DEFAULT_STEP: StepState = { status: "not_started", lastModified: null, staleReason: null };

const PipelineContext = createContext<PipelineState>({
  currentStep: 1,
  steps: { input: DEFAULT_STEP, plan: DEFAULT_STEP, content: DEFAULT_STEP, design: DEFAULT_STEP, export: DEFAULT_STEP },
  hasStaleSteps: false,
  hasInput: false, hasPlan: false, hasContent: false, hasDesign: false, hasExport: false,
  loaded: false,
  refreshPipeline: async () => {},
});

export function usePipeline() {
  return useContext(PipelineContext);
}

function mapStep(raw: any): StepState {
  return {
    status: raw?.status || "not_started",
    lastModified: raw?.last_modified || null,
    staleReason: raw?.stale_reason || null,
    version: raw?.version,
    slideCount: raw?.slide_count,
    missingSlides: raw?.missing_slides,
    orphanedSlides: raw?.orphaned_slides,
    lastExported: raw?.last_exported,
  };
}

export function PipelineProvider({ presentationId, children }: { presentationId: string; children: React.ReactNode }) {
  const [state, setState] = useState<Omit<PipelineState, "refreshPipeline">>({
    currentStep: 1,
    steps: { input: DEFAULT_STEP, plan: DEFAULT_STEP, content: DEFAULT_STEP, design: DEFAULT_STEP, export: DEFAULT_STEP },
    hasStaleSteps: false,
    hasInput: false, hasPlan: false, hasContent: false, hasDesign: false, hasExport: false,
    loaded: false,
  });

  const refreshPipeline = useCallback(async () => {
    try {
      const { data } = await api.get(`/presentations/${presentationId}/pipeline`);
      setState({
        currentStep: data.current_step || 1,
        steps: {
          input: mapStep(data.steps?.input),
          plan: mapStep(data.steps?.plan),
          content: mapStep(data.steps?.content),
          design: mapStep(data.steps?.design),
          export: mapStep(data.steps?.export),
        },
        hasStaleSteps: data.has_stale_steps || false,
        hasInput: data.has_input || false,
        hasPlan: data.has_plan || false,
        hasContent: data.has_content || false,
        hasDesign: data.has_design || false,
        hasExport: data.has_export || false,
        loaded: true,
      });
    } catch {
      setState((prev) => ({ ...prev, loaded: true }));
    }
  }, [presentationId]);

  return (
    <PipelineContext.Provider value={{ ...state, refreshPipeline }}>
      {children}
    </PipelineContext.Provider>
  );
}
