import { SiteNav } from "@/components/nav/site-nav";
import { SiteFooter } from "@/components/nav/site-footer";
import { Hero } from "@/components/landing/hero";
import { Features } from "@/components/landing/features";
import { HowItWorks } from "@/components/landing/how-it-works";
import { SampleResult } from "@/components/landing/sample-result";
import { Faq } from "@/components/landing/faq";
import { FooterCta } from "@/components/landing/footer-cta";

export default function LandingPage() {
  return (
    <>
      <SiteNav />
      <main className="flex-1">
        <Hero />
        <Features />
        <HowItWorks />
        <SampleResult />
        <Faq />
        <FooterCta />
      </main>
      <SiteFooter />
    </>
  );
}
