import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Sora } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Sora — geometric, modern display sans. Used for all headings to deliver a
// bold, Apple-keynote-style display feel while keeping Geist for body copy.
const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: {
    default: "Snapsold — AI resale pricing, in seconds",
    template: "%s · Snapsold",
  },
  description:
    "Upload a photo, scan a barcode, or type a name. Snapsold analyses real eBay sold listings and tells you the exact price to list at.",
  keywords: [
    "resale pricing",
    "eBay sold listings",
    "AI pricing",
    "reseller tools",
    "flip calculator",
  ],
  authors: [{ name: "Snapsold" }],
  icons: {
    icon: [{ url: "/snapsoldicon.png", type: "image/png" }],
    apple: [{ url: "/snapsoldicon.png", type: "image/png" }],
  },
  openGraph: {
    title: "Snapsold — AI resale pricing, in seconds",
    description:
      "Real eBay sold-listing data + AI. Know what your stuff actually sells for.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#ebebd3",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      // Light theme is the default — warm editorial palette (beige paper,
      // navy ink, tomato CTA). Dark mode is kept available for a future
      // toggle. `suppressHydrationWarning` is for the theme-toggle to come.
      className={`${geistSans.variable} ${geistMono.variable} ${sora.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      {/*
        `suppressHydrationWarning` on <body> swallows the harmless
        attribute drift caused by browser extensions (Bitdefender's
        `bis_skin_checked` / `bis_register`, Grammarly's `data-gr-*`,
        etc.). These extensions mutate the DOM before React hydrates,
        so the server HTML and the client tree disagree on attributes
        we never wrote. React's warning is one-level — it does not
        cascade into our actual app tree.
      */}
      <body
        className="min-h-full flex flex-col"
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
