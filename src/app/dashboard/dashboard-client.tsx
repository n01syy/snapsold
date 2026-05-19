"use client";

import { motion } from "motion/react";
import {
  ExternalLink,
  Loader2,
  RotateCcw,
  ScanBarcode,
  SearchX,
} from "lucide-react";
import { useCallback, useState, useTransition } from "react";
import {
  UploadCard,
  type UploadCardInput,
  type UploadMode,
} from "@/components/dashboard/upload-card";
import { AnalysisView } from "@/components/dashboard/analysis-view";
import { CandidateList } from "@/components/dashboard/candidate-list";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { identifyAndPrice, priceProductById } from "./actions";
import type { IdentifiedProduct, PriceAnalysis } from "@/lib/types";

interface DashboardClientProps {
  initialQuery?: string;
  initialBarcode?: string;
  initialMode?: UploadMode;
}

/**
 * Client-side state machine for the dashboard:
 *
 *                    ┌──────────────────────────────────────┐
 *                    │                                      │
 *   idle ─[submit]─► submitting ─[candidates]─► choosing ───┤
 *     ▲                  │                                  │
 *     │                  └─[match]──► priced ◄──[pick]──────┘
 *     │                                  │
 *     └────────────[reset]───────────────┘
 *
 * The "choosing" state shows a CandidateList; clicking a card
 * fires the follow-up `priceProductById` action, which lands us
 * in "priced" (success) with the chosen variant's analysis.
 */
type Phase =
  | { kind: "idle" }
  | { kind: "submitting"; label: string }
  | {
      kind: "choosing";
      query: string;
      candidates: IdentifiedProduct[];
      /** Id of a candidate currently being priced (if any). */
      pendingId: string | null;
    }
  | {
      kind: "priced";
      product: IdentifiedProduct;
      analysis: PriceAnalysis;
    }
  | { kind: "not_found"; query: string }
  | { kind: "error"; message: string };

export function DashboardClient({
  initialQuery,
  initialBarcode,
  initialMode,
}: DashboardClientProps) {
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [, startTransition] = useTransition();

  const handleSubmit = useCallback((input: UploadCardInput) => {
    const formData = new FormData();
    formData.set("mode", input.mode);

    if (input.mode === "image") {
      formData.set("image", input.file);
      setPhase({ kind: "submitting", label: `Analysing ${input.file.name}…` });
    } else if (input.mode === "name") {
      formData.set("query", input.query);
      setPhase({
        kind: "submitting",
        label: `Searching for “${truncate(input.query, 40)}”…`,
      });
    } else {
      formData.set("barcode", input.barcode);
      setPhase({
        kind: "submitting",
        label: `Looking up UPC ${input.barcode}…`,
      });
    }

    startTransition(async () => {
      try {
        const result = await identifyAndPrice(formData);
        if (!result.ok) {
          setPhase({ kind: "error", message: result.error });
          return;
        }
        if (result.kind === "candidates") {
          setPhase({
            kind: "choosing",
            query: result.query,
            candidates: result.candidates,
            pendingId: null,
          });
          return;
        }
        if (result.kind === "not_found") {
          setPhase({ kind: "not_found", query: result.query });
          return;
        }
        setPhase({
          kind: "priced",
          product: result.product,
          analysis: result.analysis,
        });
      } catch (err) {
        setPhase({
          kind: "error",
          message:
            err instanceof Error
              ? err.message
              : "Something went wrong — please try again.",
        });
      }
    });
  }, []);

  const handlePick = useCallback((productId: string) => {
    setPhase((prev) => {
      if (prev.kind !== "choosing") return prev;
      return { ...prev, pendingId: productId };
    });

    startTransition(async () => {
      try {
        const result = await priceProductById(productId);
        if (!result.ok) {
          setPhase({ kind: "error", message: result.error });
          return;
        }
        if (result.kind === "candidates") {
          // Defensive: priceProductById should never branch into
          // candidates, but the union allows it — fall back gracefully.
          setPhase({
            kind: "choosing",
            query: result.query,
            candidates: result.candidates,
            pendingId: null,
          });
          return;
        }
        if (result.kind === "not_found") {
          setPhase({ kind: "not_found", query: result.query });
          return;
        }
        setPhase({
          kind: "priced",
          product: result.product,
          analysis: result.analysis,
        });
      } catch (err) {
        setPhase({
          kind: "error",
          message:
            err instanceof Error
              ? err.message
              : "Couldn't price that variant — try another.",
        });
      }
    });
  }, []);

  const reset = useCallback(() => setPhase({ kind: "idle" }), []);

  if (phase.kind === "priced") {
    return (
      <AnalysisView
        product={phase.product}
        analysis={phase.analysis}
        onReset={reset}
      />
    );
  }

  if (phase.kind === "choosing") {
    return (
      <CandidateList
        query={phase.query}
        candidates={phase.candidates}
        onPick={handlePick}
        onReset={reset}
        pendingId={phase.pendingId}
      />
    );
  }

  if (phase.kind === "not_found") {
    return <NotFoundView query={phase.query} onReset={reset} />;
  }

  return (
    <div className="space-y-6">
      <UploadCard
        pending={phase.kind === "submitting"}
        initialQuery={initialQuery}
        initialBarcode={initialBarcode}
        initialMode={initialMode}
        onSubmit={handleSubmit}
      />

      {phase.kind === "submitting" && <PipelineStatus label={phase.label} />}

      {phase.kind === "error" && (
        <ErrorState message={phase.message} onRetry={reset} />
      )}
    </div>
  );
}

function PipelineStatus({ label }: { label: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto flex max-w-2xl items-center gap-3 rounded-xl border border-border/60 bg-card/70 p-4"
      role="status"
      aria-live="polite"
    >
      <Loader2 className="h-5 w-5 shrink-0 animate-spin text-tomato" />
      <div>
        <p className="text-sm font-semibold tracking-tight">{label}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Matching against the catalogue → fetching sold listings → scoring.
        </p>
      </div>
    </motion.div>
  );
}

/**
 * Friendly empty state for the legitimate "eBay returned zero
 * results" outcome — typos, made-up phrases, or long-tail
 * products with no recent sales. Crucially distinct from
 * `ErrorState`: nothing broke, we just don't have an honest
 * answer to give.
 *
 * Includes a "Search on eBay directly" deep link so the user
 * can sanity-check whether the query is real before giving up.
 */
function NotFoundView({
  query,
  onReset,
}: {
  query: string;
  onReset: () => void;
}) {
  const ebayUrl = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(
    query,
  )}&LH_Sold=1&LH_Complete=1`;

  return (
    <div className="relative">
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-x-12 -inset-y-8 -z-10 opacity-40 blur-3xl"
        style={{
          background:
            "radial-gradient(ellipse 50% 50% at 50% 30%, #f4d35e 0%, transparent 65%)",
        }}
      />
      <Card className="overflow-hidden border-border/60 bg-card p-0 glow-ring">
        <div className="flex flex-col items-center gap-4 p-8 text-center sm:p-12">
          <div className="grid h-14 w-14 place-items-center rounded-full bg-sandy/20 text-navy">
            <SearchX className="h-7 w-7" />
          </div>
          <div>
            <h3 className="text-2xl font-extrabold tracking-tight">
              No sold listings found.
            </h3>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
              We searched eBay for{" "}
              <span className="font-mono text-navy">
                &ldquo;{truncate(query, 60)}&rdquo;
              </span>{" "}
              and got zero results in the last 14 days. A few common reasons:
            </p>
          </div>
          <ul className="grid w-full max-w-md gap-2 text-left text-sm text-muted-foreground sm:grid-cols-1">
            <Reason>It might be a typo or unusual phrasing.</Reason>
            <Reason>
              The product may not have sold on eBay recently — try a more common
              name or alternate spelling.
            </Reason>
            <Reason>
              For very obscure items, try adding the brand or model number.
            </Reason>
          </ul>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
            <Button
              variant="default"
              onClick={onReset}
              className="gap-2 font-display font-semibold"
            >
              <RotateCcw className="h-4 w-4" />
              Try a new search
            </Button>
            <Button
              variant="secondary"
              render={<a href={ebayUrl} target="_blank" rel="noreferrer" />}
              className="gap-2 font-display font-semibold"
            >
              <ExternalLink className="h-4 w-4" />
              Open on eBay
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

function Reason({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-2">
      <span aria-hidden className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-tomato" />
      <span>{children}</span>
    </li>
  );
}

function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div
      role="alert"
      className="mx-auto max-w-2xl rounded-xl border border-tomato/30 bg-tomato/10 p-4"
    >
      <p className="flex items-center gap-2 text-sm font-semibold text-tomato">
        <ScanBarcode className="h-4 w-4" />
        We couldn&apos;t price that
      </p>
      <p className="mt-1 text-sm text-muted-foreground">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-tomato hover:underline"
      >
        Try again
      </button>
    </div>
  );
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}
