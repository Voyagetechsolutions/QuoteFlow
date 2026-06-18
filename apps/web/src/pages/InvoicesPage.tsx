import { useState } from "react";
import type { InvoiceStatus } from "@quoteflow/shared";
import {
  getInvoices,
  getInvoice,
  updateInvoiceStatus,
  deleteInvoice,
  type Invoice,
} from "../lib/api";
import { useAsync, formatDate, formatCurrency, type NavigateFn } from "../lib/hooks";
import { StatusBadge } from "../components/StatusBadge";

interface Props {
  navigate: NavigateFn;
}

export function InvoicesPage({ navigate }: Props) {
  const { data: invoices, loading, error, reload } = useAsync(getInvoices, []);
  const [viewInvoice, setViewInvoice] = useState<Invoice | null>(null);

  return (
    <div className="mx-auto max-w-5xl">
      {viewInvoice ? (
        <InvoiceDetail
          invoice={viewInvoice}
          onBack={() => {
            setViewInvoice(null);
            reload();
          }}
          onReload={async () => {
            try {
              const fresh = await getInvoice(viewInvoice.id);
              setViewInvoice(fresh);
            } catch {
              reload();
              setViewInvoice(null);
            }
          }}
        />
      ) : (
        <>
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-semibold text-slate-900">Invoices</h1>
            <p className="mt-1 text-sm text-slate-500">
              Track payment status of customer invoices.
            </p>
          </div>

          {/* Content */}
          {loading ? (
            <LoadingSkeleton />
          ) : error ? (
            <ErrorCard message={error} onRetry={reload} />
          ) : !invoices || invoices.length === 0 ? (
            <EmptyState navigate={navigate} />
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                    <th className="px-4 py-3">Number</th>
                    <th className="px-4 py-3">Customer</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3 text-right">Total</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {invoices.map((inv: Invoice) => (
                    <tr
                      key={inv.id}
                      className="cursor-pointer transition-colors hover:bg-slate-50"
                      onClick={async () => {
                        try {
                          const detail = await getInvoice(inv.id);
                          setViewInvoice(detail);
                        } catch {
                          setViewInvoice(inv);
                        }
                      }}
                    >
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {inv.number}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {inv.customerName}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={inv.status} />
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {formatDate(inv.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-slate-900">
                        {formatCurrency(inv.total)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (!confirm("Delete this invoice?")) return;
                            await deleteInvoice(inv.id);
                            reload();
                          }}
                          className="rounded-md px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ── Invoice Detail ────────────────────────────────────────────── */

function InvoiceDetail({
  invoice,
  onBack,
  onReload,
}: {
  invoice: Invoice;
  onBack: () => void;
  onReload: () => void;
}) {
  const [updatingStatus, setUpdatingStatus] = useState(false);

  async function changeStatus(status: InvoiceStatus) {
    setUpdatingStatus(true);
    try {
      await updateInvoiceStatus(invoice.id, status);
      onReload();
    } catch {
      alert("Failed to update status.");
    } finally {
      setUpdatingStatus(false);
    }
  }

  const STATUS_TRANSITIONS: Record<string, { label: string; to: InvoiceStatus; color: string }[]> = {
    DRAFT: [
      { label: "Mark Sent", to: "SENT", color: "bg-blue-600 hover:bg-blue-700" },
    ],
    SENT: [
      { label: "Mark Partial", to: "PARTIAL", color: "bg-amber-600 hover:bg-amber-700" },
      { label: "Mark Paid", to: "PAID", color: "bg-emerald-600 hover:bg-emerald-700" },
    ],
    PARTIAL: [
      { label: "Mark Paid", to: "PAID", color: "bg-emerald-600 hover:bg-emerald-700" },
    ],
    PAID: [],
  };

  const transitions = STATUS_TRANSITIONS[invoice.status] ?? [];

  return (
    <div>
      {/* Back */}
      <button
        onClick={onBack}
        className="mb-4 flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
        </svg>
        Back to Invoices
      </button>

      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{invoice.number}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {invoice.customerName} · {formatDate(invoice.createdAt)}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={invoice.status} />
          <button
            onClick={() => window.open(`/api/invoices/${invoice.id}/pdf`, "_blank")}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
          >
            Download PDF
          </button>
          {transitions.map((t) => (
            <button
              key={t.to}
              onClick={() => changeStatus(t.to)}
              disabled={updatingStatus}
              className={`rounded-lg px-4 py-2 text-sm font-medium text-white shadow-sm disabled:opacity-50 ${t.color}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Lines */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
              <th className="px-4 py-3">Description</th>
              <th className="px-4 py-3 text-right">Amount</th>
              <th className="px-4 py-3">Currency</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {invoice.lines?.map((line, i) => (
              <tr key={line.id ?? i} className="hover:bg-slate-50">
                <td className="px-4 py-3 text-slate-700">{line.description}</td>
                <td className="px-4 py-3 text-right font-medium text-slate-900">
                  {formatCurrency(line.amount, line.currency)}
                </td>
                <td className="px-4 py-3 text-slate-500">{line.currency}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-slate-200 bg-slate-50">
              <td className="px-4 py-3 text-right font-semibold text-slate-700">
                Total
              </td>
              <td className="px-4 py-3 text-right text-lg font-bold text-slate-900">
                {formatCurrency(invoice.total)}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

/* ── Shared States ─────────────────────────────────────────────── */

function EmptyState({ navigate }: { navigate: NavigateFn }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-white px-6 py-16 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
        <svg className="h-7 w-7 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-slate-900">No invoices yet</h3>
      <p className="mt-2 max-w-sm text-sm text-slate-500">
        Invoices are created from accepted quotes. Create a quote first, then convert it to an invoice.
      </p>
      <button
        onClick={() => navigate({ name: "quote-builder" })}
        className="mt-6 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-slate-800"
      >
        Create a Quote
      </button>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-16 animate-pulse rounded-xl border border-slate-200 bg-white" />
      ))}
    </div>
  );
}

function ErrorCard({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
      <p className="text-sm text-red-700">{message}</p>
      <button onClick={onRetry} className="mt-3 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700">
        Retry
      </button>
    </div>
  );
}
