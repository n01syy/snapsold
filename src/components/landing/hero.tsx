import { HeroDropzone } from "./hero-dropzone";

export function Hero() {
  return (
    <section className="relative isolate overflow-hidden">
      {/* Decorative paper grid — navy hairlines on the beige base, faded
          out at the edges so it reads like a printed page guide. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.07]"
        style={{
          backgroundImage:
            "linear-gradient(to right, #083d77 1px, transparent 1px), linear-gradient(to bottom, #083d77 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          maskImage:
            "radial-gradient(ellipse 60% 50% at 50% 0%, black 40%, transparent 80%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 60% 50% at 50% 0%, black 40%, transparent 80%)",
        }}
      />

      <div className="mx-auto max-w-7xl px-4 pb-20 pt-16 sm:px-6 sm:pt-24 lg:px-8 lg:pb-28 lg:pt-32">
        <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
          <h1 className="text-balance text-4xl font-extrabold tracking-tighter sm:text-5xl md:text-6xl lg:text-7xl">
            Know what your stuff
            <br />
            <span className="text-gradient-brand">actually sells for.</span>
          </h1>

          <p className="mt-6 max-w-xl text-pretty text-base text-muted-foreground sm:text-lg">
            Snap a photo, scan a barcode, or type a name. Snapsold analyses
            real eBay sold listings and gives you a quick-sale, recommended,
            and max-profit price — in seconds.
          </p>

          <div className="mt-10 w-full">
            <HeroDropzone />
          </div>
        </div>
      </div>
    </section>
  );
}
