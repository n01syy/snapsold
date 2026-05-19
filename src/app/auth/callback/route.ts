import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

/**
 * Handles email-confirmation and OAuth redirects from Supabase.
 * Exchanges the `code` query param for a session cookie, then
 * sends the user to `next` (defaults to /dashboard).
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(
    `${origin}/login?error=${encodeURIComponent("Email confirmation failed — try signing in again.")}`,
  );
}
