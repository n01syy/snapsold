"use client";

import { motion } from "motion/react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  CheckCircle2,
  ClipboardCopy,
  ExternalLink,
  Flame,
  RotateCcw,
  Sparkles,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Histogram } from "@/components/dashboard/histogram";
import { ListingHandoff } from "@/components/dashboard/listing-handoff";
import { PriceTile } from "@/components/dashboard/price-tile";
import { DEFAULT_FIXED_FEE, DEFAULT_FVF_RATE, computeNet } from "@/lib/fees";
import type {
  ConditionPrice,
  IdentifiedProduct,
  PriceAnalysis,
  PriceTrend,
  RecentSale,
  SoldListing,
} from "@/lib/types";
import { cn } from "@/lib/utils";

interface AnalysisViewProps {
  product: IdentifiedProduct;
  analysis: PriceAnalysis;
  onReset: () => void;
}

/**
 * The "final answer" card. Mirrors the marketing SampleResult on
 * the landing page but is fully data-driven and adds two real-app
 * affordances:
 *  • A "Copy listing title" button (one-click paste into eBay).
 *  • A "New analysis" reset that flips back to the upload pad.
 */
export function AnalysisView({ product, analysis, onReset }: AnalysisViewProps) {
  const [copied, setCopied] = useState(false);
  const [selectedCondition, setSelectedCondition] = useState<
    SoldListing["condition"] | null
  >(null);

  const copyTitle = async () => {
    try {
      await navigator.clipboard.writeText(product.title);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can fail in insecure contexts — fall back silently.
    }
  };

  /**
   * When the user picks their item's condition, rebias all three
   * price tiers by the ratio of (condition median / overall median).
   *
   * Why ratio scaling rather than re-running the engine on a
   * subset: the conditionBreakdown median already reflects the
   * cleaned (IQR-filtered) sample for that condition, so the
   * ratio is a faithful proxy for "where would this distribution
   * have landed if every listing were this condition?". It also
   * preserves the existing quick/recommended/max *shape* (the
   * boxed premium baked into `analysis.prices` carries through
   * proportionally), so the three tiles still tell the same
   * "list low for speed / patient for max" story.
   *
   * We could re-pricing-engine-call per condition, but that's a
   * second server round-trip for a UI affordance the user
   * expects to feel instant. The ratio method matches the
   * conditional median exactly (since that's what the engine
   * would have computed anyway) within a few dollars on the
   * shoulder tiles, which is well below user-visible noise.
   */
  const adjustedPrices = useMemo(() => {
    if (!selectedCondition) return analysis.prices;
    const row = analysis.conditionBreakdown.find(
      (r) => r.condition === selectedCondition,
    );
    if (!row || analysis.median <= 0) return analysis.prices;
    const ratio = row.median / analysis.median;
    return {
      quick: Math.round(analysis.prices.quick * ratio),
      recommended: Math.round(analysis.prices.recommended * ratio),
      max: Math.round(analysis.prices.max * ratio),
    };
  }, [analysis, selectedCondition]);

  return (
    <div className="relative">
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-x-12 -inset-y-8 -z-10 opacity-60 blur-3xl"
        style={{
          background:
            "radial-gradient(ellipse 50% 50% at 25% 50%, #f95738 0%, transparent 65%), radial-gradient(ellipse 50% 50% at 80% 50%, #f4d35e 0%, transparent 65%)",
        }}
      />

      <Card className="overflow-hidden border-border/60 bg-card p-0 glow-ring">
        {/*
          The "too broad" banner only makes sense for text searches.
          When the user submitted a photo (or a barcode), they didn't
          *type* anything they could refine — the search query came
          from vision/UPC lookup, so prompting them to "add Series X"
          or "add 256GB" would be confusing and off-base. Suppress.
        */}
        {analysis.isBroad && product.source === "name" && (
          <BroadQueryBanner product={product} analysis={analysis} />
        )}

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="grid gap-0 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]"
        >
          {/* LEFT — identification + prices */}
          <div className="border-border/60 p-6 sm:p-8 lg:border-r">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-tomato" />
              {product.source === "image"
                ? "AI-identified from photo"
                : product.source === "barcode"
                  ? "Matched to UPC"
                  : "Matched to your query"}
            </div>
            <h3 className="mt-2 text-lg font-semibold leading-snug tracking-tight">
              {product.title}
            </h3>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <MatchBadge confidence={product.confidence} />
              <DemandBadge
                demand={analysis.demand}
                perDay={analysis.perDay}
              />
              {analysis.trend && <TrendBadge trend={analysis.trend} />}
              <Badge variant="secondary" className="border border-border/60">
                {analysis.sampleSize} sold · {analysis.windowDays}d
              </Badge>
              {analysis.outliersRemoved > 0 && (
                <Badge variant="secondary" className="border border-border/60">
                  {analysis.outliersRemoved} outlier
                  {analysis.outliersRemoved === 1 ? "" : "s"} filtered
                </Badge>
              )}
            </div>

            <div className="mt-7 grid grid-cols-3 gap-3">
              <PriceTile
                label="Quick"
                value={adjustedPrices.quick}
                sublabel={quickSubtitle(analysis.perDay)}
                tone="muted"
              />
              <PriceTile
                label="Recommended"
                value={adjustedPrices.recommended}
                sublabel="Best balance"
                tone="brand"
              />
              <PriceTile
                label="Max"
                value={adjustedPrices.max}
                sublabel={maxSubtitle(analysis.perDay)}
                tone="muted"
              />
            </div>

            <FeeRow prices={adjustedPrices} />

            {analysis.conditionBreakdown.length >= 2 && (
              <ConditionPicker
                rows={analysis.conditionBreakdown}
                overallMedian={analysis.median}
                selected={selectedCondition}
                onSelect={setSelectedCondition}
              />
            )}

            <div className="mt-6">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Listing title
              </div>
              <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-stretch">
                <div
                  className="min-w-0 truncate rounded-lg border border-border/60 bg-muted/30 px-3 py-2 font-mono text-xs leading-relaxed text-navy sm:flex-1"
                  title={product.title}
                >
                  {product.title}
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={copyTitle}
                    className="gap-1.5 font-display font-semibold"
                    aria-live="polite"
                  >
                    <ClipboardCopy className="h-4 w-4" />
                    {copied ? "Copied" : "Copy"}
                  </Button>
                  <ListingHandoff title={product.title} />
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={onReset}
                className="gap-2 font-display font-semibold"
              >
                <RotateCcw className="h-4 w-4" />
                New analysis
              </Button>
            </div>
          </div>

          {/* RIGHT — histogram + reasoning */}
          <div className="p-6 sm:p-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <TrendingUp className="h-4 w-4 text-tomato" />
                Sold price distribution
              </div>
              <span className="text-xs text-muted-foreground">
                last {analysis.windowDays} days
              </span>
            </div>

            <div className="mt-6">
              <Histogram
                buckets={analysis.histogram}
                recommendedBucket={analysis.recommendedBucket}
              />
            </div>

            <p className="mt-5 rounded-lg border border-border/60 bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground">
              <span className="font-semibold text-foreground">
                Why we recommend ${adjustedPrices.recommended}
                {selectedCondition
                  ? ` for ${prettyCondition(selectedCondition)}`
                  : ""}
                :
              </span>{" "}
              {analysis.explanation}
            </p>

            <StatsGrid analysis={analysis} />

            {analysis.recentSales.length > 0 && (
              <RecentSalesPanel
                sales={analysis.recentSales}
                searchQuery={product.searchQuery}
              />
            )}
          </div>
        </motion.div>
      </Card>
    </div>
  );
}

/**
 * Time-to-sell copy for the Quick Sale tile. Maps the engine's
 * computed listings-per-day signal into a calibrated, honest
 * range — we don't claim "1–3 days" when only ~0.4 of the same
 * thing has sold per day for the last two weeks.
 */
function quickSubtitle(perDay: number): string {
  if (perDay >= 5) return "Sells same week";
  if (perDay >= 2) return "Sells in days";
  if (perDay >= 0.7) return "≈ 1 week to sell";
  if (perDay >= 0.2) return "1–2 weeks to sell";
  return "Slow market";
}

function maxSubtitle(perDay: number): string {
  if (perDay >= 2) return "Patient sellers";
  if (perDay >= 0.7) return "May sit 2+ weeks";
  return "Could sit a while";
}

/**
 * Top-of-card banner shown when the pricing engine detects that
 * the input query was too broad to yield a reliable single
 * recommendation. Surfaces the symptom (wide spread, mixed-product
 * sample), explains the cause, and offers concrete refinements
 * the user can copy. The chart and tiles stay visible — they
 * still tell a story, just with the right amount of skepticism.
 */
function BroadQueryBanner({
  product,
  analysis,
}: {
  product: IdentifiedProduct;
  analysis: PriceAnalysis;
}) {
  void product;
  return (
    <div
      role="alert"
      className="flex items-start gap-3 border-b border-sandy/40 bg-sandy/15 px-6 py-4 sm:px-8"
    >
      <div className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-sandy/30 text-navy">
        <AlertTriangle className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold tracking-tight text-navy">
          Your search is too broad to price reliably.
        </p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          We pulled {analysis.rawSampleSize} sold listings, but the spread is{" "}
          <span className="font-semibold text-navy">
            {Math.round(analysis.dispersion * 100)}% of the median
          </span>{" "}
          — that usually means the results mix several distinct products
          (e.g. consoles + accessories + games). The headline number below is
          the median of that noise, not the price of one product.
        </p>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          <span className="font-semibold text-foreground">Refine by adding:</span>{" "}
          a specific model (
          <Hint>Series X</Hint>, <Hint>iPhone 16 Pro Max</Hint>), a storage
          tier (<Hint>1TB</Hint>, <Hint>256GB</Hint>), or a year/edition (
          <Hint>2024</Hint>).
        </p>
      </div>
    </div>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded border border-navy/15 bg-card/70 px-1.5 py-0.5 font-mono text-[11px] text-navy">
      {children}
    </span>
  );
}

/**
 * Identification confidence — renamed from "confidence" because
 * the same word is used (correctly) for pricing confidence on
 * the right-hand stats grid. Calling this "Match" makes the two
 * unambiguously different.
 */
function MatchBadge({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100);
  const tone =
    confidence >= 0.75
      ? "border-navy/30 bg-navy/5 text-navy"
      : confidence >= 0.5
        ? "border-sandy/30 bg-sandy/10 text-sandy"
        : "border-tomato/30 bg-tomato/10 text-tomato";
  return (
    <Badge variant="secondary" className={cn("border", tone)}>
      <CheckCircle2 className="mr-1 h-3 w-3" />
      {pct}% match
    </Badge>
  );
}

function DemandBadge({
  demand,
  perDay,
}: {
  demand: "Low" | "Medium" | "High";
  perDay: number;
}) {
  const tone =
    demand === "High"
      ? "border-tomato/30 bg-tomato/10 text-tomato"
      : demand === "Medium"
        ? "border-sandy/30 bg-sandy/10 text-sandy"
        : "border-border/60";
  // perDay can dip below 0.1; format as "<1/day" rather than "0/day"
  // so users see that *something* is selling, just slowly.
  const rate =
    perDay >= 1
      ? `${perDay.toFixed(perDay >= 10 ? 0 : 1)}/day`
      : perDay > 0
        ? "<1/day"
        : "no recent sales";
  return (
    <Badge variant="secondary" className={cn("border", tone)}>
      <Flame className="mr-1 h-3 w-3" />
      {demand} demand · {rate}
    </Badge>
  );
}

/**
 * Compact "▲ 7% 7d" pill that sits in the badge row alongside
 * Match / Demand / sample-size. Direction colour-codes it: up =
 * navy (good news for sellers), down = tomato (list sooner),
 * flat = muted neutral. Full context (medians + sample counts
 * on each side of the window) lives in the tooltip so the pill
 * stays one line at every column width.
 */
function TrendBadge({ trend }: { trend: PriceTrend }) {
  const pct = Math.round(Math.abs(trend.delta) * 100);
  const Icon =
    trend.direction === "up"
      ? ArrowUp
      : trend.direction === "down"
        ? ArrowDown
        : ArrowRight;
  const tone =
    trend.direction === "up"
      ? "border-navy/30 bg-navy/5 text-navy"
      : trend.direction === "down"
        ? "border-tomato/30 bg-tomato/10 text-tomato"
        : "border-border/60";
  const label =
    trend.direction === "flat" ? "Flat 7d" : `${pct}% 7d`;
  const tooltip = `Median $${trend.earlierMedian} (n=${trend.earlierCount}, first 7d) → $${trend.recentMedian} (n=${trend.recentCount}, last 7d)`;
  return (
    <Badge
      variant="secondary"
      className={cn("border", tone)}
      title={tooltip}
    >
      <Icon className="mr-1 h-3 w-3" />
      {label}
    </Badge>
  );
}

/**
 * Interactive "My item's condition" picker under the price tiles.
 *
 * Each row is a button that, when clicked, biases the three price
 * tiles toward that condition's median (the parent component does
 * the ratio scaling — see {@link AnalysisView}). Clicking the
 * active row again, or hitting "Reset", goes back to the
 * overall-median view.
 *
 * Each row also surfaces the delta vs. the overall median so the
 * user can see at a glance how much condition swings the answer
 * ("New +14% · 9 sold", "Used · Good −5% · 12 sold").
 *
 * Only renders when the engine emits 2+ rows — fewer than that
 * isn't enough condition variety to be worth choosing between
 * (and `pricing.ts` already drops rows with fewer than 3 sales).
 */
function ConditionPicker({
  rows,
  overallMedian,
  selected,
  onSelect,
}: {
  rows: ConditionPrice[];
  overallMedian: number;
  selected: SoldListing["condition"] | null;
  onSelect: (c: SoldListing["condition"] | null) => void;
}) {
  return (
    <div className="mt-5">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          My item&apos;s condition
        </div>
        {selected && (
          <button
            type="button"
            onClick={() => onSelect(null)}
            className="text-[10px] font-semibold text-tomato hover:underline"
          >
            Reset
          </button>
        )}
      </div>
      <ul className="mt-2 space-y-1.5">
        {rows.map((r) => {
          const isActive = selected === r.condition;
          const delta =
            overallMedian > 0
              ? Math.round(((r.median - overallMedian) / overallMedian) * 100)
              : 0;
          return (
            <li key={r.condition}>
              <button
                type="button"
                onClick={() => onSelect(isActive ? null : r.condition)}
                aria-pressed={isActive}
                className={cn(
                  "flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-1.5 text-left transition-colors",
                  isActive
                    ? "border-tomato/50 bg-tomato/10 ring-1 ring-tomato/20"
                    : "border-border/60 bg-muted/30 hover:border-tomato/30 hover:bg-tomato/5",
                )}
              >
                <span className="truncate text-xs font-medium text-navy">
                  {prettyCondition(r.condition)}
                </span>
                <span className="shrink-0 text-xs tabular-nums">
                  <span className="font-bold text-foreground">${r.median}</span>
                  {delta !== 0 && (
                    <span
                      className={cn(
                        "ml-1.5 text-[10px] font-semibold",
                        delta > 0 ? "text-navy" : "text-tomato",
                      )}
                    >
                      {delta > 0 ? "+" : ""}
                      {delta}%
                    </span>
                  )}
                  <span className="ml-1.5 text-muted-foreground">
                    · {r.count}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {selected && (
        <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
          Prices above are scaled for{" "}
          <span className="font-semibold text-foreground">
            {prettyCondition(selected)}
          </span>{" "}
          — biased from the overall median (${overallMedian}) by this
          condition&apos;s sample.
        </p>
      )}
    </div>
  );
}

/**
 * "After eBay fees" strip showing the net take-home for each of
 * the three list prices. Lives directly under the price tiles so
 * the gross/net comparison reads as one unit — sellers care about
 * net more than gross, but list at gross, so showing both is the
 * honest move.
 *
 * Uses the default US fee profile (13.25% FVF + $0.30/order). The
 * rate is exposed in the tooltip + corner so the number isn't
 * mystery math.
 */
function FeeRow({
  prices,
}: {
  prices: { quick: number; recommended: number; max: number };
}) {
  const q = computeNet(prices.quick);
  const r = computeNet(prices.recommended);
  const m = computeNet(prices.max);
  const rateLabel = `~${Math.round(DEFAULT_FVF_RATE * 1000) / 10}% + $${DEFAULT_FIXED_FEE.toFixed(2)}`;
  return (
    <div className="mt-3 rounded-xl border border-border/60 bg-muted/20 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          <Wallet className="h-3 w-3 text-tomato" />
          After eBay fees
        </div>
        <span
          className="text-[10px] text-muted-foreground/80"
          title="eBay Final Value Fee + per-order fixed fee. Real rate varies by category and store level."
        >
          {rateLabel}
        </span>
      </div>
      <dl className="mt-2 grid grid-cols-3 gap-3">
        <NetCell label="Quick net" net={q.net} />
        <NetCell label="Recommended net" net={r.net} highlight />
        <NetCell label="Max net" net={m.net} />
      </dl>
    </div>
  );
}

function NetCell({
  label,
  net,
  highlight,
}: {
  label: string;
  net: number;
  highlight?: boolean;
}) {
  return (
    <div className="min-w-0">
      <dt className="truncate text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd
        className={cn(
          "mt-0.5 text-base font-bold leading-none tracking-tight tabular-nums",
          highlight && "text-tomato",
        )}
      >
        ${Math.round(net)}
      </dd>
    </div>
  );
}

/**
 * Right-column "Recent sold listings" panel — three real eBay
 * sales drawn from the cleaned sample. Two purposes:
 *  1. Builds trust that the headline number reflects real data.
 *  2. The titles double as listing-title templates.
 */
function RecentSalesPanel({
  sales,
  searchQuery,
}: {
  sales: RecentSale[];
  searchQuery: string;
}) {
  const allSoldUrl = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(
    searchQuery,
  )}&LH_Sold=1&LH_Complete=1`;
  return (
    <div className="mt-5">
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Recent sold listings
        </div>
        <a
          href={allSoldUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-tomato hover:underline"
        >
          See all on eBay
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>
      <ul className="mt-2 space-y-1.5">
        {sales.map((s, i) => (
          <RecentSaleRow key={`${s.title}-${i}`} sale={s} />
        ))}
      </ul>
    </div>
  );
}

function RecentSaleRow({ sale }: { sale: RecentSale }) {
  const ago = relativeTime(sale.soldAt);
  const inner = (
    <>
      <span className="w-12 shrink-0 text-right font-mono text-sm font-bold tabular-nums text-navy">
        ${Math.round(sale.price)}
      </span>
      <span className="min-w-0 flex-1 truncate text-xs text-foreground">
        {sale.title}
      </span>
      <span className="hidden shrink-0 text-[10px] uppercase tracking-wider text-muted-foreground sm:inline">
        {prettyCondition(sale.condition)}
      </span>
      <span className="shrink-0 text-[10px] text-muted-foreground">
        {ago}
      </span>
    </>
  );

  // Listings without an explicit URL stay rendered as a div so the
  // row layout doesn't shift when only some listings link out.
  if (!sale.url) {
    return (
      <li
        className="flex items-center gap-3 rounded-lg border border-border/60 bg-muted/30 px-3 py-1.5"
        title={sale.title}
      >
        {inner}
      </li>
    );
  }
  return (
    <li>
      <a
        href={sale.url}
        target="_blank"
        rel="noreferrer"
        className="flex items-center gap-3 rounded-lg border border-border/60 bg-muted/30 px-3 py-1.5 transition-colors hover:border-tomato/40 hover:bg-tomato/5"
        title={sale.title}
      >
        {inner}
      </a>
    </li>
  );
}

/**
 * Bottom stats grid. Mean is suppressed when it's within ~3% of
 * the median (the common case after IQR filtering) so we don't
 * waste a slot showing the same number twice. When it does
 * differ materially, it stays as a useful skew indicator.
 */
function StatsGrid({ analysis }: { analysis: PriceAnalysis }) {
  const skewed =
    Math.abs(analysis.mean - analysis.median) >
    Math.max(1, analysis.median * 0.03);

  return (
    <dl
      className={cn(
        "mt-4 grid gap-3 text-xs",
        skewed
          ? "grid-cols-2 sm:grid-cols-4"
          : "grid-cols-3 sm:grid-cols-3",
      )}
    >
      <Stat label="Median" value={`$${analysis.median}`} />
      {skewed && <Stat label="Mean" value={`$${analysis.mean}`} />}
      <Stat label="IQR" value={`$${analysis.iqr}`} />
      <Stat
        label="Confidence"
        value={`${Math.round(analysis.confidence * 100)}%`}
      />
    </dl>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2">
      <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5 font-semibold tracking-tight">{value}</dd>
    </div>
  );
}

function prettyCondition(c: SoldListing["condition"]): string {
  switch (c) {
    case "new":
      return "New";
    case "used-excellent":
      return "Used · Excellent";
    case "used-good":
      return "Used · Good";
    case "used-fair":
      return "Used · Fair";
    case "broken":
      return "For parts";
  }
}

/**
 * Compact "n hours ago" / "n days ago" formatter for the recent
 * sold listings panel. Keeps things absolute beyond ~3 weeks so
 * we never show "23 days ago" with the implication that the
 * listing is recent.
 */
function relativeTime(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const diffMs = Date.now() - t;
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diffMs < hour) return `${Math.max(1, Math.round(diffMs / minute))}m ago`;
  if (diffMs < day) return `${Math.round(diffMs / hour)}h ago`;
  if (diffMs < 21 * day) {
    const days = Math.round(diffMs / day);
    return `${days}d ago`;
  }
  return new Date(t).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}
