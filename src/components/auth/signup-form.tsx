"use client";

import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";
import { signup, type AuthActionState } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const INITIAL: AuthActionState = {};

export function SignupForm() {
  const [state, formAction, pending] = useActionState(signup, INITIAL);

  return (
    <Card className="border-border/60 bg-card/90 p-0 glow-ring backdrop-blur-sm">
      <div className="border-b border-border/60 px-6 py-6 sm:px-8">
        <p className="font-display text-sm font-semibold uppercase tracking-wider text-tomato">
          Get started
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tighter sm:text-3xl">
          Create your account
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Free while in beta. Save analyses, track what you&apos;ve priced, and
          list smarter on eBay.
        </p>
      </div>

      <form action={formAction} className="space-y-5 px-6 py-6 sm:px-8">
        {state.error && (
          <p
            role="alert"
            className="rounded-lg border border-tomato/30 bg-tomato/10 px-3 py-2 text-sm text-tomato"
          >
            {state.error}
          </p>
        )}

        {state.success && (
          <p
            role="status"
            className="rounded-lg border border-navy/20 bg-navy/5 px-3 py-2 text-sm text-navy"
          >
            {state.success}
          </p>
        )}

        <div className="space-y-2">
          <Label htmlFor="name">Name (optional)</Label>
          <Input
            id="name"
            name="name"
            type="text"
            autoComplete="name"
            placeholder="Alex"
            disabled={pending}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            required
            disabled={pending}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            placeholder="At least 8 characters"
            minLength={8}
            required
            disabled={pending}
          />
        </div>

        <Button
          type="submit"
          disabled={pending}
          className="h-11 w-full bg-tomato font-display font-semibold text-beige shadow-sm shadow-tomato/20 hover:bg-tomato/90"
        >
          {pending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Creating account…
            </>
          ) : (
            "Create account"
          )}
        </Button>
      </form>

      <div className="border-t border-border/60 px-6 py-4 text-center text-sm text-muted-foreground sm:px-8">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-tomato hover:underline">
          Sign in
        </Link>
      </div>
    </Card>
  );
}
