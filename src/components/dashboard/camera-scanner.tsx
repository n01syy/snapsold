"use client";

import { AnimatePresence, motion } from "motion/react";
import { CheckCircle2, Loader2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface CameraScannerProps {
  /** Modal open state, owned by the parent. */
  open: boolean;
  /** Called with the decoded barcode (8–14 digits). */
  onDetected: (code: string) => void;
  /** Called when the user dismisses the modal (X button or backdrop click). */
  onClose: () => void;
}

type Status =
  | "idle"
  | "starting"
  | "scanning"
  | "detected"
  | "denied"
  | "no-camera"
  | "error";

/**
 * Live barcode scanner that opens the device camera and decodes
 * UPC/EAN codes in-browser via ZXing. Designed as a modal:
 * parent owns `open`, this component handles every lifecycle
 * detail (permission prompts, stream teardown, double-fire
 * prevention, iOS Safari quirks).
 *
 * Notable implementation choices:
 *
 *  • Format-restricted to UPC-A / UPC-E / EAN-8 / EAN-13. Letting
 *    ZXing try every format wastes CPU on every frame and risks
 *    misreading retail packaging that also has CODE-128 / QR
 *    decorations.
 *
 *  • The ZXing library is `import()`-ed inside the effect so its
 *    ~150 KB bundle is only fetched the first time the user
 *    actually clicks "Scan". Routes that never open the scanner
 *    pay zero bytes for it.
 *
 *  • `facingMode: "environment"` constraint requests the rear
 *    camera on phones (which is where the lens you actually
 *    point at a barcode lives). Falls back to default camera on
 *    laptops where the constraint can't be satisfied.
 *
 *  • iOS Safari refuses to autoplay video unless the element has
 *    `playsInline` + `muted`. Without those it'll fullscreen the
 *    stream and break the modal layout.
 *
 *  • The decode callback flips `detectedRef` synchronously to
 *    guarantee we only fire `onDetected` once per scan, even if
 *    multiple frames in flight all happen to resolve to the same
 *    barcode in the same tick.
 */
export function CameraScanner({
  open,
  onDetected,
  onClose,
}: CameraScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const detectedRef = useRef(false);
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [detectedCode, setDetectedCode] = useState<string | null>(null);

  useEffect(() => {
    // We intentionally only act on the rising edge of `open`. The
    // closing transition is handled by the cleanup function below
    // (which releases the camera) — there's no React state we need
    // to mutate at that point, since the modal's exit animation
    // unmounts the visible UI, and any leftover state values are
    // wiped on the next open by the resets immediately below.
    if (!open) return;

    const videoEl = videoRef.current;
    if (!videoEl) return;

    setStatus("starting");
    setErrorMsg(null);
    setDetectedCode(null);
    detectedRef.current = false;

    let cancelled = false;
    // ZXing returns a `controls` object with `.stop()` that
    // releases the MediaStream tracks. We capture it here so the
    // effect cleanup can call it even if the user closes the
    // modal mid-init.
    let controls: { stop: () => void } | null = null;

    (async () => {
      try {
        const [{ BrowserMultiFormatReader }, lib] = await Promise.all([
          import("@zxing/browser"),
          import("@zxing/library"),
        ]);
        if (cancelled) return;

        const { BarcodeFormat, DecodeHintType } = lib;
        const hints = new Map();
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [
          BarcodeFormat.UPC_A,
          BarcodeFormat.UPC_E,
          BarcodeFormat.EAN_8,
          BarcodeFormat.EAN_13,
        ]);
        // `tryHarder` doubles ZXing's per-frame work but markedly
        // improves the hit rate on small/glossy retail barcodes.
        hints.set(DecodeHintType.TRY_HARDER, true);

        const reader = new BrowserMultiFormatReader(hints, {
          delayBetweenScanAttempts: 150,
        });

        const scanControls = await reader.decodeFromConstraints(
          // `ideal` keeps us flexible: if the rear camera is
          // unavailable (laptops, locked-down devices) we still
          // get the default camera instead of an outright reject.
          { video: { facingMode: { ideal: "environment" } } },
          videoEl,
          (result) => {
            if (cancelled || detectedRef.current) return;
            if (!result) return;
            const text = result.getText();
            if (!/^[0-9]{8,14}$/.test(text)) return;
            detectedRef.current = true;
            setDetectedCode(text);
            setStatus("detected");
            // Brief flash before handing the code up — gives the
            // user a moment of "got it!" confirmation before the
            // modal closes and the lookup begins.
            window.setTimeout(() => {
              if (!cancelled) onDetected(text);
            }, 450);
          },
        );

        if (cancelled) {
          scanControls.stop();
          return;
        }
        controls = scanControls;
        setStatus("scanning");
      } catch (err) {
        if (cancelled) return;
        const e = err as Error;
        if (
          e.name === "NotAllowedError" ||
          e.name === "PermissionDeniedError"
        ) {
          setStatus("denied");
          setErrorMsg(
            "Camera access was denied. Allow camera permission for this site in your browser settings, or type the UPC manually instead.",
          );
        } else if (
          e.name === "NotFoundError" ||
          e.name === "OverconstrainedError"
        ) {
          setStatus("no-camera");
          setErrorMsg(
            "No camera was found on this device. You can still type the UPC manually below.",
          );
        } else {
          setStatus("error");
          setErrorMsg(
            e.message || "Couldn't start the camera. Try again, or type the UPC manually.",
          );
        }
      }
    })();

    return () => {
      cancelled = true;
      controls?.stop();
    };
  }, [open, onDetected]);

  // Esc to close — matches the modal pattern users expect.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose],
  );

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-navy/70 p-4 backdrop-blur-sm"
          onClick={handleBackdropClick}
          role="dialog"
          aria-modal="true"
          aria-labelledby="scanner-title"
        >
          <motion.div
            initial={{ y: 16, scale: 0.97, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 16, scale: 0.97, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="relative w-full max-w-md overflow-hidden rounded-2xl bg-card shadow-2xl shadow-navy/30 ring-1 ring-border/60"
          >
            <div className="flex items-center justify-between border-b border-border/60 px-4 py-3 sm:px-5">
              <h3
                id="scanner-title"
                className="font-display text-base font-bold tracking-tight"
              >
                Scan a barcode
              </h3>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close scanner"
                className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="relative aspect-[4/3] bg-navy">
              <video
                ref={videoRef}
                className={cn(
                  "h-full w-full object-cover transition-opacity",
                  status === "scanning" || status === "detected"
                    ? "opacity-100"
                    : "opacity-30",
                )}
                playsInline
                muted
                autoPlay
              />

              {(status === "starting" || status === "idle") && (
                <div className="absolute inset-0 grid place-items-center text-beige">
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="h-6 w-6 animate-spin" />
                    <p className="text-sm font-medium">Starting camera…</p>
                  </div>
                </div>
              )}

              {(status === "denied" ||
                status === "no-camera" ||
                status === "error") && (
                <div className="absolute inset-0 grid place-items-center p-6 text-center text-beige">
                  <p className="max-w-xs text-sm leading-relaxed">
                    {errorMsg}
                  </p>
                </div>
              )}

              {status === "scanning" && <ScanOverlay />}

              {status === "detected" && detectedCode && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                  className="absolute inset-0 grid place-items-center bg-tomato/85 text-beige"
                >
                  <div className="flex flex-col items-center gap-2">
                    <CheckCircle2 className="h-10 w-10" />
                    <p className="font-display text-sm font-bold tracking-tight">
                      Detected
                    </p>
                    <p className="font-mono text-xs tabular-nums opacity-90">
                      {detectedCode}
                    </p>
                  </div>
                </motion.div>
              )}
            </div>

            <div className="px-4 py-3 text-center text-xs text-muted-foreground sm:px-5">
              {status === "scanning"
                ? "Point the rear camera at a UPC or EAN barcode. We’ll fire as soon as we read it."
                : status === "detected"
                  ? "Got it — looking up the product now."
                  : status === "starting"
                    ? "Waiting for camera permission…"
                    : "Camera unavailable. Close this and type the UPC manually."}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * Aim guidance overlay — four corner brackets framing a barcode-
 * shaped target area, plus an animated red scan line that sweeps
 * vertically across the target. Decorative only; the actual
 * decoder reads the whole frame.
 */
function ScanOverlay() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 grid place-items-center"
    >
      <div className="relative h-32 w-56 sm:h-36 sm:w-64">
        {(["tl", "tr", "bl", "br"] as const).map((corner) => (
          <span
            key={corner}
            className={cn(
              "absolute h-6 w-6 border-tomato",
              corner === "tl" && "left-0 top-0 border-l-[3px] border-t-[3px]",
              corner === "tr" && "right-0 top-0 border-r-[3px] border-t-[3px]",
              corner === "bl" &&
                "bottom-0 left-0 border-b-[3px] border-l-[3px]",
              corner === "br" &&
                "bottom-0 right-0 border-b-[3px] border-r-[3px]",
            )}
          />
        ))}
        <motion.div
          className="absolute left-2 right-2 h-[2px] rounded bg-tomato shadow-[0_0_8px_rgba(249,87,56,0.85)]"
          initial={{ top: "12%" }}
          animate={{ top: "88%" }}
          transition={{
            duration: 1.4,
            ease: "easeInOut",
            repeat: Infinity,
            repeatType: "reverse",
          }}
        />
      </div>
    </div>
  );
}
