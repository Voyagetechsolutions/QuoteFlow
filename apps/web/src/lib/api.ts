/**
 * QuoteFlow API client.
 * Vite proxies /api → http://localhost:3000, so base URL is empty.
 */

import type {
  ExtractedRateRow,
  ExtractionResult,
  QuoteStatus,
  InvoiceStatus,
} from "@quoteflow/shared";

// ─── Generic helpers ────────────────────────────────────────────

async function request<T>(
  url: string,
  opts: RequestInit = {},
): Promise<T> {
  const headers: Record<string, string> = { ...(opts.headers as object) };
  // Don't force JSON content-type on FormData (multipart) uploads.
  if (!(opts.body instanceof FormData) && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(url, { ...opts, headers });

  if (res.status === 401 && !url.startsWith("/api/auth")) {
    // Session expired/invalid — drop it and let the app fall back to login.
    clearToken();
    window.dispatchEvent(new Event("qf-unauthorized"));
  }
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

// ─── Auth ───────────────────────────────────────────────────────

const TOKEN_KEY = "qf_token";
export const getToken = (): string | null => localStorage.getItem(TOKEN_KEY);
const setToken = (t: string): void => localStorage.setItem(TOKEN_KEY, t);
export const clearToken = (): void => localStorage.removeItem(TOKEN_KEY);

export interface AuthUser {
  id: string;
  companyId: string;
  role: string;
  email: string;
}

export async function login(email: string, password: string): Promise<AuthUser> {
  const r = await request<{ accessToken: string; user: AuthUser }>(
    "/api/auth/login",
    { method: "POST", body: JSON.stringify({ email, password }) },
  );
  setToken(r.accessToken);
  return r.user;
}

export async function register(
  companyName: string,
  email: string,
  password: string,
): Promise<AuthUser> {
  const r = await request<{ accessToken: string; user: AuthUser }>(
    "/api/auth/register",
    { method: "POST", body: JSON.stringify({ companyName, email, password }) },
  );
  setToken(r.accessToken);
  return r.user;
}

export const getMe = (): Promise<AuthUser> => request<AuthUser>("/api/auth/me");

export const logout = (): void => {
  clearToken();
  window.dispatchEvent(new Event("qf-unauthorized"));
};

/**
 * Open an authenticated binary endpoint (e.g. a PDF) in a new tab. window.open
 * can't send the Authorization header, so fetch it as a blob and open that.
 */
export async function openAuthedPdf(path: string): Promise<void> {
  const token = getToken();
  const res = await fetch(path, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    if (res.status === 401) {
      clearToken();
      window.dispatchEvent(new Event("qf-unauthorized"));
    }
    throw new ApiError(res.status, await res.text().catch(() => ""));
  }
  const url = URL.createObjectURL(await res.blob());
  window.open(url, "_blank");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export interface SendResult {
  sent: boolean;
  preview?: boolean;
  to: string;
}

export const sendQuote = (id: string): Promise<SendResult> =>
  request<SendResult>(`/api/quotes/${id}/send`, { method: "POST" });

export const sendInvoice = (id: string): Promise<SendResult> =>
  request<SendResult>(`/api/invoices/${id}/send`, { method: "POST" });

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

/**
 * Stateless extraction — upload a sheet, get rows back for review (not saved).
 * Maps to POST /api/rate-sets/extract.
 */
export function extractRateSheet(file: File): Promise<ExtractionResult> {
  const body = new FormData();
  body.append("file", file);
  return request<ExtractionResult>("/api/rate-sets/extract", {
    method: "POST",
    headers: {}, // let the browser set the multipart boundary
    body,
  });
}

/** Persist a reviewed extraction as a reusable rate set (POST /api/rate-sets). */
export function saveRateSet(data: {
  name: string;
  sourceFilename?: string;
  extractor?: string;
  validFrom?: string | null;
  validTo?: string | null;
  rows: ExtractedRateRow[];
}): Promise<RateSet> {
  return request<RateSet>("/api/rate-sets", {
    method: "POST",
    body: JSON.stringify(data),
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
