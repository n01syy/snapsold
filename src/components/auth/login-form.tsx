"use client";

import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";
import { login, type AuthActionState } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const INITIAL: AuthActionState = {};

interface LoginFormProps {
  callbackError?: string;
}

export function LoginForm({ callbackError }: LoginFormProps) {
  const [state, formAction, pending] = useActionState(login, INITIAL);
  const error = callbackError ?? state.error;

  return (
    <Card className="border-border/60 bg-card/90 p-0 glow-ring backdrop-blur-sm">
      <div className="border-b border-border/60 px-6 py-6 sm:px-8">
        <p className="font-display text-sm font-semibold uppercase tracking-wider text-tomato">
          Welcome back
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tighter sm:text-3xl">
          Sign in to Snapsold
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Pick up where you left off — your pricing history saves to your
          account.
        </p>
      </div>

      <form action={formAction} className="space-y-5 px-6 py-6 sm:px-8">
        {error && (
          <p
            role="alert"
            className="rounded-lg border border-tomato/30 bg-tomato/10 px-3 py-2 text-sm text-tomato"
          >
            {error}
          </p>
        )}

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
            autoComplete="current-password"
            placeholder="••••••••"
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
              Signing in…
            </>
          ) : (
            "Sign in"
          )}
        </Button>
      </form>

      <div className="border-t border-border/60 px-6 py-4 text-center text-sm text-muted-foreground sm:px-8">
        No account yet?{" "}
        <Link
          href="/signup"
          className="font-semibold text-tomato hover:underline"
        >
          Create one free
        </Link>
      </div>
    </Card>
  );
}
