import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Logo } from "@/components/common/logo";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { getUser } from "@/lib/auth";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "#features", label: "Features" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#preview", label: "Preview" },
] as const;

/**
 * Sticky top navigation. Glassy background on the warm beige backdrop.
 * Auth-aware: shows Sign in / Sign up when logged out, Dashboard +
 * Sign out when logged in.
 *
 * Nav CTAs use plain `Link` + `buttonVariants` instead of
 * `<Button render={<Link />}>` — Base UI's render prop doesn't always
 * forward href/clicks correctly, which made "Dashboard" feel dead.
 */
export async function SiteNav() {
  const user = await getUser();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/80 backdrop-blur">
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" aria-label="Snapsold home">
          <Logo />
        </Link>

        <ul className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="font-display text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-2">
          {user ? (
            <>
              <span className="hidden max-w-[140px] truncate text-xs text-muted-foreground sm:inline">
                {user.email}
              </span>
              <Link
                href="/dashboard"
                className={cn(
                  buttonVariants({ variant: "ghost", size: "sm" }),
                  "font-display font-semibold",
                )}
              >
                Dashboard
              </Link>
              <SignOutButton />
            </>
          ) : (
            <>
              <Link
                href="/login"
                className={cn(
                  buttonVariants({ variant: "ghost", size: "sm" }),
                  "hidden font-display font-semibold sm:inline-flex",
                )}
              >
                Sign in
              </Link>
              <Link
                href="/signup"
                className={cn(
                  buttonVariants({ size: "sm" }),
                  "bg-tomato font-display font-semibold text-beige shadow-sm shadow-tomato/20 hover:bg-tomato/90",
                )}
              >
                Sign up free
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
