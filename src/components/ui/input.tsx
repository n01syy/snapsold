import * as React from "react";
import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-11 w-full rounded-lg border border-border/60 bg-background/60 px-4 text-sm outline-none transition-colors",
        "placeholder:text-muted-foreground/60",
        "focus:border-tomato/60 focus:ring-2 focus:ring-tomato/20",
        "disabled:cursor-not-allowed disabled:opacity-60",
        "aria-invalid:border-tomato/50 aria-invalid:ring-tomato/15",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
