"use client";

import { AnimatePresence, motion } from "motion/react";
import {
  ArrowRight,
  CheckCircle2,
  Loader2,
  RotateCcw,
  Search,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { IdentifiedProduct } from "@/lib/types";
import { cn } from "@/lib/utils";

interface CandidateListProps {
  /** The query the user typed that produced this list. */
  query: string;
  /** Variants the engine found that all tied on the best match. */
  candidates: IdentifiedProduct[];
  /** Called with the catalogue id when the user picks a variant. */
  onPick: (productId: string) => void;
  /** Called when the user wants to refine the query. */
  onReset: () => void;
  /** Id of the candidate whose pricing is currently being fetched. */
  pendingId: string | null;
}

/**
 * Disambiguation step: when a search like "playstation" matches
 * several catalogue variants, we surface every one of them as a
 * picker card. Clicking "Price it" on a row fires the follow-up
 * Server Action that prices that exact variant.
 *
 * Design choices:
 *  • Each row has its own button so screen-reader users can tab
 *    straight to the variant they want.
 *  • While one variant is being priced, the others stay
 *    interactive (so the user can change their mind), but the
 *    chosen row shows an inline spinner.
 *  • The same "warm editorial" palette as the rest of the dash.
 */
export function CandidateList({
  query,
  candidates,
  onPick,
  onReset,
  pendingId,
}: CandidateListProps) {
  return (
    <div className="relative">
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-x-12 -inset-y-8 -z-10 opacity-40 blur-3xl"
        style={{
          background:
            "radial-gradient(ellipse 50% 50% at 20% 0%, #f4d35e 0%, transparent 60%), radial-gradient(ellipse 50% 50% at 100% 100%, #f95738 0%, transparent 60%)",
        }}
      />

      <Card className="overflow-hidden border-border/60 bg-card p-0 glow-ring">
        <div className="border-b border-border/60 p-6 sm:p-7">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-tomato">
            <Sparkles className="h-3.5 w-3.5" />
            Which one is it?
          </div>
          <h3 className="mt-2 text-2xl font-extrabold tracking-tight">
            We found {candidates.length} matches for{" "}
            <span className="text-tomato">“{query}”</span>
          </h3>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            Pick the exact variant so we can pull the right sold-listing data.
            Variants matter — a PS5 Slim and a PS5 Pro have very different
            resale curves.
          </p>
          <div className="mt-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={onReset}
              className="gap-2 font-display font-semibold"
              disabled={pendingId !== null}
            >
              <RotateCcw className="h-4 w-4" />
              Search again
            </Button>
          </div>
        </div>

        <ul className="divide-y divide-border/60" role="list">
          <AnimatePresence initial={false}>
            {candidates.map((candidate, idx) => (
              <CandidateRow
                key={candidate.id}
                candidate={candidate}
                idx={idx}
                onPick={onPick}
                isPending={pendingId === candidate.id}
                isAnyPending={pendingId !== null}
              />
            ))}
          </AnimatePresence>
        </ul>
      </Card>

      <p className="mt-3 flex items-center justify-center gap-2 text-center text-xs text-muted-foreground">
        <Search className="h-3.5 w-3.5" />
        Don&apos;t see it? Add more detail to your search — e.g.{" "}
        <span className="font-semibold text-navy">{`"${query} pro"`}</span> or{" "}
        <span className="font-semibold text-navy">{`"${query} slim"`}</span>.
      </p>
    </div>
  );
}

function CandidateRow({
  candidate,
  idx,
  onPick,
  isPending,
  isAnyPending,
}: {
  candidate: IdentifiedProduct;
  idx: number;
  onPick: (id: string) => void;
  isPending: boolean;
  isAnyPending: boolean;
}) {
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: idx * 0.03, ease: "easeOut" }}
      className={cn(
        "group flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:p-6",
        "transition-colors",
        isPending ? "bg-tomato/[0.06]" : "hover:bg-muted/40",
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          {candidate.brand && (
            <Badge
              variant="secondary"
              className="border border-border/60 px-2 py-0.5 text-[10px] uppercase tracking-wider"
            >
              {candidate.brand}
            </Badge>
          )}
          {candidate.category && (
            <span className="text-[11px] text-muted-foreground">
              {candidate.category}
            </span>
          )}
        </div>

        <p className="mt-1.5 text-sm font-semibold leading-snug tracking-tight text-foreground sm:text-base">
          {candidate.title}
        </p>

        <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <CheckCircle2 className="h-3 w-3 text-tomato" />
          {Math.round(candidate.confidence * 100)}% match
        </div>
      </div>

      <div className="shrink-0">
        <Button
          variant="default"
          onClick={() => onPick(candidate.id)}
          disabled={isAnyPending}
          aria-label={`Price ${candidate.title}`}
          className="w-full min-w-[112px] gap-2 font-display font-semibold sm:w-auto"
        >
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Pricing…
            </>
          ) : (
            <>
              Price it
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </Button>
      </div>
    </motion.li>
  );
}
