/**
 * Detect sold listings that are parts, accessories, or incomplete units
 * when the user is pricing a complete product — GPUs, phones, consoles,
 * keyboards, cameras, etc.
 */

import type { SoldListing } from "./types";

/** User explicitly wants parts/repair items — don't strip them. */
const PARTS_QUERY =
  /\b(for parts|parts only|part only|replacement part|repair part|spare part|screen replacement|battery replacement|fix only|cooler only|keycaps only|shell only|housing only|board only|logic board|water block)\b/i;

const GPU_QUERY =
  /\b(rtx|gtx|rx \d|rx\d|geforce|radeon|graphics card|video card|gpu|quadro|tesla|arc a\d)\b/i;

const PHONE_QUERY =
  /\b(iphone|galaxy s|galaxy z|pixel \d|pixel\d|oneplus|android phone|smartphone)\b/i;

const CONSOLE_QUERY =
  /\b(ps5|ps4|ps3|playstation|xbox series|xbox one|xbox 360|nintendo switch|switch oled|switch lite|wii u|wii)\b/i;

const KEYBOARD_QUERY = /\b(keyboard|keychron|womier|keychron)\b/i;

/**
 * Components sold alone — never the full product unless the query
 * is itself for that component category.
 */
const COMPONENT_ONLY =
  /\b(cooler only|heatsink only|heat sink only|fan only|fans only|shroud only|bracket only|backplate only|vapor chamber only|water block only|waterblock only|pcb only|gpu core only|chip only|die only|screen only|lcd only|oled only|display only|digitizer only|glass only|battery only|charger only|charging port only|cable only|cord only|adapter only|power supply only|psu only|remote only|case only|shell only|housing only|cover only|lid only|faceplate only|bezel only|tray only|insert only|manual only|booklet only|packaging only|empty box|box only|disk drive only|dvd drive only|bluray drive only|joycon only|joy con only|keycaps only|keycap set only|key cap set|switches only|switch set only|stabilizers only|plate only|fmr only|hdd only|ssd only|hard drive only|memory only|ram only|camera module only|lens only|body only|grip only|strap only|band only|link only|buckle only|pouch only|bag only|sleeve only|dock only|stand only|mount only|logic board only|motherboard only|main board only|board only)\b/i;

/** GPU-specific accessories — mention the chip but aren't the card. */
const GPU_ACCESSORY =
  /\b(ekwb|ek water block|ek-quantum|ek quantum|ekwb|bykski|barrow|bitspower|alphacool|water block|waterblock|water-block|gpu block|video card block|vector fe|vector³|vector 3|vector3|hydro x|gpu backplate|backplate only|anti sag|anti-sag|gpu bracket|gpu brace|gpu support|pcie riser|riser cable|thermal pad|thermal pads|repaste kit|watercool|water cool|liquid cooling kit|aio bracket|monoblock|full cover block|full-cover block)\b/i;

/** Partial GPU listings eBay marks as broken / for parts. */
const PARTIAL_GPU =
  /\b(rtx|gtx|rx)\s*\d{3,4}\s+only\b|\b(geforce|graphics card|video card|gpu)\s+only\b|\b\d{4}\s+only\b/i;

const PARTS_OR_INCOMPLETE =
  /\b(for parts|parts only|parting out|part out|partingout|spares or repair|spares\/repair|for repair|repair only|not working|doesn't work|does not work|doesnt work|non working|non-working|won't turn on|wont turn on|no power|dead unit|salvage|as-is|as is|for scrap|scrap only|broken only|damaged only|cracked screen only|icloud locked|bad esn|blacklisted)\b/i;

const ACCESSORY_NOT_PRODUCT =
  /\b(keycaps?|keycap set|key caps|replacement cable|coiled cable|desk mat|mousepad|skin only|decal only|sticker only|wrap only|protector only|tempered glass only|screen protector only)\b/i;

const PARTS_LOT = /\b(lot of parts|parts lot|parts bundle)\b/i;

/** Unrelated categories that piggyback GPU keywords in titles. */
const UNRELATED_TO_GPU =
  /\b(crypto|cryptocurrency|bitcoin|btc|ethereum|eth|mining rig|mining farm|miner rig|mining hardware|mining motherboard|asic|hashrate|altcoin)\b/i;

/** Title signals a complete graphics card listing. */
const FULL_GPU_SIGNALS =
  /\b(geforce|graphics card|video card|gpu|radeon|founders edition|reference card|gaming oc|gaming x|suprim|ventus|tuf gaming|rog strix|aorus|nitro\+|pulse|red devil|phantom|eagle|windforce|gaming trio|challenger|macpro|quadro)\b/i;

/** eBay negative keywords appended to searches for complete-unit queries. */
export const COMPLETE_UNIT_SEARCH_EXCLUSIONS =
  '-cooler -heatsink -keycap -keycaps -ekwb -waterblock -"water block" -"for parts" -"parts only" -"box only" -"cooler only" -"screen only" -"battery only" -mining -crypto -backplate';

type ProductCategory = "gpu" | "phone" | "console" | "keyboard" | "generic";

export function inferProductCategory(query: string): ProductCategory {
  const q = query.toLowerCase();
  if (GPU_QUERY.test(q)) return "gpu";
  if (PHONE_QUERY.test(q)) return "phone";
  if (CONSOLE_QUERY.test(q)) return "console";
  if (KEYBOARD_QUERY.test(q)) return "keyboard";
  return "generic";
}

export function queryExpectsCompleteUnit(query: string): boolean {
  return !PARTS_QUERY.test(query.toLowerCase());
}

function hasFullGpuProductSignals(title: string): boolean {
  const t = title.toLowerCase();
  if (GPU_ACCESSORY.test(t)) return false;
  if (PARTIAL_GPU.test(t)) return false;
  return FULL_GPU_SIGNALS.test(t);
}

/**
 * True when a listing is parts, an accessory, or an incomplete unit
 * and should not inform pricing for a complete-product search.
 */
export function isPartsOrAccessoryListing(
  title: string,
  condition?: SoldListing["condition"] | string,
  query?: string,
): boolean {
  const t = title.toLowerCase();
  const q = (query ?? "").toLowerCase();
  const cond = (condition ?? "").toLowerCase();
  const category = inferProductCategory(q);
  const expectsComplete = queryExpectsCompleteUnit(q);

  if (COMPONENT_ONLY.test(t)) return true;
  if (PARTS_OR_INCOMPLETE.test(t)) return true;
  if (PARTS_LOT.test(t)) return true;
  if (GPU_ACCESSORY.test(t)) return true;
  if (PARTIAL_GPU.test(t)) return true;

  // Internal condition enum — eBay "For parts" maps to "broken"
  if (expectsComplete && cond === "broken") {
    if (PARTS_OR_INCOMPLETE.test(t)) return true;
    if (GPU_ACCESSORY.test(t)) return true;
    if (PARTIAL_GPU.test(t)) return true;
    if (category === "gpu" && !hasFullGpuProductSignals(t)) return true;
  }

  if (ACCESSORY_NOT_PRODUCT.test(t) && !/\bkeyboard\b/.test(t)) return true;

  if (/\bcontroller only\b/.test(t)) {
    if (!/\b(controller|dualsense|joypad|gamepad|game controller)\b/.test(q)) {
      return true;
    }
    return false;
  }

  if (/\bconsole only\b/.test(t)) {
    if (
      !/\b(console|ps5|ps4|playstation|xbox|switch|wii|nintendo)\b/.test(q)
    ) {
      return true;
    }
    return false;
  }

  if (
    /\b(box|manual|case|shell|screen|lcd|display|battery|charger|cable|adapter|remote|cover|lid|tray|insert|housing|cooler|heatsink|fan|shroud|bracket|pcb|keycap|switch|plate|drive|disk|cartridge|wheel|tire|strap|band|lens|camera|module|board|logic board|motherboard|water block|waterblock|backplate)\s+only\b/i.test(
      t,
    )
  ) {
    return true;
  }

  // GPU-specific: must look like a graphics card, not mining gear or a block
  if (expectsComplete && category === "gpu") {
    if (UNRELATED_TO_GPU.test(t)) return true;
    if (!hasFullGpuProductSignals(t)) return true;
  }

  return false;
}

/**
 * Build an eBay `_nkw` string with negative keywords that push parts
 * listings out of the result set before we even filter locally.
 */
export function withCompleteUnitExclusions(query: string): string {
  const trimmed = query.trim();
  if (!trimmed || !queryExpectsCompleteUnit(trimmed)) return trimmed;
  return `${trimmed} ${COMPLETE_UNIT_SEARCH_EXCLUSIONS}`;
}
