"use client";

import { usePresentation } from "./context";
import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";

const STEP_PATHS = ["step1", "step2", "step3", "step4", "step5"];

export default function PresentationIndex() {
  const { id } = useParams();
  const { pres } = usePresentation();
  const router = useRouter();

  useEffect(() => {
    if (pres) {
      const stepPath = STEP_PATHS[pres.current_step - 1] || "step1";
      router.replace(`/presentation/${id}/${stepPath}`);
    }
  }, [pres, id, router]);

  return null;
}
