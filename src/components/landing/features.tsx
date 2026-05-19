"use client";

import { motion } from "motion/react";
import {
  BarChart3,
  Brain,
  ImageUp,
  ScanBarcode,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Accent = "tomato" | "sandy" | "navy" | "gold";

interface Feature {
  /** Top-left + bottom-right "rank" — A, 2, 3, … like a real card. */
  rank: string;
  icon: typeof ImageUp;
  title: string;
  body: string;
  accent: Accent;
}

/**
 * Six features rendered as playing cards. Card visual order
 * intentionally mirrors a real hand — Ace first (flagship), then
 * 2–6 in suit rotation so the row reads like a fanned-out deck.
 * The body text is what the card "reveals" on hover; on touch
 * devices (no hover) it stays visible by default so mobile
 * visitors still get the full pitch without needing interaction.
 */
const FEATURES: ReadonlyArray<Feature> = [
  {
    rank: "A",
    icon: ImageUp,
    title: "Photo → price",
    body: "Drop a picture or screenshot. Gemini 2.5 Flash identifies brand, model, and condition — then we fetch live eBay sold data.",
    accent: "tomato",
  },
  {
    rank: "2",
    icon: ScanBarcode,
    title: "Barcode scan",
    body: "Use your phone camera. UPC and EAN codes resolve in milliseconds, right in the browser — no app install needed.",
    accent: "sandy",
  },
  {
    rank: "3",
    icon: BarChart3,
    title: "Real sold listings",
    body: "We query the last 14 days of eBay completed sales — actual transaction prices, not what someone hopes to get.",
    accent: "tomato",
  },
  {
    rank: "4",
    icon: Brain,
    title: "Outlier-filtered",
    body: "IQR filtering removes joke listings, broken-for-parts, and obvious scams before we compute your number.",
    accent: "gold",
  },
  {
    rank: "5",
    icon: Zap,
    title: "Three prices",
    body: "Quick-sale, recommended, and max-profit. Pick the strategy that matches your timeline.",
    accent: "navy",
  },
  {
    rank: "6",
    icon: ShieldCheck,
    title: "Honest confidence",
    body: "Every result tells you how sure we are. Low confidence? We say so — no false certainty.",
    accent: "tomato",
  },
];

export function Features() {
  return (
    <section id="features" className="relative py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl">
            Built for resellers who hate guessing.
          </h2>
          <p className="mt-4 text-muted-foreground">
            Six things every pricing tool should do — and most don&apos;t.
            Hover any card to flip it over.
          </p>
        </div>

        {/*
          `perspective` on the wrapper gives every card the same 3D
          vanishing point, so hover tilts look like they share a
          virtual "table" rather than each card pivoting in isolation.
          `overflow-visible` is important — hovered cards scale up
          and lift, and we don't want the grid to crop them.
        */}
        <div
          className="mt-14 grid grid-cols-1 gap-5 overflow-visible sm:grid-cols-2 lg:grid-cols-3 lg:gap-6"
          style={{ perspective: 1200 }}
        >
          {FEATURES.map((feature) => (
            <PlayingCard key={feature.title} feature={feature} />
          ))}
        </div>
      </div>
    </section>
  );
}

/** Tailwind class bundles per accent — keeps the JSX readable. */
const ACCENT: Record<
  Accent,
  {
    /** Foreground for icon + corner ranks. */
    fg: string;
    /** Background of the center icon tile. */
    tile: string;
    /** Ring on the center icon tile. */
    tileRing: string;
    /** Resting card border color. */
    border: string;
    /** Card border color when hovered (via group-hover). */
    hoverBorder: string;
    /** Coloured shadow under the card on hover. */
    hoverShadow: string;
  }
> = {
  tomato: {
    fg: "text-tomato",
    tile: "bg-tomato/10",
    tileRing: "ring-tomato/30",
    border: "border-tomato/20",
    hoverBorder: "group-hover:border-tomato/70",
    hoverShadow: "group-hover:shadow-tomato/25",
  },
  sandy: {
    fg: "text-sandy",
    tile: "bg-sandy/15",
    tileRing: "ring-sandy/40",
    border: "border-sandy/20",
    hoverBorder: "group-hover:border-sandy/70",
    hoverShadow: "group-hover:shadow-sandy/25",
  },
  gold: {
    fg: "text-navy",
    tile: "bg-gold/30",
    tileRing: "ring-gold/50",
    border: "border-gold/30",
    hoverBorder: "group-hover:border-gold/80",
    hoverShadow: "group-hover:shadow-gold/30",
  },
  navy: {
    fg: "text-navy",
    tile: "bg-navy/10",
    tileRing: "ring-navy/30",
    border: "border-navy/20",
    hoverBorder: "group-hover:border-navy/70",
    hoverShadow: "group-hover:shadow-navy/20",
  },
};

function PlayingCard({ feature }: { feature: Feature }) {
  const { rank, icon: Icon, title, body, accent } = feature;
  const a = ACCENT[accent];

  return (
    <motion.div
      initial="rest"
      whileHover="hover"
      animate="rest"
      variants={{
        rest: { y: 0, scale: 1, rotateX: 0, rotateZ: 0 },
        hover: { y: -16, scale: 1.045, rotateX: 6, rotateZ: -0.6 },
      }}
      transition={{ type: "spring", stiffness: 260, damping: 22 }}
      // `transformStyle: preserve-3d` keeps the rotateX honest; the
      // wrapper's `perspective` then renders it as a tilt, not a skew.
      style={{ transformStyle: "preserve-3d" }}
      className={cn(
        "group relative aspect-[4/5] cursor-default rounded-2xl border-2 bg-card",
        "shadow-md shadow-navy/10 transition-[box-shadow,border-color] duration-300",
        "hover:shadow-2xl",
        a.border,
        a.hoverBorder,
        a.hoverShadow,
      )}
    >
      {/*
        Subtle warm sheen behind the icon — like the off-white
        gloss real cards have under a light. Painted as a radial
        gradient pseudo-layer so it doesn't interfere with the
        card's own bg-card token / dark-mode swap.
      */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-2xl opacity-70"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 60% 50% at 50% 38%, rgba(244,211,94,0.10) 0%, transparent 70%)",
        }}
      />

      {/* Corner rank — top-left */}
      <div
        className={cn(
          "absolute left-3 top-3 flex flex-col items-center gap-0.5 leading-none",
          a.fg,
        )}
      >
        <span className="font-display text-base font-extrabold tabular-nums">
          {rank}
        </span>
        <Icon className="h-3.5 w-3.5" strokeWidth={2.5} />
      </div>

      {/* Corner rank — bottom-right (mirrored, like real playing cards) */}
      <div
        className={cn(
          "absolute bottom-3 right-3 flex rotate-180 flex-col items-center gap-0.5 leading-none",
          a.fg,
        )}
      >
        <span className="font-display text-base font-extrabold tabular-nums">
          {rank}
        </span>
        <Icon className="h-3.5 w-3.5" strokeWidth={2.5} />
      </div>

      {/* Main face */}
      <div className="relative flex h-full flex-col items-center justify-between px-6 pb-14 pt-14 text-center">
        {/* Top group: icon medallion + title (vertically centered in the
            upper half so it stays visually anchored whether the body
            is revealed or not — no jumpy reflow on hover). */}
        <div className="flex flex-1 flex-col items-center justify-center">
          <motion.div
            variants={{
              rest: { scale: 1, rotate: 0 },
              hover: { scale: 1.1, rotate: -3 },
            }}
            transition={{ type: "spring", stiffness: 260, damping: 18 }}
            className={cn(
              "grid h-16 w-16 place-items-center rounded-2xl ring-1",
              a.tile,
              a.tileRing,
            )}
          >
            <Icon className={cn("h-8 w-8", a.fg)} strokeWidth={2.2} />
          </motion.div>

          <h3 className="mt-5 text-lg font-bold tracking-tight">{title}</h3>
        </div>

        {/*
          Body reveal:
            • <lg screens: always visible (no hover on touch devices,
              so the marketing copy must be there by default).
            • lg+ screens: hidden by default; on group hover the
              parent card lift triggers this to fade up + in.
          The pure-CSS approach plays nice with the parent's
          framer-motion transform without fighting over the
          `style.opacity` property.
        */}
        <p
          className={cn(
            "min-h-[60px] text-[13px] leading-relaxed text-muted-foreground",
            "transition-[opacity,transform] duration-300 ease-out",
            "lg:translate-y-2 lg:opacity-0",
            "lg:group-hover:translate-y-0 lg:group-hover:opacity-100",
          )}
        >
          {body}
        </p>
      </div>
    </motion.div>
  );
}
