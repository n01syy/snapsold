"use client";

import { Camera, Cpu, DollarSign, type LucideIcon } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { EASE_OUT, fadeUp, stagger } from "@/components/dashboard/analysis-motion";

const STEPS: ReadonlyArray<{
  icon: LucideIcon;
  title: string;
  body: string;
}> = [
  {
    icon: Camera,
    title: "1. Capture",
    body: "Photo, barcode, or product name. Whichever you have on hand.",
  },
  {
    icon: Cpu,
    title: "2. Analyse",
    body: "We identify the product, pull eBay sold listings, and strip outliers.",
  },
  {
    icon: DollarSign,
    title: "3. Price",
    body: "Three price points, a confidence score, and a ready-to-paste listing title.",
  },
];

function StepItem({
  icon: Icon,
  title,
  body,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
}) {
  return (
    <motion.li
      variants={fadeUp}
      className="group relative flex flex-col items-center text-center"
    >
      <div className="relative z-10 grid h-12 w-12 place-items-center rounded-full border border-tomato/30 bg-card shadow-sm shadow-navy/5 ring-4 ring-background transition-colors duration-200 group-hover:border-tomato/50">
        <Icon className="h-5 w-5 text-tomato" strokeWidth={2.2} />
      </div>

      <h3 className="mt-4 font-semibold tracking-tight">{title}</h3>
      <p className="mt-2 max-w-xs text-sm text-muted-foreground">{body}</p>
    </motion.li>
  );
}

export function HowItWorks() {
  const reducedMotion = useReducedMotion();

  return (
    <section id="how-it-works" className="relative py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={reducedMotion ? false : { opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.4, ease: EASE_OUT }}
          className="mx-auto max-w-2xl text-center"
        >
          <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl">
            From mystery item to listing-ready, in under 10 seconds.
          </h2>
        </motion.div>

        <div className="relative mx-auto mt-14 max-w-4xl">
          <motion.div
            aria-hidden
            initial={reducedMotion ? false : { scaleX: 0, opacity: 0 }}
            whileInView={{ scaleX: 1, opacity: 0.55 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.55, delay: 0.15, ease: EASE_OUT }}
            style={{
              transformOrigin: "left center",
              backgroundImage:
                "linear-gradient(to right, transparent 0%, #f95738 25%, #ee964b 50%, #f4d35e 75%, transparent 100%)",
            }}
            className="pointer-events-none absolute left-[12%] right-[12%] top-6 hidden h-px sm:block"
          />

          <motion.ol
            variants={stagger}
            initial={reducedMotion ? false : "hidden"}
            whileInView={reducedMotion ? undefined : "visible"}
            viewport={{ once: true, margin: "-60px" }}
            className="grid gap-6 sm:grid-cols-3"
          >
            {STEPS.map((step) => (
              <StepItem key={step.title} {...step} />
            ))}
          </motion.ol>
        </div>
      </div>
    </section>
  );
}
