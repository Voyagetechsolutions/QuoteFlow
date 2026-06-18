import { getQuote, createInvoiceFromQuote } from "../lib/api";
import { useAsync, formatDate, formatCurrency, cn, type NavigateFn } from "../lib/hooks";
import { StatusBadge } from "../components/StatusBadge";
import { useState } from "react";

interface Props {
  quoteId: string;
  navigate: NavigateFn;
}

export function QuoteDetailPage({ quoteId, navigate }: Props) {
  const { data: quote, loading, error } = useAsync(() => getQuote(quoteId), [quoteId]);
  const [converting, setConverting] = useState(false);

  async function handleConvert() {
    if (!quote) return;
    setConverting(true);
    try {
      await createInvoiceFromQuote(quote.id);
      navigate({ name: "invoices" });
    } catch {
      alert("Failed to create invoice from quote.");
    } finally {
      setConverting(false);
    }
  }

  if (loading) return <PageSkeleton />;
  if (error)
    return (
      <div className="mx-auto max-w-5xl">
        <BackButton navigate={navigate} />
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-700">
          {error}
        </div>
      </div>
    );
  if (!quote) return null;

  return (
    <div className="mx-auto max-w-5xl">
      <BackButton navigate={navigate} />

      {/* Header */}
      <div className="mt-4 mb-6 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-slate-900">{quote.number}</h1>
            <StatusBadge status={quote.status} />
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {quote.customerName} · {formatDate(quote.createdAt)}
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => navigate({ name: "quote-builder", editId: quote.id })}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
          >
            Edit
          </button>
          {(quote.status === "DRAFT" || quote.status === "ACCEPTED") && (
            <button
              onClick={handleConvert}
              disabled={converting}
              className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
            >
              {converting ? "Creating…" : "Convert to Invoice"}
            </button>
          )}
        </div>
      </div>

      {/* Lines Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
              <th className="px-4 py-3">Description</th>
              <th className="px-4 py-3 text-right">Cost Rate</th>
              <th className="px-4 py-3 text-right">Margin %</th>
              <th className="px-4 py-3 text-right">Sell Rate</th>
              <th className="px-4 py-3">Currency</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {quote.lines.map((line, i) => (
              <tr key={line.id ?? i} className="hover:bg-slate-50">
                <td className="px-4 py-3 text-slate-700">{line.description}</td>
                <td className="px-4 py-3 text-right text-slate-600">
                  {formatCurrency(line.costRate, line.currency)}
                </td>
                <td className="px-4 py-3 text-right">
                  <span
                    className={cn(
                      "text-sm",
                      line.marginPct > 0
                        ? "text-emerald-600"
                        : line.marginPct < 0
                          ? "text-red-600"
                          : "text-slate-400",
                    )}
                  >
                    {line.marginPct.toFixed(1)}%
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-medium text-slate-900">
                  {formatCurrency(line.sellRate, line.currency)}
                </td>
                <td className="px-4 py-3 text-slate-500">{line.currency}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Totals */}
      <div className="mt-6 grid grid-cols-3 gap-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm text-center">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
            Total Cost
          </p>
          <p className="mt-1 text-xl font-semibold text-slate-700">
            {formatCurrency(quote.totalCost)}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
            Total Sell
          </p>
          <p className="mt-1 text-xl font-semibold text-emerald-700">
            {formatCurrency(quote.totalSell)}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
            Overall Margin
          </p>
          <p
            className={cn(
              "mt-1 text-xl font-semibold",
              quote.overallMarginPct > 0
                ? "text-emerald-700"
                : quote.overallMarginPct < 0
                  ? "text-red-600"
                  : "text-slate-500",
            )}
          >
            {quote.overallMarginPct.toFixed(2)}%
          </p>
        </div>
      </div>
    </div>
  );
}

/* ── Helpers ───────────────────────────────────────────────────── */

function BackButton({ navigate }: { navigate: NavigateFn }) {
  return (
    <button
      onClick={() => navigate({ name: "quotes" })}
      className="flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900"
    >
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
      </svg>
      Back to Quotes
    </button>
  );
}

function PageSkeleton() {
  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="h-6 w-40 animate-pulse rounded bg-slate-200" />
      <div className="h-8 w-64 animate-pulse rounded bg-slate-200" />
      <div className="h-64 animate-pulse rounded-xl bg-slate-100" />
    </div>
  );
}
