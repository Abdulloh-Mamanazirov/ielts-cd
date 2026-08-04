import { Suspense } from "react";
import { redirect } from "next/navigation";

import { AuthForm } from "@/components/auth/AuthForm";
import { TelegramSignIn } from "@/components/auth/TelegramSignIn";
import { getSessionUser } from "@/lib/auth/session";

export const metadata = { title: "Sign in" };

export default async function LoginPage() {
  if (await getSessionUser()) redirect("/dashboard");

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-12">
      <h1 className="mb-1 text-2xl font-bold text-ink">Welcome back</h1>
      <p className="mb-6 text-sm text-ink-muted">Sign in to continue your practice.</p>

      <TelegramSignIn label="Continue with Telegram" />

      <div className="my-6 flex items-center gap-3 text-[11px] font-bold tracking-[0.16em] text-ink-faint">
        <span className="h-px flex-1 bg-rule" />
        OR WITH EMAIL
        <span className="h-px flex-1 bg-rule" />
      </div>

      <Suspense>
        <AuthForm mode="login" />
      </Suspense>
    </main>
  );
}
