import { Suspense } from "react";
import { redirect } from "next/navigation";

import { AuthForm } from "@/components/auth/AuthForm";
import { getSessionUser } from "@/lib/auth/session";

export const metadata = { title: "Sign in" };

export default async function LoginPage() {
  if (await getSessionUser()) redirect("/dashboard");

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-12">
      <h1 className="mb-1 text-2xl font-bold text-ink">Welcome back</h1>
      <p className="mb-6 text-sm text-ink-muted">Sign in to continue your practice.</p>
      <Suspense>
        <AuthForm mode="login" />
      </Suspense>
    </main>
  );
}
