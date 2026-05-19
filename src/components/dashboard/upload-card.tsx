"use client";

import { AnimatePresence, motion } from "motion/react";
import dynamic from "next/dynamic";
import {
  Camera,
  ImageUp,
  Loader2,
  ScanBarcode,
  Search,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { Button } from "@/components/ui/button";
import { compressImageForUpload } from "@/lib/compress-image";
import { cn } from "@/lib/utils";

/*
 * The CameraScanner pulls in ZXing (~150 KB) and only matters
 * when the user clicks the Scan button. `dynamic` keeps it out
 * of the initial dashboard bundle so users who type or upload
 * photos never pay for it.
 */
const CameraScanner = dynamic(
  () => import("./camera-scanner").then((m) => m.CameraScanner),
  { ssr: false },
);

export type UploadMode = "image" | "name" | "barcode";

interface UploadCardProps {
  /** Whether a parent submission is in flight. Disables inputs. */
  pending: boolean;
  /** Optional pre-filled query (from ?q= search param). */
  initialQuery?: string;
  /**
   * Optional pre-filled barcode (from ?b= search param). When set,
   * the barcode flow auto-submits on mount so deep-links from the
   * landing-page camera scanner land straight on the result.
   */
  initialBarcode?: string;
  /** Optional initial mode (e.g. open straight to "barcode"). */
  initialMode?: UploadMode;
  /** Called when the user submits any of the three flows. */
  onSubmit: (input: UploadCardInput) => void;
}

export type UploadCardInput =
  | { mode: "image"; file: File }
  | { mode: "name"; query: string }
  | { mode: "barcode"; barcode: string };

/**
 * The dashboard's primary input. Three tabs sharing a single
 * controlled state machine: image upload (drag/drop + click),
 * free-text name search, and 8–14-digit UPC/EAN entry.
 *
 * Validation lives here (length / format) so the parent only ever
 * receives a well-shaped UploadCardInput. The Server Action does
 * a second pass for defence-in-depth.
 */
export function UploadCard({
  pending,
  initialQuery = "",
  initialBarcode = "",
  initialMode = "image",
  onSubmit,
}: UploadCardProps) {
  const [mode, setMode] = useState<UploadMode>(initialMode);
  const [isDragging, setIsDragging] = useState(false);
  const [query, setQuery] = useState(initialQuery);
  const [barcode, setBarcode] = useState(initialBarcode);
  const [preview, setPreview] = useState<{ name: string; url: string } | null>(
    null,
  );
  const [preparingImage, setPreparingImage] = useState(false);
  const busy = pending || preparingImage;
  const [error, setError] = useState<string | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const autoSubmittedRef = useRef(false);

  // `initialQuery` is consumed by `useState(initialQuery)` above
  // on first render, which is the only moment it can possibly
  // differ from the user's typed value. No syncing effect needed.

  // Auto-submit when arriving with a deep-linked barcode (e.g.
  // /dashboard?mode=barcode&b=045496883411 from the landing page
  // scanner). Guarded by a ref so React strict-mode double-renders
  // don't double-fire the action.
  useEffect(() => {
    if (autoSubmittedRef.current) return;
    if (initialMode !== "barcode") return;
    const b = initialBarcode.trim();
    if (!/^[0-9]{8,14}$/.test(b)) return;
    autoSubmittedRef.current = true;
    onSubmit({ mode: "barcode", barcode: b });
  }, [initialMode, initialBarcode, onSubmit]);

  // Revoke preview URLs when they're replaced or the component
  // unmounts so we don't leak Blob references.
  useEffect(() => {
    if (!preview) return;
    return () => URL.revokeObjectURL(preview.url);
  }, [preview]);

  const acceptFile = useCallback(
    async (file: File | null | undefined) => {
      setError(null);
      if (!file) return;
      if (!/^image\//.test(file.type)) {
        setError("That doesn't look like an image — try a JPG, PNG, or HEIC.");
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        setError("Image is over 10 MB — try a smaller file.");
        return;
      }

      setPreview({ name: file.name, url: URL.createObjectURL(file) });
      setPreparingImage(true);
      try {
        const prepared = await compressImageForUpload(file);
        onSubmit({ mode: "image", file: prepared });
      } catch {
        onSubmit({ mode: "image", file });
      } finally {
        setPreparingImage(false);
      }
    },
    [onSubmit],
  );

  const handleFileInput = (e: ChangeEvent<HTMLInputElement>) => {
    acceptFile(e.target.files?.[0]);
    // Reset the input so re-selecting the same file still fires.
    e.target.value = "";
  };

  const handleNameSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const q = query.trim();
    if (q.length < 2) {
      setError("Type at least 2 characters.");
      return;
    }
    onSubmit({ mode: "name", query: q });
  };

  const handleBarcodeSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const b = barcode.trim();
    if (!/^[0-9]{8,14}$/.test(b)) {
      setError("Barcode must be 8–14 digits (UPC/EAN).");
      return;
    }
    onSubmit({ mode: "barcode", barcode: b });
  };

  // Camera scan → fill the input and submit immediately. Filling
  // the input first gives the user a visible record of what got
  // scanned (handy if they want to share or sanity-check the
  // number) while still being a one-tap experience.
  const handleScanDetected = useCallback(
    (code: string) => {
      setScannerOpen(false);
      setError(null);
      setBarcode(code);
      onSubmit({ mode: "barcode", barcode: code });
    },
    [onSubmit],
  );

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div
        role="tablist"
        aria-label="Search method"
        className="mb-4 flex w-full items-center gap-1 rounded-xl border border-border/60 bg-card/70 p-1"
      >
        <ModeTab
          active={mode === "image"}
          onClick={() => setMode("image")}
          icon={<ImageUp className="h-4 w-4" />}
          disabled={busy}
        >
          Photo
        </ModeTab>
        <ModeTab
          active={mode === "name"}
          onClick={() => setMode("name")}
          icon={<Search className="h-4 w-4" />}
          disabled={busy}
        >
          Name
        </ModeTab>
        <ModeTab
          active={mode === "barcode"}
          onClick={() => setMode("barcode")}
          icon={<ScanBarcode className="h-4 w-4" />}
          disabled={busy}
        >
          Barcode
        </ModeTab>
      </div>

      <AnimatePresence mode="wait">
        {mode === "image" && (
          <motion.div
            key="image"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
          >
            <div
              role="button"
              tabIndex={busy ? -1 : 0}
              aria-disabled={busy}
              onDragOver={(e) => {
                e.preventDefault();
                if (!busy) setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                if (busy) return;
                setIsDragging(false);
                acceptFile(e.dataTransfer.files?.[0]);
              }}
              onClick={() => !busy && fileInputRef.current?.click()}
              onKeyDown={(e) => {
                if (busy) return;
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
              className={cn(
                "group relative grid h-56 w-full cursor-pointer place-items-center overflow-hidden rounded-2xl border-2 border-dashed bg-card/60 transition-all",
                busy && "cursor-not-allowed opacity-60",
                isDragging
                  ? "scale-[1.01] border-tomato bg-tomato/10"
                  : "border-navy/25 hover:border-tomato/60 hover:bg-card/80",
              )}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={handleFileInput}
                disabled={busy}
              />

              {busy ? (
                <div className="flex flex-col items-center gap-3 text-center">
                  <Loader2 className="h-7 w-7 animate-spin text-tomato" />
                  <p className="text-sm font-semibold tracking-tight">
                    {preparingImage
                      ? "Preparing photo…"
                      : `Analysing ${preview?.name ?? "photo"}…`}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {preparingImage
                      ? "Optimising size for upload."
                      : "Identifying product, fetching sold listings, scoring confidence."}
                  </p>
                </div>
              ) : preview ? (
                <PreviewTile
                  preview={preview}
                  onClear={(e) => {
                    e.stopPropagation();
                    setPreview(null);
                  }}
                />
              ) : (
                <div className="flex flex-col items-center gap-3 text-center">
                  <div className="grid h-12 w-12 place-items-center rounded-xl bg-gold/30 ring-1 ring-sandy/40">
                    <ImageUp className="h-5 w-5 text-tomato" />
                  </div>
                  <div>
                    <p className="font-semibold tracking-tight">
                      Drop a product photo here
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      or{" "}
                      <span className="font-semibold text-tomato underline-offset-2 group-hover:underline">
                        click to upload
                      </span>
                      &nbsp;· PNG, JPG, HEIC up to 10 MB
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
            onSubmit={handleNameSubmit}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            className="flex w-full items-center gap-2 rounded-2xl border border-border/60 bg-card/70 p-2 focus-within:border-tomato/60"
          >
            <Search className="ml-3 h-5 w-5 shrink-0 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder='e.g. "Nintendo Switch OLED" or "Air Jordan 1 Chicago"'
              disabled={busy}
              className="h-12 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground/70 disabled:opacity-60"
            />
            <Button
              type="submit"
              size="default"
              disabled={pending || query.trim().length < 2}
              className="h-12 bg-tomato font-display font-semibold text-beige shadow-sm shadow-tomato/20 hover:bg-tomato/90"
            >
              {pending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Price it"
              )}
            </Button>
          </motion.form>
        )}

        {mode === "barcode" && (
          <motion.form
            key="barcode"
            onSubmit={handleBarcodeSubmit}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            className="rounded-2xl border border-border/60 bg-card/70 p-4"
          >
            <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-2">
                <ScanBarcode className="h-4 w-4 text-tomato" />
                Enter UPC or EAN (8–14 digits)
              </span>
              <button
                type="button"
                onClick={() => setScannerOpen(true)}
                disabled={busy}
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
                disabled={busy}
                className="h-12 flex-1 rounded-lg border border-border/60 bg-background/60 px-4 font-mono text-base tracking-wider outline-none placeholder:text-muted-foreground/60 focus:border-tomato/60 disabled:opacity-60"
              />
              <Button
                type="submit"
                disabled={
                  pending || !/^[0-9]{8,14}$/.test(barcode.trim())
                }
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
              Resolved against a curated catalogue, then a public UPC database
              for everything else.
            </p>
          </motion.form>
        )}
      </AnimatePresence>

      <CameraScanner
        open={scannerOpen}
        onDetected={handleScanDetected}
        onClose={() => setScannerOpen(false)}
      />

      {error && (
        <p
          role="alert"
          className="mt-3 rounded-md border border-tomato/30 bg-tomato/10 px-3 py-2 text-sm text-tomato"
        >
          {error}
        </p>
      )}

      <p className="mt-4 text-center text-xs text-muted-foreground">
        Free to try · No credit card · Powered by real eBay sold-listing data
      </p>
    </div>
  );
}

interface ModeTabProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  disabled?: boolean;
  children: React.ReactNode;
}

function ModeTab({ active, onClick, icon, disabled, children }: ModeTabProps) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 font-display text-sm font-semibold transition-all disabled:opacity-50",
        active
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {icon}
      {children}
    </button>
  );
}

interface PreviewTileProps {
  preview: { name: string; url: string };
  onClear: (e: React.MouseEvent) => void;
}

function PreviewTile({ preview, onClear }: PreviewTileProps) {
  return (
    <div className="flex items-center gap-4">
      {/* eslint-disable-next-line @next/next/no-img-element -- Blob URLs aren't supported by next/image */}
      <img
        src={preview.url}
        alt={preview.name}
        className="h-32 w-32 rounded-xl object-cover ring-1 ring-border"
      />
      <div className="text-left">
        <p className="font-semibold tracking-tight">Ready to analyse</p>
        <p className="mt-1 text-sm text-muted-foreground">{preview.name}</p>
        <button
          type="button"
          onClick={onClear}
          className="mt-2 inline-flex items-center gap-1 text-xs text-tomato hover:underline"
        >
          <X className="h-3 w-3" />
          Choose another
        </button>
      </div>
    </div>
  );
}
