/**
 * Shared domain types for QuoteFlow, imported by both the API and the web app.
 *
 * The ExtractedRateRow shape is the contract produced by the extraction spike
 * (spike/extract.py + spike/vision_extract.py) and consumed by the editable
 * review table. Keep it in sync with the Python canonical schema.
 */

export const CURRENCIES = [
  "USD",
  "ZAR",
  "EUR",
  "GBP",
  "ZWL",
  "BWP",
  "ZMW",
  "MWK",
] as const;
export type Currency = (typeof CURRENCIES)[number];

export const CHARGE_TYPES = [
  "Ocean Freight",
  "Road Freight",
  "Air Freight",
  "Local Charge",
] as const;
export type ChargeType = (typeof CHARGE_TYPES)[number] | string;

/** Canonical basis enum — how a rate is charged. */
export const BASES = [
  "per_container_20",
  "per_container_40",
  "per_truck",
  "per_cbm",
  "per_kg",
  "per_shipment",
  "per_bl",
  "flat",
] as const;
export type Basis = (typeof BASES)[number];

/**
 * One row as it comes OUT of extraction, before the user has reviewed it.
 * `needsReview` + `issues` drive the review table: flagged rows surface first.
 * Mirrors the Python RateRow dataclass.
 */
export interface ExtractedRateRow {
  chargeType: ChargeType | null;
  laneOrigin: string | null;
  laneDestination: string | null; // null is valid for Local Charge
  unit: string | null;
  rate: number | null;
  currency: Currency | null;
  validFrom: string | null; // ISO date
  validTo: string | null; // ISO date
  remark: string | null;
  // --- normalization layer (deterministic post-pass) ---
  chargeCode: string | null; // canonical: THC, BAF, FREIGHT, ...
  chargeLabel: string | null; // raw label as it appeared on the sheet
  basis: Basis | null; // canonical basis enum
  confidence: number; // 0..1, lowered for missing money-critical fields
  needsReview: boolean;
  issues: string[];
  source: string; // raw cell text, shown in the review table for context
}

export interface ExtractionResult {
  sourceFile: string;
  extractor: string; // e.g. "table/xlsx", "vision/claude-sonnet-4-6"
  rowCount: number;
  needsReviewCount: number;
  rows: ExtractedRateRow[];
}

export type Role = "OWNER" | "STAFF";
export type QuoteStatus = "DRAFT" | "SENT" | "ACCEPTED" | "REJECTED";
export type InvoiceStatus = "DRAFT" | "SENT" | "PARTIAL" | "PAID";

export interface MarginLine {
  costRate: number;
  sellRate: number;
  /** sell = cost * (1 + marginPct/100); margin% derived if sell is set directly */
  marginPct: number;
}

/** cost -> sell given a margin %. */
export function applyMargin(costRate: number, marginPct: number): number {
  return Math.round(costRate * (1 + marginPct / 100) * 100) / 100;
}

/** realised margin % from a cost/sell pair. */
export function marginPctOf(costRate: number, sellRate: number): number {
  if (costRate === 0) return 0;
  return Math.round(((sellRate - costRate) / costRate) * 10000) / 100;
}
