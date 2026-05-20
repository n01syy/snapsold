import Image from "next/image";
import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
}

/**
 * Snapsold wordmark banner for navbar, footer, and auth chrome.
 * Source is 1000×250 (4:1) — height is capped to fit the nav bar;
 * width scales automatically to preserve aspect ratio.
 */
export function Logo({ className }: LogoProps) {
  return (
    <Image
      src="/snapsoldbanner2.png"
      alt="Snapsold"
      width={1000}
      height={250}
      priority
      className={cn(
        "h-8 w-auto max-w-[10.5rem] select-none sm:h-9 sm:max-w-none",
        className,
      )}
    />
  );
}
