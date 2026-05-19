import { cn } from "@/lib/utils";

interface PriceTileProps {
  label: string;
  value: number;
  sublabel: string;
  tone: "brand" | "muted";
}

/**
 * Three of these sit side-by-side: quick-sale, recommended, and
 * max-profit. The brand variant tints the recommended tile in
 * tomato so it reads as the primary answer.
 *
 * Kept deliberately compact and content-free so it stays legible
 * even when the parent column is narrow — auxiliary decorations
 * (trend pills, deltas, etc.) live in the surrounding card, not
 * inside the tile, so they can't blow up the tile's height.
 */
export function PriceTile({ label, value, sublabel, tone }: PriceTileProps) {
  const isBrand = tone === "brand";
  return (
    <div
      className={cn(
        "rounded-xl border p-3",
        isBrand
          ? "border-tomato/40 bg-tomato/10 ring-1 ring-tomato/30"
          : "border-border/60 bg-muted/30",
      )}
    >
      <div className="truncate text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div
        className={cn(
          "mt-1 text-2xl font-bold leading-none tracking-tight",
          isBrand && "text-tomato",
        )}
      >
        ${value}
      </div>
      <div className="mt-1 text-[11px] leading-snug text-muted-foreground">
        {sublabel}
      </div>
    </div>
  );
}
