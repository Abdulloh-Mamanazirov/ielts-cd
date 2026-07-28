"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { cn } from "@/lib/utils";

export function LogoutButton({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const logout = async () => {
    setBusy(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/");
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={logout}
      disabled={busy}
      className={cn(
        "rounded-lg text-xs font-bold text-white/60 transition hover:text-white disabled:opacity-50",
        compact ? "px-3 py-2" : "w-full bg-white/10 px-3.5 py-2.5 hover:bg-white/20",
      )}
    >
      {busy ? "Signing out…" : "Sign out"}
    </button>
  );
}
