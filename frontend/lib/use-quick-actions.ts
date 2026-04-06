import { useEffect, useState } from "react";
import api from "./api";
import { getIconPath } from "@/app/settings/prompts/icon-registry";

export interface QuickActionConfig {
  name: string;
  label: string;
  icon: string; // SVG path d attribute
  prompt: string;
  is_custom: boolean;
}

// Module-level cache to avoid refetching on every component mount
const cache: Record<string, { data: QuickActionConfig[]; timestamp: number }> = {};
const CACHE_TTL = 60000; // 1 minute

export function useQuickActions(category: string): QuickActionConfig[] {
  const [actions, setActions] = useState<QuickActionConfig[]>(() => {
    const cached = cache[category];
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) return cached.data;
    return [];
  });

  useEffect(() => {
    const cached = cache[category];
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      setActions(cached.data);
      return;
    }

    api.get(`/prompts/quick-actions/${category}`).then(({ data }) => {
      const mapped: QuickActionConfig[] = data.map((a: any) => ({
        name: a.name,
        label: a.label,
        icon: getIconPath(a.icon_name),
        prompt: a.prompt,
        is_custom: a.is_custom,
      }));
      cache[category] = { data: mapped, timestamp: Date.now() };
      setActions(mapped);
    }).catch(() => {
      // Fallback: return empty, the component should have hardcoded fallbacks
    });
  }, [category]);

  return actions;
}
