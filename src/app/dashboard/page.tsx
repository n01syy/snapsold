import type { Metadata } from "next";
import { SiteFooter } from "@/components/nav/site-footer";
import { SiteNav } from "@/components/nav/site-nav";
import { DashboardClient } from "./dashboard-client";
import type { UploadMode } from "@/components/dashboard/upload-card";

export const metadata: Metadata = {
  title: "Dashboard",
  description:
    "Upload a product photo, search by name, or scan a barcode to get an instant Snapsold analysis.",
};

interface DashboardPageProps {
  // Next.js 16 hands `searchParams` to the page as a Promise.
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * The Snapsold dashboard.
 *
 * Server component that reads search params (for deep-linking
 * from the marketing hero or a shared URL) and delegates all
 * interactivity to {@link DashboardClient}.
 *
 * Deep-link contract:
 *   /dashboard                    → opens on the photo tab, empty
 *   /dashboard?q=Switch           → opens on the name tab, pre-filled
 *   /dashboard?mode=barcode       → opens straight to UPC entry
 *   /dashboard?b=045496883411     → opens on the barcode tab AND
 *                                   auto-submits — used by the
 *                                   landing-page camera scanner to
 *                                   hand off a scanned code without
 *                                   forcing the user to click again.
 */
export default async function DashboardPage({
  searchParams,
}: DashboardPageProps) {
  const params = await searchParams;
  const rawQuery = params.q;
  const rawBarcode = params.b;
  const rawMode = params.mode;

  const initialQuery = typeof rawQuery === "string" ? rawQuery : undefined;
  const initialBarcode =
    typeof rawBarcode === "string" && /^[0-9]{8,14}$/.test(rawBarcode)
      ? rawBarcode
      : undefined;
  const initialMode = resolveMode(
    rawMode,
    Boolean(initialQuery),
    Boolean(initialBarcode),
  );

  return (
    <>
      <SiteNav />
      <main className="flex flex-1 flex-col overflow-x-clip px-3 py-12 sm:px-4 sm:py-16 lg:py-20">
        {/*
          5xl (1024px) is the sweet spot now that the analysis card
          renders the trend pill, condition strip, listing-title
          preview, and a recent-sold-listings panel. At the old 4xl
          (896px) the left column squeezes the three price tiles
          and forces multi-line label wrapping. Keeping the upload
          flow inside the same container so the camera/text panes
          don't suddenly look enormous before analysis runs.
        */}
        <div className="mx-auto w-full max-w-5xl">
          <header className="mb-10 text-center">
            <p className="font-display text-sm font-semibold uppercase tracking-wider text-tomato">
              Pricing dashboard
            </p>
            <h1 className="mt-2 text-balance text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl">
              Price anything in seconds.
            </h1>
            <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
              Drop a photo, type a product name, or punch in a barcode. We&apos;ll
              identify it, pull recent eBay sold listings, and tell you exactly
              what to list it for.
            </p>
          </header>

          <DashboardClient
            initialQuery={initialQuery}
            initialBarcode={initialBarcode}
            initialMode={initialMode}
          />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

function resolveMode(
  raw: string | string[] | undefined,
  hasQuery: boolean,
  hasBarcode: boolean,
): UploadMode {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value === "image" || value === "name" || value === "barcode") {
    return value;
  }
  // Auto-pick the most informative tab based on what we deep-linked
  // in. Barcode wins over query — a scanned UPC is more specific
  // than a free-text search.
  if (hasBarcode) return "barcode";
  if (hasQuery) return "name";
  return "image";
}
