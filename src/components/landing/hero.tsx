"use client";

import { motion, useReducedMotion } from "motion/react";
import { HeroDropzone } from "./hero-dropzone";
import { EASE_OUT, fadeUp, stagger } from "@/components/dashboard/analysis-motion";

export function Hero() {
  const reducedMotion = useReducedMotion();

  return (
    <section className="relative isolate overflow-hidden">
      {/* Static ambient glow — no JS animation (blur + motion = jank) */}
      {!reducedMotion && (
        <>
          <div
            aria-hidden
            className="pointer-events-none absolute -left-24 top-8 -z-10 h-72 w-72 rounded-full opacity-35 blur-3xl"
            style={{
              background:
                "radial-gradient(circle, #f95738 0%, transparent 70%)",
            }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -right-16 top-32 -z-10 h-80 w-80 rounded-full opacity-30 blur-3xl"
            style={{
              background:
                "radial-gradient(circle, #f4d35e 0%, transparent 70%)",
            }}
          />
        </>
      )}

      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.07]"
        style={{
          backgroundImage:
            "linear-gradient(to right, #083d77 1px, transparent 1px), linear-gradient(to bottom, #083d77 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          maskImage:
            "radial-gradient(ellipse 60% 50% at 50% 0%, black 40%, transparent 80%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 60% 50% at 50% 0%, black 40%, transparent 80%)",
        }}
      />

      <div className="mx-auto max-w-7xl px-4 pb-20 pt-16 sm:px-6 sm:pt-24 lg:px-8 lg:pb-28 lg:pt-32">
        <motion.div
          variants={stagger}
          initial={reducedMotion ? false : "hidden"}
          animate={reducedMotion ? undefined : "visible"}
          className="mx-auto flex max-w-3xl flex-col items-center text-center"
        >
          <motion.div
            variants={fadeUp}
            className="mb-6 inline-flex items-center gap-2 rounded-full border border-tomato/25 bg-tomato/10 px-4 py-1.5 text-xs font-medium text-tomato"
          >
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-tomato" />
            Free while in beta · No credit card
          </motion.div>

          <motion.h1
            variants={fadeUp}
            className="text-balance text-4xl font-extrabold tracking-tighter sm:text-5xl md:text-6xl lg:text-7xl"
          >
            Know what your stuff
            <br />
            <span
              className={
                reducedMotion
                  ? "text-gradient-brand"
                  : "text-gradient-brand-flow"
              }
            >
              actually sells for.
            </span>
          </motion.h1>

          <motion.p
            variants={fadeUp}
            className="mt-6 max-w-xl text-pretty text-base text-muted-foreground sm:text-lg"
          >
            Snap a photo, scan a barcode, or type a name. Snapsold analyses
            real eBay sold listings and gives you a quick-sale, recommended,
            and max-profit price — in seconds.
          </motion.p>

          <motion.div variants={fadeUp} className="mt-10 w-full">
            <HeroDropzone />
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
