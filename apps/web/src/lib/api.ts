/**
 * QuoteFlow API client.
 * Vite proxies /api → http://localhost:3000, so base URL is empty.
 */

import type {
  ExtractedRateRow,
  QuoteStatus,
  InvoiceStatus,
} from "@quoteflow/shared";

// ─── Generic helpers ────────────────────────────────────────────

async function request<T>(
  url: string,
  opts: RequestInit = {},
): Promise<T> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json", ...opts.headers },
    ...opts,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new ApiError(res.status, body || res.statusText);
  }
  if (res.status === 204) return undefined as unknown as T;
  return res.json();
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

// ─── Rate Sets ──────────────────────────────────────────────────

export interface RateSet {
  id: string;
  name: string;
  sourceFile: string;
  extractor: string;
  rowCount: number;
  needsReviewCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface RateSetDetail extends RateSet {
  rows: (ExtractedRateRow & { id: string })[];
}

export function getRateSets(): Promise<RateSet[]> {
  return request<RateSet[]>("/api/rate-sets");
}

export function getRateSet(id: string): Promise<RateSetDetail> {
  return request<RateSetDetail>(`/api/rate-sets/${id}`);
}

export function uploadRateSet(file: File): Promise<RateSet> {
  const body = new FormData();
  body.append("file", file);
  return request<RateSet>("/api/rate-sets/upload", {
    method: "POST",
    headers: {}, // let browser set multipart boundary
    body,
  });
}

export function updateRateRow(
  rateSetId: string,
  rowId: string,
  patch: Partial<ExtractedRateRow>,
): Promise<ExtractedRateRow & { id: string }> {
  return request(`/api/rate-sets/${rateSetId}/rows/${rowId}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export function deleteRateSet(id: string): Promise<void> {
  return request(`/api/rate-sets/${id}`, { method: "DELETE" });
}

// ─── Customers ──────────────────────────────────────────────────

export interface Customer {
  id: string;
  name: string;
  email: string;
  contact: string;
  createdAt: string;
}

export function getCustomers(): Promise<Customer[]> {
  return request<Customer[]>("/api/customers");
}

export function createCustomer(
  data: Omit<Customer, "id" | "createdAt">,
): Promise<Customer> {
  return request<Customer>("/api/customers", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateCustomer(
  id: string,
  data: Partial<Omit<Customer, "id" | "createdAt">>,
): Promise<Customer> {
  return request<Customer>(`/api/customers/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function deleteCustomer(id: string): Promise<void> {
  return request(`/api/customers/${id}`, { method: "DELETE" });
}

// ─── Quotes ─────────────────────────────────────────────────────

export interface QuoteLine {
  id?: string;
  description: string;
  costRate: number;
  marginPct: number;
  sellRate: number;
  currency: string;
}

export interface Quote {
  id: string;
  number: string;
  customerId: string;
  customerName: string;
  status: QuoteStatus;
  lines: QuoteLine[];
  totalCost: number;
  totalSell: number;
  overallMarginPct: number;
  createdAt: string;
  updatedAt: string;
}

export function getQuotes(): Promise<Quote[]> {
  return request<Quote[]>("/api/quotes");
}

export function getQuote(id: string): Promise<Quote> {
  return request<Quote>(`/api/quotes/${id}`);
}

export function createQuote(
  data: Omit<Quote, "id" | "number" | "createdAt" | "updatedAt">,
): Promise<Quote> {
  return request<Quote>("/api/quotes", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateQuote(
  id: string,
  data: Partial<Quote>,
): Promise<Quote> {
  return request<Quote>(`/api/quotes/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function deleteQuote(id: string): Promise<void> {
  return request(`/api/quotes/${id}`, { method: "DELETE" });
}

// ─── Invoices ───────────────────────────────────────────────────

export interface InvoiceLine {
  id?: string;
  description: string;
  amount: number;
  currency: string;
}

export interface Invoice {
  id: string;
  number: string;
  quoteId?: string;
  customerId: string;
  customerName: string;
  status: InvoiceStatus;
  lines: InvoiceLine[];
  total: number;
  createdAt: string;
  updatedAt: string;
}

export function getInvoices(): Promise<Invoice[]> {
  return request<Invoice[]>("/api/invoices");
}

export function getInvoice(id: string): Promise<Invoice> {
  return request<Invoice>(`/api/invoices/${id}`);
}

export function createInvoiceFromQuote(quoteId: string): Promise<Invoice> {
  return request<Invoice>("/api/invoices/from-quote", {
    method: "POST",
    body: JSON.stringify({ quoteId }),
  });
}

export function updateInvoiceStatus(
  id: string,
  status: InvoiceStatus,
): Promise<Invoice> {
  return request<Invoice>(`/api/invoices/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export function deleteInvoice(id: string): Promise<void> {
  return request(`/api/invoices/${id}`, { method: "DELETE" });
}
