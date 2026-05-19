"use client";

import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ListingHandoffProps {
  /** Title to seed eBay's prelist suggest flow with. */
  title: string;
}

/**
 * "Start listing on eBay" button.
 *
 * Opens eBay's `/sl/prelist/suggest` endpoint in a new tab with
 * the analysed product's title pre-filled. The visitor lands on
 * eBay's "We'll help you sell" page, which routes them through
 * category selection, condition, photos, and ultimately the
 * listing draft — already seeded with the right product context.
 *
 * Why this is the right handoff (not direct draft creation):
 *
 *   Programmatically creating an eBay listing draft requires
 *   OAuth into the seller's eBay account via the Inventory API,
 *   which is a heavyweight consent + token-refresh flow that's
 *   out of scope for the current build. The prelist deep link
 *   is the deepest no-auth entry point eBay exposes — every
 *   reseller tool that doesn't have OAuth uses this same URL
 *   pattern.
 *
 * Why a real anchor (not window.open):
 *   Keeps middle-click "open in new tab" working, lets browsers
 *   show the destination on hover, and matches eBay's CTRL+
 *   click conventions. The `render={<a/>}` pattern below has
 *   Base UI's Button render its visual chrome around a real
 *   anchor element.
 */
export function ListingHandoff({ title }: ListingHandoffProps) {
  const url = `https://www.ebay.com/sl/prelist/suggest?query=${encodeURIComponent(
    title,
  )}`;
  return (
    <Button
      variant="default"
      size="sm"
      render={<a href={url} target="_blank" rel="noreferrer" />}
      className="min-w-0 flex-1 gap-1.5 bg-tomato px-2 font-display text-xs font-semibold text-beige shadow-sm shadow-tomato/20 hover:bg-tomato/90 sm:flex-none sm:px-2.5 sm:text-sm"
    >
      <ExternalLink className="h-4 w-4 shrink-0" />
      <span className="truncate sm:hidden">eBay</span>
      <span className="hidden truncate sm:inline">List on eBay</span>
    </Button>
  );
}
