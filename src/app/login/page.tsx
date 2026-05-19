import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";
import { getUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to Snapsold to save your pricing analyses.",
};

interface LoginPageProps {
  searchParams: Promise<{ error?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const user = await getUser();
  if (user) redirect("/dashboard");

  const params = await searchParams;
  const callbackError = params.error;

  return (
    <AuthShell>
      <LoginForm callbackError={callbackError} />
    </AuthShell>
  );
}
