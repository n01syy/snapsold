"use client";

import { Star } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { EASE_OUT, fadeUp, stagger } from "@/components/dashboard/analysis-motion";
import { cn } from "@/lib/utils";

type Review = {
  id: string;
  name: string;
  meta: string;
  stars: 4 | 5;
  body: string;
  initials: string;
  accent: "tomato" | "sandy" | "gold" | "navy";
  featured?: boolean;
};

const REVIEWS: Review[] = [
  {
    id: "marcus",
    name: "Marcus T.",
    meta: "Thrift flipper · Houston",
    stars: 5,
    initials: "MT",
    accent: "tomato",
    featured: true,
    body: "Been flipping thrift store finds for like 3 years and this is the first tool that actually uses sold comps not asking prices. Listed a galaxy watch last night priced it at $147 off the recommended and it sold in 2 days. Pretty impressed ngl",
  },
  {
    id: "jenna",
    name: "Jenna K.",
    meta: "Part-time reseller",
    stars: 5,
    initials: "JK",
    accent: "sandy",
    body: "Honestly didnt think the photo thing would work lol took a pic of a bose speaker from a garage sale bin and it got the model right?? Saved me probably 20 mins of googling at least",
  },
  {
    id: "david",
    name: "David R.",
    meta: "eBay · 4 yrs",
    stars: 4,
    initials: "DR",
    accent: "navy",
    body: "Its good. Quick. Does what it says. Only thing is I wish it had bulk mode for when I'm doing 30 items at once but for beta its solid",
  },
  {
    id: "priya",
    name: "Priya M.",
    meta: "Casual seller",
    stars: 5,
    initials: "PM",
    accent: "gold",
    body: "My husband keeps leaving electronics in the basement and I finally know what to list them for without bugging him every time 😅 the three price levels actually make sense once you use it a couple times",
  },
  {
    id: "tyler",
    name: "Tyler",
    meta: "Side hustle · college",
    stars: 5,
    initials: "T",
    accent: "tomato",
    body: "game changer for side hustle people. i used to sort sold listings on ebay manually which takes forever. this gets me close enough that i can list same day usually",
  },
  {
    id: "sandra",
    name: "Sandra W.",
    meta: "Vintage & kitchenware",
    stars: 5,
    initials: "SW",
    accent: "sandy",
    body: "Recommended price was spot on for my vintage Le Creuset set — I was gonna list way too low bc i didnt see many comps. The confidence score helped me feel less dumb about pricing lol",
  },
  {
    id: "mike",
    name: "Mike D.",
    meta: "Full-time flipper",
    stars: 4,
    initials: "MD",
    accent: "navy",
    body: "way better then terapeak was for me on random thrift finds. dont @ me. barcode scan worked on a beat up xbox controller box and thats all i had",
  },
  {
    id: "angela",
    name: "Angela L.",
    meta: "Estate sale picker",
    stars: 5,
    initials: "AL",
    accent: "gold",
    body: "Not gonna lie I was skeptical bc free tools are usually garbage but the barcode scan on my phone worked first try?? Listed 4 things yesterday and didnt have to guess once",
  },
];

const ACCENT: Record<
  Review["accent"],
  { bg: string; text: string; ring: string }
> = {
  tomato: {
    bg: "bg-tomato/12",
    text: "text-tomato",
    ring: "ring-tomato/20",
  },
  sandy: {
    bg: "bg-sandy/15",
    text: "text-sandy",
    ring: "ring-sandy/25",
  },
  gold: {
    bg: "bg-gold/20",
    text: "text-gold",
    ring: "ring-gold/25",
  },
  navy: {
    bg: "bg-navy/10",
    text: "text-navy",
    ring: "ring-navy/15",
  },
};

function StarRow({ count }: { count: 4 | 5 }) {
  return (
    <div
      className="flex gap-0.5"
      aria-label={`${count} out of 5 stars`}
    >
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          className={cn(
            "h-3.5 w-3.5",
            i < count
              ? "fill-gold text-gold"
              : "fill-transparent text-border",
          )}
          strokeWidth={1.75}
        />
      ))}
    </div>
  );
}

function ReviewCard({ review }: { review: Review }) {
  const a = ACCENT[review.accent];

  return (
    <motion.figure
      variants={fadeUp}
      className={cn(
        "flex h-full flex-col rounded-xl border border-border/60 bg-card p-5 shadow-sm shadow-navy/5 transition-colors duration-200 hover:border-tomato/25 sm:p-6",
        review.featured && "md:col-span-2 lg:col-span-2",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className={cn(
              "grid h-10 w-10 shrink-0 place-items-center rounded-full text-xs font-bold ring-2",
              a.bg,
              a.text,
              a.ring,
            )}
            aria-hidden
          >
            {review.initials}
          </div>
          <figcaption className="min-w-0">
            <p className="truncate text-sm font-semibold tracking-tight">
              {review.name}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {review.meta}
            </p>
          </figcaption>
        </div>
        <StarRow count={review.stars} />
      </div>

      <blockquote className="mt-4 flex-1 text-sm leading-relaxed text-foreground/90">
        &ldquo;{review.body}&rdquo;
      </blockquote>
    </motion.figure>
  );
}

export function Reviews() {
  const reducedMotion = useReducedMotion();
  const avgStars = (
    REVIEWS.reduce((sum, r) => sum + r.stars, 0) / REVIEWS.length
  ).toFixed(1);

  return (
    <section id="reviews" className="relative py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={reducedMotion ? false : { opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.4, ease: EASE_OUT }}
          className="mx-auto max-w-2xl text-center"
        >
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Early beta feedback
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl">
            Resellers aren&apos;t holding back.
          </h2>
          <p className="mt-4 text-muted-foreground">
            Flippers, thrifters, and casual sellers testing Snapsold during
            beta — unfiltered notes from real listing sessions.
          </p>

          <div className="mt-6 inline-flex items-center gap-3 rounded-full border border-border/60 bg-card px-4 py-2 text-sm shadow-sm">
            <StarRow count={5} />
            <span className="font-semibold tabular-nums">{avgStars}</span>
            <span className="text-muted-foreground">
              from {REVIEWS.length} beta testers
            </span>
          </div>
        </motion.div>

        <motion.div
          variants={stagger}
          initial={reducedMotion ? false : "hidden"}
          whileInView={reducedMotion ? undefined : "visible"}
          viewport={{ once: true, margin: "-60px" }}
          className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3"
        >
          {REVIEWS.map((review) => (
            <ReviewCard key={review.id} review={review} />
          ))}
        </motion.div>
      </div>
    </section>
  );
}
