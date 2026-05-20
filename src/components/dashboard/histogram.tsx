"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useRef, useState } from "react";
import type { PriceBucket } from "@/lib/types";
import { cn } from "@/lib/utils";

interface HistogramProps {
  buckets: PriceBucket[];
  recommendedBucket: string;
}

/**
 * Vertical bar chart of the sold-price distribution. The bucket
 * containing the recommended price is rendered in solid tomato;
 * the rest are sandy/30 so the recommendation pops at a glance.
 *
 * Hover tooltip: a small navy card follows the cursor across the
 * chart, showing the bucket's price range, sold count, and share
 * of the cleaned sample. The bar under the cursor is highlighted
 * for visual continuity. Position is computed from the cursor's
 * X coordinate (not anchored to columns) so it stays glued to the
 * mouse — and clamped inside the chart's bounding box so it
 * never gets clipped by the Card's overflow.
 */
const TOOLTIP_WIDTH = 200;
const TOOLTIP_HEIGHT_EST = 92; // including padding + 2 lines + the optional pill
const CURSOR_OFFSET = 14;

export function Histogram({ buckets, recommendedBucket }: HistogramProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();
  const [hover, setHover] = useState<{
    idx: number;
    x: number;
    y: number;
    /** Chart width at the moment of the move event, used for tooltip clamping. */
    chartW: number;
    /** Chart height at the moment of the move event. */
    chartH: number;
  } | null>(null);

  if (buckets.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No price data available.</p>
    );
  }

  const maxCount = Math.max(...buckets.map((b) => b.count), 1);
  const totalCount = buckets.reduce((sum, b) => sum + b.count, 0);
  // Bucket width: distance to the next bucket's lower bound. With
  // a single bucket we don't know the natural width, so fall back
  // to 1 — the engine snaps widths to nice steps, so this is rare
  // and only affects the last-bucket upper bound in degenerate cases.
  const bucketWidth =
    buckets.length > 1
      ? Number(buckets[1].bucket) - Number(buckets[0].bucket)
      : 1;

  /**
   * Convert a cursor X coordinate (relative to the chart) into a
   * bucket index. Math.floor on the proportional position is more
   * accurate than relying on per-column `onMouseEnter` because:
   *  - flex `gap-1.5` between bars creates dead zones where bar
   *    hover handlers don't fire, but the cursor is clearly
   *    "over" one column or the other,
   *  - the result aligns 1:1 with the visible x-axis, so the
   *    user's intuition ("I'm pointing at the third bar") matches
   *    what the tooltip says.
   */
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = chartRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const ratio = Math.min(0.9999, Math.max(0, x / rect.width));
    const idx = Math.floor(ratio * buckets.length);
    setHover({ idx, x, y, chartW: rect.width, chartH: rect.height });
  };

  return (
    <div>
      <div
        ref={chartRef}
        className="relative flex h-44 items-end gap-1.5"
        role="img"
        aria-label="Sold-price distribution histogram"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHover(null)}
      >
        {buckets.map((b, i) => {
          const heightPct = (b.count / maxCount) * 100;
          const isRecommended = b.bucket === recommendedBucket;
          const isHovered = hover?.idx === i;
          return (
            <div
              key={b.bucket + "-" + i}
              className="flex h-full flex-1 flex-col justify-end"
            >
              <motion.div
                initial={reducedMotion ? false : { scaleY: 0 }}
                animate={{ scaleY: 1 }}
                transition={{
                  duration: 0.45,
                  delay: reducedMotion ? 0 : 0.03 + i * 0.025,
                  ease: [0.22, 1, 0.36, 1],
                }}
                style={{
                  height: `${heightPct}%`,
                  transformOrigin: "bottom",
                  willChange: reducedMotion ? undefined : "transform",
                }}
                className={cn(
                  "w-full rounded-t transition-colors",
                  isRecommended ? "bg-tomato" : "bg-sandy/30",
                  isHovered &&
                    (isRecommended ? "bg-tomato/90" : "bg-sandy/55"),
                )}
                aria-label={`${b.count} sold at $${b.bucket}`}
              />
            </div>
          );
        })}

        <AnimatePresence>
          {hover && (
            <CursorTooltip
              key="histogram-tooltip"
              bucket={buckets[hover.idx]}
              bucketWidth={bucketWidth}
              cursorX={hover.x}
              cursorY={hover.y}
              chartWidth={hover.chartW}
              chartHeight={hover.chartH}
              sampleTotal={totalCount}
              isRecommended={
                buckets[hover.idx].bucket === recommendedBucket
              }
            />
          )}
        </AnimatePresence>
      </div>

      <div className="mt-2 flex justify-between text-xs text-muted-foreground">
        <span>${buckets[0].bucket}</span>
        <span>${buckets[buckets.length - 1].bucket}</span>
      </div>
    </div>
  );
}

function CursorTooltip({
  bucket,
  bucketWidth,
  cursorX,
  cursorY,
  chartWidth,
  chartHeight,
  sampleTotal,
  isRecommended,
}: {
  bucket: PriceBucket;
  bucketWidth: number;
  cursorX: number;
  cursorY: number;
  chartWidth: number;
  chartHeight: number;
  sampleTotal: number;
  isRecommended: boolean;
}) {
  const lo = Number(bucket.bucket);
  const hi = lo + bucketWidth;
  const pctOfSample =
    sampleTotal > 0 ? Math.round((bucket.count / sampleTotal) * 100) : 0;

  // ── Horizontal: right of cursor by default, flip left if too close
  // to the right edge, then clamp into bounds as a safety net. ──
  let left = cursorX + CURSOR_OFFSET;
  if (left + TOOLTIP_WIDTH > chartWidth) {
    left = cursorX - TOOLTIP_WIDTH - CURSOR_OFFSET;
  }
  left = Math.max(0, Math.min(chartWidth - TOOLTIP_WIDTH, left));

  // ── Vertical: above cursor by default, flip below if the cursor
  // is near the top of the chart, then clamp to the chart's height
  // so the tooltip never gets clipped by the Card's overflow. ──
  let top = cursorY - TOOLTIP_HEIGHT_EST - 8;
  if (top < 0) {
    top = cursorY + 16;
  }
  top = Math.max(0, Math.min(chartHeight - TOOLTIP_HEIGHT_EST, top));

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.1, ease: "easeOut" }}
      className="pointer-events-none absolute z-10 rounded-lg border border-navy/40 bg-navy px-3 py-2 text-beige shadow-lg shadow-navy/20"
      style={{ left, top, width: TOOLTIP_WIDTH }}
      role="tooltip"
    >
      <div className="font-mono text-sm font-bold tracking-tight tabular-nums text-beige">
        ${Math.round(lo)} – ${Math.round(hi)}
      </div>
      <div className="mt-0.5 text-[11px] text-beige/75">
        {bucket.count} sold · {pctOfSample}% of sample
      </div>
      {isRecommended && (
        <div className="mt-1 inline-flex items-center gap-1 rounded border border-gold/40 bg-gold/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-gold">
          Recommended bucket
        </div>
      )}
    </motion.div>
  );
}
