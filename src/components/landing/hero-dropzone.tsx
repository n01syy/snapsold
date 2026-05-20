"use client";

import { useCallback, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { EASE_OUT } from "@/components/dashboard/analysis-motion";
import dynamic from "next/dynamic";
import { Camera, ImageUp, Loader2, ScanBarcode, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Lazy-loaded so visitors who only browse the marketing copy
// never download ZXing's ~150 KB barcode bundle.
const CameraScanner = dynamic(
  () =>
    import("@/components/dashboard/camera-scanner").then(
      (m) => m.CameraScanner,
    ),
  { ssr: false },
);

type Mode = "image" | "name" | "barcode";

/**
 * Drag-and-drop hero zone. Phase 1: front-end only — we accept the file,
 * show a brief animated "Analyzing…" state, then point the user at the
 * (not-yet-built) /dashboard route.
 *
 * Wired in Phase 2 to actually POST the file to /api/identify.
 */
export function HeroDropzone() {
  const [mode, setMode] = useState<Mode>("image");
  const [isDragging, setIsDragging] = useState(false);
  const [pending, setPending] = useState(false);
  const [query, setQuery] = useState("");
  const [barcode, setBarcode] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const reducedMotion = useReducedMotion();

  const panelTransition = reducedMotion
    ? { duration: 0.01 }
    : { duration: 0.22, ease: EASE_OUT };

  const handleFiles = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;
    // For Phase 1 we just simulate processing so the UX feels alive.
    setPending(true);
    setTimeout(() => {
      setPending(false);
      window.location.href = "/dashboard";
    }, 1200);
  }, []);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!query.trim()) return;
      setPending(true);
      setTimeout(() => {
        window.location.href = `/dashboard?q=${encodeURIComponent(query)}`;
      }, 600);
    },
    [query],
  );

  const handleBarcodeSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const b = barcode.trim();
      if (!/^[0-9]{8,14}$/.test(b)) return;
      setPending(true);
      window.location.href = `/dashboard?mode=barcode&b=${encodeURIComponent(b)}`;
    },
    [barcode],
  );

  // Camera scan from the hero: skip the form entirely and hand
  // the code straight to the dashboard via the ?b= deep-link.
  // The dashboard page auto-submits when it sees that param, so
  // the visitor lands directly on the analysis card.
  const handleScanDetected = useCallback((code: string) => {
    setScannerOpen(false);
    setPending(true);
    window.location.href = `/dashboard?mode=barcode&b=${encodeURIComponent(code)}`;
  }, []);

  return (
    <div className="mx-auto w-full max-w-2xl">
      {/* Mode tabs */}
      <div
        role="tablist"
        aria-label="Search method"
        className="relative mb-4 flex w-full items-center gap-1 rounded-xl border border-border/60 bg-card/80 p-1 shadow-sm shadow-navy/5"
      >
        <ModeTab active={mode === "image"} onClick={() => setMode("image")} icon={<ImageUp className="h-4 w-4" />}>
          Photo
        </ModeTab>
        <ModeTab active={mode === "name"} onClick={() => setMode("name")} icon={<Search className="h-4 w-4" />}>
          Name
        </ModeTab>
        <ModeTab active={mode === "barcode"} onClick={() => setMode("barcode")} icon={<ScanBarcode className="h-4 w-4" />}>
          Barcode
        </ModeTab>
      </div>

      <AnimatePresence mode="wait">
        {mode === "image" && (
          <motion.div
            key="image"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={panelTransition}
          >
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                handleFiles(e.dataTransfer.files);
              }}
              onClick={() => inputRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
              }}
              className={cn(
                "group relative grid h-56 w-full cursor-pointer place-items-center overflow-hidden rounded-2xl border-2 border-dashed bg-card/70 shadow-md shadow-navy/8 transition-colors glow-ring",
                isDragging
                  ? "scale-[1.01] border-tomato bg-tomato/10"
                  : "border-navy/25 hover:border-tomato/60 hover:bg-card/80",
              )}
            >
              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(e) => handleFiles(e.target.files)}
              />
              {pending ? (
                <div className="flex flex-col items-center gap-3 text-center">
                  <Loader2 className="h-7 w-7 animate-spin text-tomato" />
                  <p className="text-sm text-muted-foreground">Analysing…</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3 text-center">
                  <div className="grid h-12 w-12 place-items-center rounded-xl bg-gold/30 ring-1 ring-sandy/40">
                    <ImageUp className="h-5 w-5 text-tomato" />
                  </div>
                  <div>
                    <p className="font-semibold tracking-tight">Drop a product photo here</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      or{" "}
                      <span className="font-semibold text-tomato underline-offset-2 group-hover:underline">
                        click to upload
                      </span>
                      &nbsp;· PNG, JPG up to 10 MB
                    </p>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {mode === "name" && (
          <motion.form
            key="name"
            onSubmit={handleSubmit}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={panelTransition}
            className="flex w-full items-center gap-2 rounded-2xl border border-border/60 bg-card/80 p-2 shadow-md shadow-navy/8 focus-within:border-tomato/60 focus-within:ring-2 focus-within:ring-tomato/15"
          >
            <Search className="ml-3 h-5 w-5 shrink-0 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder='e.g. "Nintendo Switch OLED" or "Air Jordan 1 Retro High Chicago"'
              className="h-12 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground/70"
            />
            <Button
              type="submit"
              disabled={pending || !query.trim()}
              className="h-12 bg-tomato font-display font-semibold text-beige shadow-sm shadow-tomato/20 hover:bg-tomato/90"
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Price it"}
            </Button>
          </motion.form>
        )}

        {mode === "barcode" && (
          <motion.form
            key="barcode"
            onSubmit={handleBarcodeSubmit}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={panelTransition}
            className="rounded-2xl border border-border/60 bg-card/80 p-4 shadow-md shadow-navy/8"
          >
            <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-2">
                <ScanBarcode className="h-4 w-4 text-tomato" />
                Enter UPC / EAN (8–14 digits)
              </span>
              <button
                type="button"
                onClick={() => setScannerOpen(true)}
                disabled={pending}
                className="inline-flex items-center gap-1.5 rounded-full border border-tomato/30 bg-tomato/10 px-3 py-1 font-display text-xs font-semibold text-tomato transition-colors hover:bg-tomato/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Camera className="h-3.5 w-3.5" />
                Scan with camera
              </button>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <input
                value={barcode}
                onChange={(e) =>
                  setBarcode(e.target.value.replace(/[^0-9]/g, ""))
                }
                placeholder="045496883411"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={14}
                disabled={pending}
                className="h-12 flex-1 rounded-lg border border-border/60 bg-background/60 px-4 font-mono text-base tracking-wider outline-none placeholder:text-muted-foreground/60 focus:border-tomato/60 disabled:opacity-60"
              />
              <Button
                type="submit"
                disabled={pending || !/^[0-9]{8,14}$/.test(barcode.trim())}
                className="h-12 bg-tomato font-display font-semibold text-beige shadow-sm shadow-tomato/20 hover:bg-tomato/90"
              >
                {pending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Look up"
                )}
              </Button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              The scanner works on phones and laptops with a webcam — point at
              any retail barcode.
            </p>
          </motion.form>
        )}
      </AnimatePresence>

      <CameraScanner
        open={scannerOpen}
        onDetected={handleScanDetected}
        onClose={() => setScannerOpen(false)}
      />

      <p className="mt-4 text-center text-xs text-muted-foreground">
        Free to try · No credit card · Powered by real eBay sold-listing data
      </p>
    </div>
  );
}

function ModeTab({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "relative z-10 flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-200",
        active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {active && (
        <motion.span
          layoutId="hero-tab-pill"
          className="absolute inset-0 rounded-lg border border-tomato/20 bg-background shadow-sm"
          transition={{ duration: 0.22, ease: EASE_OUT }}
        />
      )}
      <span className="relative z-10 flex items-center gap-2">
        {icon}
        {children}
      </span>
    </button>
  );
}
