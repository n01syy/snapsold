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
  /\b(?:rtx\s*\d{3,4}(?:\s*ti|\s*super)?|gtx\s*\d{3,4}(?:\s*ti|\s*super)?|rtx\d{3,4}(?:ti|super)?|gtx\d{3,4}(?:ti|super)?|rx\s?\d{3,4}(?:\s*xt|\s*xtx)?|geforce|radeon|graphics card|video card|gpu|quadro|tesla|arc a\d)\b/i;

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
  /\b(geforce|graphics card|video card|gpu|radeon|founders edition|reference card|gaming oc|gaming x|suprim|ventus|tuf gaming|rog strix|rog matrix|rog astral|aorus|nitro\+|pulse|red devil|phantom|eagle|windforce|gaming trio|challenger|quadro|astral|igame|colorful|inno3d|zotac|pny|palit|kfa2|gainward|galax|rtx\s*\d{4})\b/i;

/** eBay negative keywords — parts, PCs, laptops (GPU searches only). */
export const GPU_SEARCH_EXCLUSIONS =
  '-PC -desktop -laptop -notebook -Omen -"gaming PC" -"gaming pc" -Ryzen -"Core i7" -"Core i5" -"Core i9" -"32GB" -"16GB" -"custom build" -iBuyPower -CyberPower';

/** eBay negative keywords appended to searches for complete-unit queries. */
export const COMPLETE_UNIT_SEARCH_EXCLUSIONS =
  '-cooler -heatsink -keycap -keycaps -ekwb -waterblock -"water block" -"for parts" -"parts only" -"box only" -"cooler only" -"screen only" -"battery only" -mining -crypto -backplate';

/** Full desktops, prebuilts, laptops — not standalone graphics cards. */
const COMPUTER_SYSTEM =
  /\b(gaming pc|gaming desktop|gaming computer|desktop pc|desktop computer|custom pc|custom built|custom build|prebuilt pc|pre-built pc|prebuilt gaming|complete pc|full pc|pc build|pc system|tower pc|hp omen|dell alienware|dell g1[56]|dell xps|lenovo legion|cyberpower|ibuypower|skytech gaming|intel nuc|mini pc|all in one pc|aio pc|windows 11 home|win 11 pro)\b/i;

const CPU_IN_TITLE =
  /\b(intel core i[3579]-?\d{4,5}|core i[3579]-?\d{4,5}|i[3579]-?\d{4,5}f\b|i[3579]-?\d{4,5}k\b|ryzen [579]\s*\d{4}|amd ryzen [579]|amd ryzen\d)\b/i;

const SYSTEM_RAM_STORAGE =
  /\b(\d{2}gb ddr[45]|ddr[45]-\d{4,5}|\d{1,2}tb nvme|\d{1,2}tb ssd|\d{2}gb ram)\b/i;

const LAPTOP_WITH_GPU =
  /\b(laptop|notebook|chromebook|macbook|thinkpad|spectre x360)\b/i;

type ProductCategory = "gpu" | "phone" | "console" | "keyboard" | "generic";

/**
 * Expand glued model names so "rtx5090" and "rtx 5090" share the same logic.
 */
export function normalizeProductQuery(text: string): string {
  return text
    .replace(
      /\b(rtx|gtx)(\d{3,4})(ti|super)?\b/gi,
      (_, chip, num, suffix) =>
        suffix ? `${chip} ${num} ${suffix}` : `${chip} ${num}`,
    )
    .replace(/\biphone(se|\d{1,2})\b/gi, "iphone $1")
    .replace(/\b(galaxy)(s\d{1,2})\b/gi, "$1 $2")
    .replace(/\b(pixel)(\d{1,2})\b/gi, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
}

/** True when the listing is a PC/laptop, not a standalone GPU. */
export function isComputerSystemListing(title: string): boolean {
  const t = title.toLowerCase();

  if (COMPUTER_SYSTEM.test(t)) return true;
  if (LAPTOP_WITH_GPU.test(t)) return true;
  if (SYSTEM_RAM_STORAGE.test(t)) return true;

  // Spec-sheet titles: "RTX 5060 Ti, i7 14700f, 32gb DDR5"
  if (/,\s*(i[3579]|ryzen|core i|intel|amd|\d+gb)/i.test(t)) return true;

  const hasGpuChip =
    /\b(rtx|gtx|geforce|radeon)\s*\d{3,4}/i.test(t) ||
    /\b(rtx|gtx)\d{3,4}/i.test(t);
  const hasCpu = CPU_IN_TITLE.test(t);
  if (hasGpuChip && hasCpu) return true;

  return false;
}

export function inferProductCategory(query: string): ProductCategory {
  const q = normalizeProductQuery(query).toLowerCase();
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
  if (isComputerSystemListing(t)) return false;
  return FULL_GPU_SIGNALS.test(t);
}

/**
 * Minimum plausible sold price for a working GPU of this chip tier.
 * Filters scam/joke "NEW" listings ($211 RTX 5090, etc.).
 */
export function gpuChipPriceFloor(text: string): number | null {
  const tier = extractGpuTier(text);
  if (tier === null) return null;
  if (tier >= 5090) return 1800;
  if (tier >= 5080) return 1200;
  if (tier >= 5070) return 700;
  if (tier >= 5060) return 220;
  if (tier >= 5050) return 180;
  if (tier >= 4090) return 850;
  if (tier >= 4080) return 550;
  if (tier >= 4070) return 380;
  if (tier >= 3090) return 480;
  if (tier >= 3080) return 320;
  if (tier >= 3060) return 180;
  return null;
}

/** Reject full-PC prices that slipped through on mid-range GPU searches. */
export function gpuChipPriceCeiling(text: string): number | null {
  const tier = extractGpuTier(text);
  if (tier === null) return null;
  if (tier >= 5090) return null;
  if (tier >= 5080) return 2000;
  if (tier >= 5070) return 1100;
  if (tier >= 5060) return 700;
  if (tier >= 5050) return 550;
  if (tier >= 4090) return 2200;
  if (tier >= 4080) return 1400;
  if (tier >= 4070) return 900;
  if (tier >= 3060) return 650;
  return 750;
}

function extractGpuTier(text: string): number | null {
  const t = text.toLowerCase();
  const spaced = t.match(/\b(?:rtx|gtx)\s*-?\s*(\d{3,4})(?:\s*ti|\s*super)?\b/);
  const glued = t.match(/\b(?:rtx|gtx)(\d{3,4})(?:ti|super)?\b/);
  if (spaced) return parseInt(spaced[1], 10);
  if (glued) return parseInt(glued[1], 10);
  return null;
}

export function isImplausibleWorkingPrice(
  title: string,
  price: number,
  query: string,
): boolean {
  const normalizedQuery = normalizeProductQuery(query);
  if (!queryExpectsCompleteUnit(normalizedQuery)) return false;
  const category = inferProductCategory(normalizedQuery);
  if (category === "gpu") {
    const combined = `${normalizedQuery} ${title}`;
    const floor = gpuChipPriceFloor(combined);
    if (floor !== null && price < floor) return true;
    const ceiling = gpuChipPriceCeiling(combined);
    if (ceiling !== null && price > ceiling) return true;
  }
  return false;
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
  const q = normalizeProductQuery(query ?? "").toLowerCase();
  const cond = (condition ?? "").toLowerCase();
  const category = inferProductCategory(q);
  const expectsComplete = queryExpectsCompleteUnit(q);

  if (COMPONENT_ONLY.test(t)) return true;
  if (PARTS_OR_INCOMPLETE.test(t)) return true;
  if (PARTS_LOT.test(t)) return true;
  if (GPU_ACCESSORY.test(t)) return true;
  if (PARTIAL_GPU.test(t)) return true;

  // Working-unit pricing: never include broken / for-parts rows
  if (expectsComplete && cond === "broken") return true;

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
    if (isComputerSystemListing(t)) return true;
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
  const normalized = normalizeProductQuery(trimmed);
  const base = `${trimmed} ${COMPLETE_UNIT_SEARCH_EXCLUSIONS}`;
  if (inferProductCategory(normalized) === "gpu") {
    return `${base} ${GPU_SEARCH_EXCLUSIONS}`;
  }
  return base;
}

/** Primary eBay query for a standalone graphics card. */
export function buildGpuCardSearchQuery(query: string): string {
  const q = normalizeProductQuery(query);
  return `${q} graphics card ${COMPLETE_UNIT_SEARCH_EXCLUSIONS} ${GPU_SEARCH_EXCLUSIONS}`;
}
