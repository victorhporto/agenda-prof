"use client";

import { useEffect } from "react";

export function ScrollToActivePackage({
  activeId,
}: {
  activeId: string | null;
}) {
  useEffect(() => {
    if (!activeId) return;
    const el = document.getElementById(`pacote-${activeId}`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [activeId]);

  return null;
}
