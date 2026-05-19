import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function FooterCta() {
  return (
    <section className="relative py-20 sm:py-28">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-card p-10 shadow-sm sm:p-14">
          <div
            aria-hidden
            className="pointer-events-none absolute -inset-x-20 -inset-y-40 -z-10 opacity-50 blur-3xl"
            style={{
              background:
                "radial-gradient(ellipse 45% 40% at 20% 50%, #f95738 0%, transparent 65%), radial-gradient(ellipse 45% 40% at 80% 50%, #f4d35e 0%, transparent 65%)",
            }}
          />

          <div className="flex flex-col items-center text-center">
            <h2 className="max-w-2xl text-balance text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl">
              Stop underselling. Start{" "}
              <span className="text-gradient-brand">pricing like a pro.</span>
            </h2>
            <p className="mt-4 max-w-xl text-muted-foreground">
              Free while in beta. No credit card. Built for flippers, thrifters,
              estate-sale hunters, and anyone with too much stuff.
            </p>
            <Link
              href="/signup"
              className={cn(
                buttonVariants({ size: "lg" }),
                "mt-8 inline-flex h-12 gap-2 bg-tomato px-6 font-display font-semibold text-beige shadow-sm shadow-tomato/30 hover:bg-tomato/90",
              )}
            >
              Try Snapsold free
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
