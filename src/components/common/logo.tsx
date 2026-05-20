import Image from "next/image";
import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  showWordmark?: boolean;
}

/**
 * Snapsold wordmark + glyph.
 *
 * Glyph is the brand mark from /public/snapsoldicon6.png. Rendered through next/image so the
 * optimizer serves an appropriately sized + retina-doubled variant for
 * the navbar without us shipping the full-resolution source on every load.
 * `priority` is set because the navbar is above the fold on every route.
 */
export function Logo({ className, showWordmark = true }: LogoProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Image
        src="/snapsoldicon6.png"
        alt={showWordmark ? "" : "Snapsold"}
        width={36}
        height={36}
        priority
        className="h-9 w-9 select-none"
      />
      {showWordmark && (
        <span className="font-display text-base font-bold tracking-tight sm:text-lg">
          Snapsold
        </span>
      )}
    </div>
  );
}
