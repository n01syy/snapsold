"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface FaqItem {
  id: string;
  question: string;
  answer: React.ReactNode;
}

/**
 * Six questions ordered by how a skeptical reseller actually
 * evaluates a new pricing tool:
 *
 *   1. Where does the data come from? (the trust gate)
 *   2. How accurate is it?            (the trust gate, part 2)
 *   3. Photo identification — how?    (the flagship feature)
 *   4. Why three prices?              (the headline output)
 *   5. What products does it work for? (the scope check)
 *   6. Do I need an account?          (the friction check)
 *
 * Answers should stay factually honest — every claim here maps
 * to actual code in pricing.ts / vision-llm.ts / ebay.ts. If
 * one of those modules changes (e.g. window length or
 * percentile cuts), update the matching answer below.
 */
const FAQS: FaqItem[] = [
  {
    id: "barcode",
    question: "Does the barcode scanner actually work?",
    answer: (
      <>
        Yes — point your phone (or laptop webcam) at any retail UPC, EAN-8, or
        EAN-13 barcode and we decode it in-browser via{" "}
        <strong>ZXing</strong>. Decoded codes are looked up in two passes: a
        curated catalogue for the most-sold items (instant, hand-tuned titles),
        then the public <strong>UPCitemdb</strong> database for everything
        else. If both miss, we still surface real sold listings by searching
        eBay with the raw code. No app install, works on iOS Safari, Chrome
        Android, and modern desktop browsers.
      </>
    ),
  },
  {
    id: "data-source",
    question: "Where does the pricing data come from?",
    answer: (
      <>
        Real eBay <strong>completed sales</strong> — not asking prices. For
        every product we query the last 14 days of sold listings via the eBay
        SerpAPI feed, then run an IQR statistical pass to strip outliers
        (joke listings, broken-for-parts, scammer bids). The recommendation
        is computed from the cleaned set, so it reflects what comparable
        units actually sold for, not what hopeful sellers asked.
      </>
    ),
  },
  {
    id: "accuracy",
    question: "How accurate are the recommended prices?",
    answer: (
      <>
        The recommended price is the median of the cleaned sample — half of
        recent comparable units sold above it, half below. Each result also
        ships with a <strong>confidence score</strong> that factors in sample
        size, dispersion, and how cleanly the listings clustered. When the
        sample is too small, too spread out, or the query matches several
        different products at once, we say so on the card instead of
        pretending the headline number is gospel.
      </>
    ),
  },
  {
    id: "photo",
    question: "How does the photo identification work?",
    answer: (
      <>
        Your image is sent to Google&apos;s <strong>Gemini 2.5 Flash</strong>{" "}
        vision model, which extracts brand, model, condition cues, and
        configuration details (storage, color, etc.) as structured JSON. It
        handles real photos, screenshots, stock images, and even partial
        views. If the model isn&apos;t confident enough (below ~45%), we
        refuse to price the wrong product — you&apos;ll get a clear prompt to
        retry with a better angle or type the name in instead.
      </>
    ),
  },
  {
    id: "three-prices",
    question: "Why three prices instead of just one?",
    answer: (
      <>
        Different timelines need different numbers.{" "}
        <strong>Quick-sale</strong> sits at the 25th percentile of recent
        sales — list here and your item should clear in days, but you leave
        some money on the table. <strong>Recommended</strong> is the median —
        the best balance of speed and profit, and what most sellers should
        use. <strong>Max profit</strong> sits at the 85th percentile, for
        patient sellers willing to wait two-plus weeks for the right buyer.
      </>
    ),
  },
  {
    id: "products",
    question: "What kinds of products does it work for?",
    answer: (
      <>
        Anything that regularly sells on eBay — electronics, sneakers,
        consoles, watches, designer clothing, collectibles, vintage items,
        camera gear. The more specific your input (model number, storage
        tier, condition, included accessories), the tighter the price range.
        Broad queries like &ldquo;xbox&rdquo; or &ldquo;iphone&rdquo; trigger
        a disambiguation list so you can pick exactly which model you have
        before we run the pricing analysis.
      </>
    ),
  },
  {
    id: "account",
    question: "Do I need an account? Is it free?",
    answer: (
      <>
        No account is needed during the beta — just upload an image, scan a
        barcode, or type a product name and you&apos;re in. Snapsold is{" "}
        <strong>free while we tune the engine</strong>; paid tiers will
        arrive later for power users who need bulk analysis, API access, or
        priority response times. Anything you can do in the demo above
        you&apos;ll be able to keep doing for free.
      </>
    ),
  },
];

export function Faq() {
  // Multi-expand model: visitors often want to compare answers
  // (e.g. "data source" + "accuracy" together) and a single-open
  // accordion would force them to keep re-opening the previous
  // one. Tracking an open-id set lets any number be expanded.
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <section id="faq" className="relative py-20 sm:py-28">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl">
            Questions, answered honestly.
          </h2>
          <p className="mt-4 text-muted-foreground">
            Short answers to the things resellers ask before they trust the
            number.
          </p>
        </div>

        <ul className="mt-12 space-y-3">
          {FAQS.map((item, i) => (
            <FaqRow
              key={item.id}
              item={item}
              open={openIds.has(item.id)}
              onToggle={() => toggle(item.id)}
              index={i}
            />
          ))}
        </ul>
      </div>
    </section>
  );
}

function FaqRow({
  item,
  open,
  onToggle,
  index,
}: {
  item: FaqItem;
  open: boolean;
  onToggle: () => void;
  index: number;
}) {
  const panelId = `${item.id}-panel`;
  const buttonId = `${item.id}-button`;

  return (
    <motion.li
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.35, delay: index * 0.04, ease: "easeOut" }}
      className={cn(
        "overflow-hidden rounded-xl border bg-card transition-colors duration-200",
        open
          ? "border-tomato/40 shadow-sm shadow-tomato/10"
          : "border-border/60 hover:border-tomato/30",
      )}
    >
      <button
        id={buttonId}
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left sm:px-6 sm:py-5"
      >
        <span className="font-display text-base font-bold tracking-tight text-foreground sm:text-lg">
          {item.question}
        </span>

        {/* Plus/minus that morphs by rotating only the vertical bar. */}
        <span
          aria-hidden
          className={cn(
            "grid h-7 w-7 shrink-0 place-items-center rounded-full border transition-colors duration-200",
            open
              ? "border-tomato/40 bg-tomato/10 text-tomato"
              : "border-border/60 bg-muted/50 text-muted-foreground",
          )}
        >
          <span className="relative h-3 w-3">
            <span className="absolute left-0 right-0 top-1/2 h-[2px] -translate-y-1/2 rounded bg-current" />
            <motion.span
              animate={{ rotate: open ? 90 : 0 }}
              transition={{ type: "spring", stiffness: 320, damping: 22 }}
              className="absolute bottom-0 left-1/2 top-0 w-[2px] -translate-x-1/2 rounded bg-current"
            />
          </span>
        </span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={panelId}
            role="region"
            aria-labelledby={buttonId}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 text-sm leading-relaxed text-muted-foreground sm:px-6 sm:pb-6 sm:text-[15px]">
              {item.answer}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.li>
  );
}
