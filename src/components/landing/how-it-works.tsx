import { Camera, Cpu, DollarSign } from "lucide-react";

const STEPS = [
  {
    icon: Camera,
    title: "1. Capture",
    body: "Photo, barcode, or product name. Whichever you have on hand.",
  },
  {
    icon: Cpu,
    title: "2. Analyse",
    body: "We identify the product, pull eBay sold listings, and strip outliers.",
  },
  {
    icon: DollarSign,
    title: "3. Price",
    body: "Three price points, a confidence score, and a ready-to-paste listing title.",
  },
] as const;

export function HowItWorks() {
  return (
    <section id="how-it-works" className="relative py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl">
            From mystery item to listing-ready, in under 10 seconds.
          </h2>
        </div>

        <div className="relative mx-auto mt-14 grid max-w-4xl gap-6 sm:grid-cols-3">
          {/* Connector line on desktop — warm sunset sweep */}
          <div
            aria-hidden
            className="pointer-events-none absolute left-0 right-0 top-6 hidden h-px sm:block"
            style={{
              backgroundImage:
                "linear-gradient(to right, transparent 0%, #f95738 25%, #ee964b 50%, #f4d35e 75%, transparent 100%)",
              opacity: 0.55,
            }}
          />

          {STEPS.map(({ icon: Icon, title, body }) => (
            <div key={title} className="relative flex flex-col items-center text-center">
              <div className="relative z-10 grid h-12 w-12 place-items-center rounded-full border border-tomato/30 bg-card shadow-sm">
                <Icon className="h-5 w-5 text-tomato" />
              </div>
              <h3 className="mt-4 font-semibold tracking-tight">{title}</h3>
              <p className="mt-2 max-w-xs text-sm text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
