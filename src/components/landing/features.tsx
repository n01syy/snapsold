"use client";

import {
  ArrowUpRight,
  BarChart3,
  Brain,
  ImageUp,
  ScanBarcode,
  ShieldCheck,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { EASE_OUT, fadeUp, stagger } from "@/components/dashboard/analysis-motion";
import { cn } from "@/lib/utils";

type Accent = "tomato" | "sandy" | "navy" | "gold";

interface Feature {
  id: string;
  icon: LucideIcon;
  title: string;
  body: string;
  accent: Accent;
}

const FEATURES = {
  photo: {
    id: "photo",
    icon: ImageUp,
    title: "Photo → price",
    body: "Drop a picture or screenshot. Gemini identifies brand, model, and condition — then we fetch live eBay sold data.",
    accent: "tomato",
  },
  barcode: {
    id: "barcode",
    icon: ScanBarcode,
    title: "Barcode scan",
    body: "Use your phone camera. UPC and EAN codes resolve in milliseconds, right in the browser.",
    accent: "sandy",
  },
  sold: {
    id: "sold",
    icon: BarChart3,
    title: "Real sold listings",
    body: "We query the last 14 days of eBay completed sales — actual transaction prices, not asking prices.",
    accent: "tomato",
  },
  outlier: {
    id: "outlier",
    icon: Brain,
    title: "Outlier-filtered",
    body: "IQR filtering removes joke listings, broken-for-parts, and obvious scams before we compute your number.",
    accent: "gold",
  },
  prices: {
    id: "prices",
    icon: Zap,
    title: "Three prices",
    body: "Quick-sale, recommended, and max-profit. Pick the strategy that matches your timeline.",
    accent: "navy",
  },
  confidence: {
    id: "confidence",
    icon: ShieldCheck,
    title: "Honest confidence",
    body: "Every result tells you how sure we are. Low confidence? We say so — no false certainty.",
    accent: "tomato",
  },
} as const satisfies Record<string, Feature>;

const ACCENT: Record<
  Accent,
  { fg: string; bg: string; border: string; glow: string }
> = {
  tomato: {
    fg: "text-tomato",
    bg: "bg-tomato/10",
    border: "border-tomato/25",
    glow: "group-hover:shadow-tomato/10",
  },
  sandy: {
    fg: "text-sandy",
    bg: "bg-sandy/15",
    border: "border-sandy/30",
    glow: "group-hover:shadow-sandy/10",
  },
  gold: {
    fg: "text-navy",
    bg: "bg-gold/25",
    border: "border-gold/40",
    glow: "group-hover:shadow-gold/15",
  },
  navy: {
    fg: "text-navy",
    bg: "bg-navy/8",
    border: "border-navy/20",
    glow: "group-hover:shadow-navy/10",
  },
};

const gridCell = fadeUp;

function BentoCell({
  feature,
  className,
  children,
}: {
  feature: Feature;
  className?: string;
  children: React.ReactNode;
}) {
  const { icon: Icon, title, body, accent } = feature;
  const a = ACCENT[accent];
  const reducedMotion = useReducedMotion();

  return (
    <motion.div
      variants={gridCell}
      className={cn(
        "group relative flex min-h-[220px] flex-col bg-card p-6 sm:min-h-[240px] sm:p-7",
        "transition-shadow duration-500 hover:shadow-lg",
        a.glow,
        className,
      )}
    >
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-navy/[0.03] opacity-0 transition-opacity duration-500 group-hover:opacity-100"
      />

      <div className="relative z-10 flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2.5">
            <span
              className={cn(
                "grid h-8 w-8 shrink-0 place-items-center rounded-lg border",
                a.bg,
                a.border,
              )}
            >
              <Icon className={cn("h-4 w-4", a.fg)} strokeWidth={2.2} />
            </span>
            <h3 className="text-base font-semibold tracking-tight sm:text-lg">
              {title}
            </h3>
          </div>
          <p className="mt-2.5 max-w-md text-sm leading-relaxed text-muted-foreground">
            {body}
          </p>
        </div>

        <motion.span
          aria-hidden
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-border/70 bg-muted/40 text-muted-foreground"
          whileHover={reducedMotion ? undefined : { scale: 1.06, rotate: 45 }}
          transition={{ duration: 0.18, ease: EASE_OUT }}
        >
          <ArrowUpRight className="h-3.5 w-3.5" />
        </motion.span>
      </div>

      <div className="relative z-10 mt-auto pt-8">{children}</div>
    </motion.div>
  );
}

function PhotoViz({ reducedMotion }: { reducedMotion: boolean | null }) {
  return (
    <div className="rounded-xl border border-border/60 bg-muted/30 p-3">
      <div className="flex items-center gap-2 border-b border-border/50 pb-2">
        <span className="h-2 w-2 rounded-full bg-tomato/70" />
        <span className="h-2 w-2 rounded-full bg-gold/80" />
        <span className="h-2 w-2 rounded-full bg-navy/30" />
      </div>
      <div className="mt-3 flex items-center gap-3 rounded-lg border border-dashed border-tomato/30 bg-card px-3 py-4">
        <motion.div
          initial={reducedMotion ? false : { opacity: 0.85, scale: 0.92 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.35, delay: 0.12, ease: EASE_OUT }}
          className="grid h-10 w-10 place-items-center rounded-lg bg-tomato/10"
        >
          <ImageUp className="h-5 w-5 text-tomato" />
        </motion.div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium">Nintendo Switch OLED</p>
          <p className="text-[11px] text-tomato">Identifying…</p>
        </div>
      </div>
    </div>
  );
}

function BarcodeViz({ reducedMotion }: { reducedMotion: boolean | null }) {
  const bars = [3, 5, 2, 6, 4, 3, 7, 2, 5, 4, 3, 6];

  return (
    <div className="relative overflow-hidden rounded-xl border border-border/60 bg-muted/30 px-4 py-5">
      <div className="flex h-12 items-end justify-center gap-[3px]">
        {bars.map((h, i) => (
          <motion.div
            key={i}
            initial={reducedMotion ? false : { scaleY: 0 }}
            whileInView={{ scaleY: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.03 * i, duration: 0.3, ease: EASE_OUT }}
            className="w-[3px] rounded-sm bg-navy/70"
            style={{ height: `${h * 5}px`, transformOrigin: "bottom" }}
          />
        ))}
      </div>
      {!reducedMotion && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-3 top-1/2 h-0.5 -translate-y-1/2 bg-gradient-to-r from-transparent via-sandy/80 to-transparent motion-safe:animate-[scan_2.2s_linear_infinite]"
        />
      )}
      <p className="mt-3 text-center font-mono text-[11px] text-muted-foreground">
        045496883411
      </p>
    </div>
  );
}

function SoldListingsViz({ reducedMotion }: { reducedMotion: boolean | null }) {
  const bars = [42, 68, 55, 82, 61, 74, 48, 88, 58];

  return (
    <div className="flex h-24 items-end justify-center gap-1.5 rounded-xl border border-border/60 bg-muted/30 px-4 pb-3 pt-4">
      {bars.map((h, i) => (
        <motion.div
          key={i}
          initial={reducedMotion ? false : { scaleY: 0, opacity: 0 }}
          whileInView={{ scaleY: 1, opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.025 * i, duration: 0.35, ease: EASE_OUT }}
          className={cn(
            "w-2.5 rounded-sm",
            i === 4 ? "bg-tomato" : "bg-navy/25",
          )}
          style={{ height: `${h}%`, transformOrigin: "bottom" }}
        />
      ))}
    </div>
  );
}

function OutlierViz({ reducedMotion }: { reducedMotion: boolean | null }) {
  const dots = [
    { x: 12, y: 55, outlier: false },
    { x: 28, y: 48, outlier: false },
    { x: 44, y: 52, outlier: false },
    { x: 58, y: 50, outlier: false },
    { x: 72, y: 47, outlier: false },
    { x: 86, y: 51, outlier: false },
    { x: 22, y: 18, outlier: true },
    { x: 78, y: 82, outlier: true },
  ];

  return (
    <div className="relative h-24 rounded-xl border border-border/60 bg-muted/30">
      {dots.map((dot, i) => (
        <motion.div
          key={i}
          initial={reducedMotion ? false : { scale: 0, opacity: 0 }}
          whileInView={
            dot.outlier
              ? { scale: 0.6, opacity: 0.25 }
              : { scale: 1, opacity: 1 }
          }
          viewport={{ once: true }}
          transition={{ delay: 0.04 * i, duration: 0.3, ease: EASE_OUT }}
          className={cn(
            "absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full",
            dot.outlier ? "bg-sandy/50" : "bg-navy/60",
          )}
          style={{ left: `${dot.x}%`, top: `${dot.y}%` }}
        />
      ))}
      <motion.div
        initial={reducedMotion ? false : { scaleX: 0 }}
        whileInView={{ scaleX: 1 }}
        viewport={{ once: true }}
        transition={{ delay: 0.4, duration: 0.5, ease: EASE_OUT }}
        className="absolute bottom-6 left-[10%] right-[10%] h-px origin-left bg-navy/20"
      />
    </div>
  );
}

function ThreePricesViz({ reducedMotion }: { reducedMotion: boolean | null }) {
  const tiers = [
    { label: "Quick", value: "$218", accent: "border-navy/20 bg-navy/5" },
    { label: "Rec.", value: "$249", accent: "border-tomato/40 bg-tomato/10 scale-105" },
    { label: "Max", value: "$279", accent: "border-navy/20 bg-navy/5" },
  ];

  return (
    <div className="flex flex-wrap items-end justify-center gap-3 sm:justify-start">
      {tiers.map((tier, i) => (
        <motion.div
          key={tier.label}
          initial={reducedMotion ? false : { opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.08 * i, duration: 0.35, ease: EASE_OUT }}
          className={cn(
            "rounded-xl border px-4 py-3 text-center shadow-sm",
            tier.accent,
            i === 1 && "ring-2 ring-tomato/20",
          )}
        >
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            {tier.label}
          </p>
          <p className={cn("mt-0.5 text-lg font-bold tabular-nums", i === 1 && "text-tomato")}>
            {tier.value}
          </p>
        </motion.div>
      ))}
    </div>
  );
}

function ConfidenceViz({ reducedMotion }: { reducedMotion: boolean | null }) {
  const radius = 34;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="flex items-center justify-center gap-4 sm:justify-end">
      <div className="relative grid h-20 w-20 place-items-center">
        <svg className="absolute inset-0 -rotate-90" viewBox="0 0 80 80">
          <circle
            cx="40"
            cy="40"
            r={radius}
            fill="none"
            stroke="currentColor"
            className="text-border/80"
            strokeWidth="6"
          />
          <motion.circle
            cx="40"
            cy="40"
            r={radius}
            fill="none"
            stroke="currentColor"
            className="text-tomato"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={
              reducedMotion
                ? { strokeDashoffset: circumference * 0.13 }
                : { strokeDashoffset: circumference }
            }
            whileInView={{ strokeDashoffset: circumference * 0.13 }}
            viewport={{ once: true }}
            transition={{ duration: 0.65, delay: 0.15, ease: EASE_OUT }}
          />
        </svg>
        <span className="text-lg font-bold tabular-nums text-tomato">87%</span>
      </div>
      <div className="hidden text-right sm:block">
        <p className="text-sm font-medium">High confidence</p>
        <p className="text-xs text-muted-foreground">28 sold · 14-day window</p>
      </div>
    </div>
  );
}

function HeroCell() {
  return (
    <motion.div
      variants={fadeUp}
      className="flex min-h-[220px] flex-col justify-between bg-card p-6 sm:col-span-2 sm:min-h-[240px] sm:p-8 lg:col-span-1 lg:row-span-2 lg:min-h-0"
    >
      <div>
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Snapsold features
        </p>
        <h2 className="mt-4 text-2xl font-bold tracking-tighter sm:text-3xl lg:text-4xl">
          Built for resellers who hate guessing.
        </h2>
        <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted-foreground sm:text-base">
          Six things every pricing tool should do — and most don&apos;t.
          Real sold data, honest confidence, listing-ready in seconds.
        </p>
      </div>

      <div className="mt-8 hidden items-center gap-3 lg:flex">
        {["Identify", "Analyse", "Price"].map((step, i) => (
          <div key={step} className="flex items-center gap-3">
            <span className="rounded-full border border-border/60 bg-muted/40 px-3 py-1 text-xs font-medium">
              {step}
            </span>
            {i < 2 && (
              <span aria-hidden className="text-muted-foreground/60">
                →
              </span>
            )}
          </div>
        ))}
      </div>
    </motion.div>
  );
}

export function Features() {
  const reducedMotion = useReducedMotion();

  return (
    <section id="features" className="relative py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          variants={stagger}
          initial={reducedMotion ? false : "hidden"}
          whileInView={reducedMotion ? undefined : "visible"}
          viewport={{ once: true, margin: "-80px" }}
          className="overflow-hidden rounded-2xl border border-border/60 bg-border/40 shadow-sm shadow-navy/5"
        >
          <div className="grid grid-cols-1 gap-px sm:grid-cols-2 lg:grid-cols-3">
            <HeroCell />

            <BentoCell feature={FEATURES.photo}>
              <PhotoViz reducedMotion={reducedMotion} />
            </BentoCell>

            <BentoCell feature={FEATURES.barcode}>
              <BarcodeViz reducedMotion={reducedMotion} />
            </BentoCell>

            <BentoCell feature={FEATURES.sold}>
              <SoldListingsViz reducedMotion={reducedMotion} />
            </BentoCell>

            <BentoCell feature={FEATURES.outlier}>
              <OutlierViz reducedMotion={reducedMotion} />
            </BentoCell>

            <BentoCell feature={FEATURES.prices} className="sm:col-span-2 lg:col-span-2">
              <ThreePricesViz reducedMotion={reducedMotion} />
            </BentoCell>

            <BentoCell feature={FEATURES.confidence}>
              <ConfidenceViz reducedMotion={reducedMotion} />
            </BentoCell>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
