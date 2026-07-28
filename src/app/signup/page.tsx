import { Suspense } from "react";
import { redirect } from "next/navigation";

import { AuthForm } from "@/components/auth/AuthForm";
import { getSessionUser } from "@/lib/auth/session";

export const metadata = { title: "Create an account" };

export default async function SignupPage() {
  if (await getSessionUser()) redirect("/dashboard");

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-12">
      <h1 className="mb-1 text-2xl font-bold text-ink">Create your account</h1>
      <p className="mb-6 text-sm text-ink-muted">
        Free to join. Your instructor can unlock premium tests for you later.
      </p>
      <Suspense>
        <AuthForm mode="signup" />
      </Suspense>
    </main>
  );
}
