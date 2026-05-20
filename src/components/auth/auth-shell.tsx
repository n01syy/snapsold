import Link from "next/link";
import { Logo } from "@/components/common/logo";
import { SiteFooter } from "@/components/nav/site-footer";
import { SiteNav } from "@/components/nav/site-nav";

interface AuthShellProps {
  children: React.ReactNode;
}

/**
 * Shared chrome for login / signup — same nav + footer as the
 * marketing site, with a centred card on the warm beige backdrop.
 */
export function AuthShell({ children }: AuthShellProps) {
  return (
    <>
      <SiteNav />
      <main className="flex flex-1 flex-col items-center justify-center px-4 py-12 sm:py-16">
        <div className="relative w-full max-w-md">
          <div
            aria-hidden
            className="pointer-events-none absolute -inset-x-8 -inset-y-12 -z-10 opacity-60 blur-3xl"
            style={{
              background:
                "radial-gradient(ellipse 55% 50% at 30% 40%, #f95738 0%, transparent 65%), radial-gradient(ellipse 50% 45% at 75% 60%, #f4d35e 0%, transparent 65%)",
            }}
          />
          <div className="mb-8 flex justify-center lg:hidden">
            <Link href="/" aria-label="Snapsold home">
              <Logo />
            </Link>
          </div>
          {children}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
