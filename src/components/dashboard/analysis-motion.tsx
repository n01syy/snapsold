"use client";

import {
  animate,
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "motion/react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export const EASE_OUT = [0.22, 1, 0.36, 1] as const;

/** Lighter stagger — fewer elements mid-flight at once. */
export const stagger = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.05, delayChildren: 0.08 },
  },
};

export const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: EASE_OUT },
  },
};

export const cardEntrance = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: EASE_OUT },
  },
};

/**
 * Count-up that writes via motion values — no React re-render per frame.
 */
export function AnimatedPrice({
  value,
  className,
  delay = 0,
  animateOnMount = true,
}: {
  value: number;
  className?: string;
  delay?: number;
  animateOnMount?: boolean;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const reducedMotion = useReducedMotion();
  const ready = animateOnMount ? inView : true;
  const motionValue = useMotionValue(reducedMotion ? value : 0);
  const display = useTransform(motionValue, (v) => `$${Math.round(v)}`);

  useEffect(() => {
    if (!ready) return;
    if (reducedMotion) {
      motionValue.jump(value);
      return;
    }
    const from = motionValue.get();
    const controls = animate(motionValue, value, {
      duration: from === 0 ? 0.55 : 0.35,
      delay: from === 0 ? delay : 0,
      ease: EASE_OUT,
    });
    return () => controls.stop();
  }, [ready, value, reducedMotion, delay, motionValue]);

  return (
    <motion.span ref={ref} className={className}>
      {display}
    </motion.span>
  );
}

export function AnimatedPriceTile({
  label,
  value,
  sublabel,
  tone,
  index,
  animateOnMount = false,
}: {
  label: string;
  value: number;
  sublabel: string;
  tone: "brand" | "muted";
  index: number;
  animateOnMount?: boolean;
}) {
  const isBrand = tone === "brand";
  const reducedMotion = useReducedMotion();
  const [pulseReady, setPulseReady] = useState(reducedMotion === true);

  useEffect(() => {
    if (reducedMotion) return;
    const t = window.setTimeout(() => setPulseReady(true), 700);
    return () => window.clearTimeout(t);
  }, [reducedMotion]);

  const inner = (
    <div
      className={cn(
        "min-w-0 rounded-xl border p-2 sm:p-3",
        isBrand
          ? "border-tomato/40 bg-tomato/10 ring-1 ring-tomato/30"
          : "border-border/60 bg-muted/30",
      )}
    >
      <div className="truncate text-[10px] font-semibold uppercase tracking-wider text-muted-foreground sm:text-[11px]">
        {label === "Recommended" ? (
          <>
            <span className="sm:hidden">Rec.</span>
            <span className="hidden sm:inline">Recommended</span>
          </>
        ) : (
          label
        )}
      </div>
      <div
        className={cn(
          "mt-1 text-lg font-bold leading-none tracking-tight tabular-nums sm:text-2xl",
          isBrand && "text-tomato",
        )}
      >
        <AnimatedPrice
          value={value}
          delay={0.1 + index * 0.07}
          animateOnMount={animateOnMount}
        />
      </div>
      <div className="mt-1 truncate text-[10px] leading-snug text-muted-foreground sm:text-[11px]">
        {sublabel}
      </div>
    </div>
  );

  if (!isBrand || reducedMotion) {
    return (
      <motion.div variants={fadeUp} className="min-w-0">
        {inner}
      </motion.div>
    );
  }

  return (
    <motion.div variants={fadeUp} className="relative min-w-0 rounded-xl">
      {pulseReady && (
        <motion.span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-xl ring-2 ring-tomato/25"
          initial={{ opacity: 0.35, scale: 1 }}
          animate={{ opacity: [0.35, 0.65, 0.35], scale: [1, 1.015, 1] }}
          transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
        />
      )}
      {inner}
    </motion.div>
  );
}

export function AnimatedNetCell({
  label,
  net,
  highlight,
  delay = 0,
}: {
  label: string;
  net: number;
  highlight?: boolean;
  delay?: number;
}) {
  const shortLabel =
    label === "Recommended net"
      ? "Rec."
      : label === "Quick net"
        ? "Quick"
        : label === "Max net"
          ? "Max"
          : label;

  return (
    <div className="min-w-0">
      <dt className="truncate text-[10px] uppercase tracking-wider text-muted-foreground">
        <span className="sm:hidden">{shortLabel}</span>
        <span className="hidden sm:inline">{label}</span>
      </dt>
      <dd
        className={cn(
          "mt-0.5 text-sm font-bold leading-none tracking-tight tabular-nums sm:text-base",
          highlight && "text-tomato",
        )}
      >
        <AnimatedPrice
          value={Math.round(net)}
          delay={delay}
          animateOnMount={false}
        />
      </dd>
    </div>
  );
}
