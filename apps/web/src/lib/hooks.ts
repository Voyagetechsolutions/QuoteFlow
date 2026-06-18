import { useCallback, useEffect, useRef, useState } from "react";

// ─── Navigation ─────────────────────────────────────────────────

export type Page =
  | { name: "rate-sets" }
  | { name: "rate-set-detail"; id: string }
  | { name: "quotes" }
  | { name: "quote-builder"; editId?: string }
  | { name: "quote-detail"; id: string }
  | { name: "invoices" }
  | { name: "invoice-detail"; id: string }
  | { name: "customers" };

export type NavigateFn = (page: Page) => void;

// ─── useAsync – generic fetch hook ─────────────────────────────

interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

export function useAsync<T>(
  fetcher: () => Promise<T>,
  deps: unknown[] = [],
): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const counter = useRef(0);

  const load = useCallback(() => {
    const id = ++counter.current;
    setLoading(true);
    setError(null);
    fetcher()
      .then((result) => {
        if (id === counter.current) {
          setData(result);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (id === counter.current) {
          setError(err instanceof Error ? err.message : String(err));
          setLoading(false);
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    load();
  }, [load]);

  return { data, loading, error, reload: load };
}

// ─── useDebounce ────────────────────────────────────────────────

export function useDebounce<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

// ─── Format helpers ─────────────────────────────────────────────

export function formatCurrency(
  amount: number,
  currency = "USD",
): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}
