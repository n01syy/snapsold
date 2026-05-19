import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

/**
 * Server Supabase client for Server Components, Server Actions,
 * and Route Handlers. Reads/writes auth cookies via `next/headers`.
 *
 * Call as:
 *   const supabase = await createClient()
 *
 * (Next.js 16 hands `cookies()` as a Promise — we await it here
 * so call sites stay clean.)
 */
export async function createClient() {
  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
    );
  }

  const cookieStore = await cookies();

  return createServerClient<Database>(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // `setAll` can run from a Server Component where cookies
          // are read-only. Middleware refreshes the session instead.
        }
      },
    },
  });
}
