"use client";

import { motion, useInView, useReducedMotion } from "motion/react";
import {
  ArrowUp,
  CheckCircle2,
  ClipboardCopy,
  ExternalLink,
  Flame,
  Sparkles,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { useEffect, useRef, useState, useMemo } from "react";
import {
  AnimatedNetCell,
  AnimatedPriceTile,
  cardEntrance,
  EASE_OUT,
  fadeUp,
  stagger,
} from "@/components/dashboard/analysis-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Histogram } from "@/components/dashboard/histogram";
import { ListingHandoff } from "@/components/dashboard/listing-handoff";
import { DEFAULT_FIXED_FEE, DEFAULT_FVF_RATE, computeNet } from "@/lib/fees";
import type { PriceBucket } from "@/lib/types";
import { cn } from "@/lib/utils";

const DEMO_PRODUCT = {
  title: "Nintendo Switch OLED — White (HEG-001) — Boxed, Excellent",
  searchQuery: "Nintendo Switch OLED White",
};

const DEMO_HISTOGRAM: PriceBucket[] = [
  { bucket: "210", count: 2 },
  { bucket: "220", count: 4 },
  { bucket: "230", count: 6 },
  { bucket: "240", count: 9 },
  { bucket: "250", count: 11 },
  { bucket: "260", count: 8 },
  { bucket: "270", count: 4 },
  { bucket: "280", count: 2 },
  { bucket: "290", count: 1 },
];

const DEMO = {
  prices: { quick: 235, recommended: 268, max: 305 },
  recommendedBucket: "260",
  median: 250,
  mean: 252,
  iqr: 30,
  sampleSize: 47,
  outliersRemoved: 4,
  matchConfidence: 0.92,
  pricingConfidence: 0.88,
  demand: "High" as const,
  perDayLabel: "3.4/day",
  trendPct: 6,
  windowDays: 14,
  explanation:
    "Cluster median is $250, but units with original box (like yours) sell 7% higher and clear in <3 days.",
  conditionBreakdown: [
    { condition: "New", median: 285, count: 9 },
    { condition: "Used · Excellent", median: 262, count: 26 },
    { condition: "Used · Good", median: 238, count: 8 },
  ],
  recentSales: [
    {
      price: 268,
      title: "Nintendo Switch OLED White Console + Box - Tested - Free Ship",
      condition: "Used · Excellent",
      ago: "2h ago",
    },
    {
      price: 245,
      title: "Nintendo Switch OLED Model HEG-001 White Used Good",
      condition: "Used · Good",
      ago: "1d ago",
    },
    {
      price: 295,
      title: "Nintendo Switch OLED White Console BRAND NEW Sealed",
      condition: "New",
      ago: "3d ago",
    },
  ],
};

export function SampleResult() {
  const [copied, setCopied] = useState(false);
  const [selectedCondition, setSelectedCondition] = useState<string | null>(
    null,
  );
  const [showChart, setShowChart] = useState(false);
  const chartAnchorRef = useRef<HTMLDivElement>(null);
  const chartInView = useInView(chartAnchorRef, { once: true, margin: "-60px" });
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (chartInView) setShowChart(true);
  }, [chartInView]);

  const copyTitle = async () => {
    try {
      await navigator.clipboard.writeText(DEMO_PRODUCT.title);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can fail in insecure contexts — silent fallback.
    }
  };

  const adjustedPrices = useMemo(() => {
    if (!selectedCondition) return DEMO.prices;
    const row = DEMO.conditionBreakdown.find(
      (r) => r.condition === selectedCondition,
    );
    if (!row || DEMO.median <= 0) return DEMO.prices;
    const ratio = row.median / DEMO.median;
    return {
      quick: Math.round(DEMO.prices.quick * ratio),
      recommended: Math.round(DEMO.prices.recommended * ratio),
      max: Math.round(DEMO.prices.max * ratio),
    };
  }, [selectedCondition]);

  const allSoldUrl = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(
    DEMO_PRODUCT.searchQuery,
  )}&LH_Sold=1&LH_Complete=1`;

  const badges = [
    {
      key: "match",
      className: "border border-navy/30 bg-navy/5 text-navy",
      icon: <CheckCircle2 className="mr-1 h-3 w-3" />,
      label: `${Math.round(DEMO.matchConfidence * 100)}% match`,
    },
    {
      key: "demand",
      className: "border border-tomato/30 bg-tomato/10 text-tomato",
      icon: <Flame className="mr-1 h-3 w-3" />,
      label: `${DEMO.demand} demand · ${DEMO.perDayLabel}`,
    },
    {
      key: "trend",
      className: "border border-navy/30 bg-navy/5 text-navy",
      icon: <ArrowUp className="mr-1 h-3 w-3" />,
      label: `${DEMO.trendPct}% 7d`,
    },
    {
      key: "sold",
      className: "border border-border/60",
      icon: null,
      label: `${DEMO.sampleSize} sold · ${DEMO.windowDays}d`,
    },
    {
      key: "outliers",
      className: "border border-border/60",
      icon: null,
      label: `${DEMO.outliersRemoved} outliers filtered`,
    },
  ];

  return (
    <section id="preview" className="relative py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={reducedMotion ? false : { opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6, ease: EASE_OUT }}
          className="mx-auto max-w-2xl text-center"
        >
          <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl">
            One photo. Three prices. Zero guesswork.
          </h2>
          <p className="mt-4 text-muted-foreground">
            Real Snapsold result for a Nintendo Switch OLED — based on{" "}
            {DEMO.sampleSize} recent eBay sold listings. Tap a condition to see
            the prices shift, or skip straight to a listing draft.
          </p>
        </motion.div>

        <div className="relative mx-auto mt-14 min-w-0 max-w-5xl overflow-x-clip">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10 opacity-60 blur-3xl sm:-inset-x-8 sm:-inset-y-8"
            style={{
              background:
                "radial-gradient(ellipse 50% 50% at 30% 50%, #f95738 0%, transparent 60%), radial-gradient(ellipse 55% 50% at 80% 50%, #f4d35e 0%, transparent 65%)",
            }}
          />

          <motion.div
            variants={cardEntrance}
            initial={reducedMotion ? false : "hidden"}
            whileInView={reducedMotion ? undefined : "visible"}
            viewport={{ once: true, margin: "-80px" }}
          >
            <Card className="overflow-hidden border-border/60 bg-card p-0 glow-ring">
              <div className="grid min-w-0 gap-0 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
                {/* LEFT */}
                <motion.div
                  variants={stagger}
                  initial={reducedMotion ? false : "hidden"}
                  whileInView={reducedMotion ? undefined : "visible"}
                  viewport={{ once: true, margin: "-60px" }}
                  className="min-w-0 border-border/60 p-4 sm:p-6 lg:border-r lg:p-8"
                >
                  <motion.div
                    variants={fadeUp}
                    className="flex items-center gap-2 text-xs text-muted-foreground"
                  >
                    <Sparkles className="h-3.5 w-3.5 text-tomato" />
                    AI-identified from photo
                  </motion.div>

                  <motion.h3
                    variants={fadeUp}
                    className="mt-2 text-lg font-semibold leading-snug tracking-tight"
                  >
                    {DEMO_PRODUCT.title}
                  </motion.h3>

                  <motion.div
                    variants={stagger}
                    className="mt-4 flex flex-wrap items-center gap-2"
                  >
                    {badges.map((badge) => (
                      <motion.div key={badge.key} variants={fadeUp}>
                        <Badge variant="secondary" className={badge.className}>
                          {badge.icon}
                          {badge.label}
                        </Badge>
                      </motion.div>
                    ))}
                  </motion.div>

                  <motion.div
                    variants={stagger}
                    className="mt-7 grid min-w-0 grid-cols-3 gap-2 sm:gap-3"
                  >
                    <AnimatedPriceTile
                      label="Quick"
                      value={adjustedPrices.quick}
                      sublabel="Sells in days"
                      tone="muted"
                      index={0}
                      animateOnMount
                    />
                    <AnimatedPriceTile
                      label="Recommended"
                      value={adjustedPrices.recommended}
                      sublabel="Best balance"
                      tone="brand"
                      index={1}
                      animateOnMount
                    />
                    <AnimatedPriceTile
                      label="Max"
                      value={adjustedPrices.max}
                      sublabel="Patient sellers"
                      tone="muted"
                      index={2}
                      animateOnMount
                    />
                  </motion.div>

                  <motion.div variants={fadeUp}>
                    <DemoFeeRow prices={adjustedPrices} />
                  </motion.div>

                  <motion.div variants={fadeUp}>
                    <DemoConditionPicker
                      rows={DEMO.conditionBreakdown}
                      overallMedian={DEMO.median}
                      selected={selectedCondition}
                      onSelect={setSelectedCondition}
                    />
                  </motion.div>

                  <motion.div variants={fadeUp} className="mt-6">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Listing title
                    </div>
                    <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-stretch">
                      <div
                        className="min-w-0 truncate rounded-lg border border-border/60 bg-muted/30 px-3 py-2 font-mono text-xs leading-relaxed text-navy sm:flex-1"
                        title={DEMO_PRODUCT.title}
                      >
                        {DEMO_PRODUCT.title}
                      </div>
                      <div className="flex min-w-0 gap-2 sm:shrink-0">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={copyTitle}
                          className="min-w-0 flex-1 gap-1.5 font-display font-semibold sm:flex-none"
                          aria-live="polite"
                        >
                          <ClipboardCopy className="h-4 w-4" />
                          {copied ? "Copied" : "Copy"}
                        </Button>
                        <ListingHandoff title={DEMO_PRODUCT.title} />
                      </div>
                    </div>
                  </motion.div>
                </motion.div>

                {/* RIGHT */}
                <motion.div
                  variants={stagger}
                  initial={reducedMotion ? false : "hidden"}
                  whileInView={reducedMotion ? undefined : "visible"}
                  viewport={{ once: true, margin: "-60px" }}
                  className="min-w-0 p-4 sm:p-6 lg:p-8"
                >
                  <motion.div
                    variants={fadeUp}
                    className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1"
                  >
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <TrendingUp className="h-4 w-4 text-tomato" />
                      Sold price distribution
                    </div>
                    <span className="text-xs text-muted-foreground">
                      last {DEMO.windowDays} days
                    </span>
                  </motion.div>

                  <motion.div ref={chartAnchorRef} variants={fadeUp} className="mt-6">
                    {showChart && (
                      <Histogram
                        buckets={DEMO_HISTOGRAM}
                        recommendedBucket={DEMO.recommendedBucket}
                      />
                    )}
                  </motion.div>

                  <motion.p
                    variants={fadeUp}
                    className="mt-5 rounded-lg border border-border/60 bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground"
                  >
                    <span className="font-semibold text-foreground">
                      Why we recommend ${adjustedPrices.recommended}
                      {selectedCondition ? ` for ${selectedCondition}` : ""}:
                    </span>{" "}
                    {DEMO.explanation}
                  </motion.p>

                  <motion.dl
                    variants={stagger}
                    className="mt-4 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4"
                  >
                    {[
                      { label: "Median", value: `$${DEMO.median}` },
                      { label: "Mean", value: `$${DEMO.mean}` },
                      { label: "IQR", value: `$${DEMO.iqr}` },
                      {
                        label: "Confidence",
                        value: `${Math.round(DEMO.pricingConfidence * 100)}%`,
                      },
                    ].map((stat) => (
                      <motion.div key={stat.label} variants={fadeUp}>
                        <Stat label={stat.label} value={stat.value} />
                      </motion.div>
                    ))}
                  </motion.dl>

                  <motion.div variants={fadeUp} className="mt-5">
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
                    <motion.ul
                      variants={stagger}
                      className="mt-2 space-y-1.5"
                    >
                      {DEMO.recentSales.map((s, i) => (
                        <motion.li key={`${s.title}-${i}`} variants={fadeUp}>
                          <motion.a
                            href={allSoldUrl}
                            target="_blank"
                            rel="noreferrer"
                            whileHover={
                              reducedMotion
                                ? undefined
                                : { x: 4, transition: { duration: 0.18, ease: EASE_OUT } }
                            }
                            className="flex items-center gap-3 rounded-lg border border-border/60 bg-muted/30 px-3 py-1.5 transition-colors hover:border-tomato/40 hover:bg-tomato/5"
                            title={s.title}
                          >
                            <span className="w-12 shrink-0 text-right font-mono text-sm font-bold tabular-nums text-navy">
                              ${s.price}
                            </span>
                            <span className="min-w-0 flex-1 truncate text-xs text-foreground">
                              {s.title}
                            </span>
                            <span className="hidden shrink-0 text-[10px] uppercase tracking-wider text-muted-foreground sm:inline">
                              {s.condition}
                            </span>
                            <span className="shrink-0 text-[10px] text-muted-foreground">
                              {s.ago}
                            </span>
                          </motion.a>
                        </motion.li>
                      ))}
                    </motion.ul>
                  </motion.div>
                </motion.div>
              </div>
            </Card>
          </motion.div>
        </div>
      </div>
    </section>
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

function DemoConditionPicker({
  rows,
  overallMedian,
  selected,
  onSelect,
}: {
  rows: Array<{ condition: string; median: number; count: number }>;
  overallMedian: number;
  selected: string | null;
  onSelect: (c: string | null) => void;
}) {
  const reducedMotion = useReducedMotion();

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
        {rows.map((r, i) => {
          const isActive = selected === r.condition;
          const delta =
            overallMedian > 0
              ? Math.round(((r.median - overallMedian) / overallMedian) * 100)
              : 0;
          return (
            <motion.li
              key={r.condition}
              initial={reducedMotion ? false : { opacity: 0, x: -12 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-20px" }}
              transition={{ delay: 0.08 * i, duration: 0.4, ease: EASE_OUT }}
            >
              <motion.button
                type="button"
                onClick={() => onSelect(isActive ? null : r.condition)}
                aria-pressed={isActive}
                whileHover={
                  reducedMotion
                    ? undefined
                    : { scale: 1.01, transition: { duration: 0.15, ease: EASE_OUT } }
                }
                whileTap={reducedMotion ? undefined : { scale: 0.99 }}
                className={cn(
                  "flex w-full flex-col gap-1 rounded-lg border px-3 py-1.5 text-left transition-colors sm:flex-row sm:items-center sm:justify-between sm:gap-3",
                  isActive
                    ? "border-tomato/50 bg-tomato/10 ring-1 ring-tomato/20"
                    : "border-border/60 bg-muted/30 hover:border-tomato/30 hover:bg-tomato/5",
                )}
              >
                <span className="truncate text-xs font-medium text-navy">
                  {r.condition}
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
              </motion.button>
            </motion.li>
          );
        })}
      </ul>
      {selected && (
        <motion.p
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="mt-2 overflow-hidden text-[10px] leading-relaxed text-muted-foreground"
        >
          Prices above are scaled for{" "}
          <span className="font-semibold text-foreground">{selected}</span> —
          biased from the overall median (${overallMedian}) by this
          condition&apos;s sample.
        </motion.p>
      )}
    </div>
  );
}

function DemoFeeRow({
  prices,
}: {
  prices: { quick: number; recommended: number; max: number };
}) {
  const q = computeNet(prices.quick);
  const r = computeNet(prices.recommended);
  const m = computeNet(prices.max);
  const rateLabel = `~${Math.round(DEFAULT_FVF_RATE * 1000) / 10}% + $${DEFAULT_FIXED_FEE.toFixed(2)}`;

  return (
    <div className="mt-3 rounded-xl border border-border/60 bg-muted/20 p-2.5 sm:p-3">
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          <Wallet className="h-3 w-3 shrink-0 text-tomato" />
          After eBay fees
        </div>
        <span
          className="hidden min-[400px]:inline text-[10px] text-muted-foreground/80"
          title="eBay Final Value Fee + per-order fixed fee. Real rate varies by category and store level."
        >
          {rateLabel}
        </span>
      </div>
      <dl className="mt-2 grid min-w-0 grid-cols-3 gap-2 sm:gap-3">
        <AnimatedNetCell label="Quick net" net={q.net} delay={0.2} />
        <AnimatedNetCell label="Recommended net" net={r.net} highlight delay={0.28} />
        <AnimatedNetCell label="Max net" net={m.net} delay={0.36} />
      </dl>
    </div>
  );
}
