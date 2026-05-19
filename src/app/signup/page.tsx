import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignupForm } from "@/components/auth/signup-form";
import { getUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Sign up",
  description: "Create a free Snapsold account to save your pricing analyses.",
};

export default async function SignupPage() {
  const user = await getUser();
  if (user) redirect("/dashboard");

  return (
    <AuthShell>
      <SignupForm />
    </AuthShell>
  );
}
