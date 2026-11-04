"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Re-renders the server page every few seconds while background preparation is running. */
export function KnowledgeAutoRefresh({ active, intervalMs = 2_500 }: { active: boolean; intervalMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(timer);
  }, [active, intervalMs, router]);
  return null;
}
