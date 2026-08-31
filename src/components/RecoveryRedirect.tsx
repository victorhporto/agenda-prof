"use client";

import { useEffect } from "react";

export function RecoveryRedirect() {
  useEffect(() => {
    const { pathname, search, hash } = window.location;
    if (
      pathname.startsWith("/redefinir-senha") ||
      pathname.startsWith("/auth/callback")
    ) {
      return;
    }

    const hashParams = new URLSearchParams(hash.replace(/^#/, ""));
    if (hashParams.get("type") === "recovery") {
      window.location.replace(`/redefinir-senha${hash}`);
      return;
    }

    const query = new URLSearchParams(search);
    if (!query.get("code")) return;

    const next =
      query.get("type") === "recovery" || query.get("next") === "/redefinir-senha"
        ? "/redefinir-senha"
        : query.get("next");
    const params = new URLSearchParams();
    params.set("code", query.get("code")!);
    params.set("next", next && next.startsWith("/") ? next : "/inicio");
    window.location.replace(`/auth/callback?${params.toString()}`);
  }, []);

  return null;
}
