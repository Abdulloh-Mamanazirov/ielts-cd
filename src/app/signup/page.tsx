import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AuthForm } from "@/components/auth/AuthForm";
import { TelegramSignIn } from "@/components/auth/TelegramSignIn";
import { loadAuthSettings } from "@/lib/auth-settings-store";
import { getSessionUser } from "@/lib/auth/session";

export const metadata = { title: "Create an account" };

export default async function SignupPage() {
  if (await getSessionUser()) redirect("/dashboard");

  // Registration by email is a switch in the admin panel. Signing in with one
  // is not: an account that already exists keeps working either way.
  const { emailSignup } = await loadAuthSettings();

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-12">
      <h1 className="mb-1 text-2xl font-bold text-ink">Create your account</h1>
      <p className="mb-6 text-sm text-ink-muted">
        Free to join. The admin can unlock more material for you later.
      </p>

      <TelegramSignIn label="Sign up with Telegram" />
      <p className="mt-2 text-center text-xs text-ink-subtle">
        Fastest way in — no password to remember.
      </p>

      {emailSignup && (
        <>
          <div className="my-6 flex items-center gap-3 text-[11px] font-bold tracking-[0.16em] text-ink-faint">
            <span className="h-px flex-1 bg-rule" />
            OR WITH EMAIL
            <span className="h-px flex-1 bg-rule" />
          </div>

          <Suspense>
            <AuthForm mode="signup" />
          </Suspense>
        </>
      )}

      {!emailSignup && (
        <p className="mt-8 text-center text-sm text-ink-muted">
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-brand-blue hover:underline">
            Sign in
          </Link>
        </p>
      )}
    </main>
  );
}
