import { Suspense } from "react";
import { redirect } from "next/navigation";

import { AuthForm } from "@/components/auth/AuthForm";
import { TelegramSignIn } from "@/components/auth/TelegramSignIn";
import { getSessionUser } from "@/lib/auth/session";

export const metadata = { title: "Create an account" };

export default async function SignupPage() {
  if (await getSessionUser()) redirect("/dashboard");

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-12">
      <h1 className="mb-1 text-2xl font-bold text-ink">Create your account</h1>
      <p className="mb-6 text-sm text-ink-muted">
        Free to join. Your instructor can unlock more material for you later.
      </p>

      <TelegramSignIn label="Sign up with Telegram" />
      <p className="mt-2 text-center text-xs text-ink-subtle">
        Fastest way in — no password to remember.
      </p>

      <div className="my-6 flex items-center gap-3 text-[11px] font-bold tracking-[0.16em] text-ink-faint">
        <span className="h-px flex-1 bg-rule" />
        OR WITH EMAIL
        <span className="h-px flex-1 bg-rule" />
      </div>

      <Suspense>
        <AuthForm mode="signup" />
      </Suspense>
    </main>
  );
}
