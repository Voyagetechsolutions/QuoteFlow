import { useEffect, useMemo, useState, useCallback } from "react";
import type { ExtractedRateRow } from "@quoteflow/shared";
import {
  getRateSet,
  updateRateRow,
  getCustomers,
  createQuoteFromRateSet,
  type RateSetDetail,
  type Customer,
} from "../lib/api";
import { useAsync, cn, type NavigateFn } from "../lib/hooks";
import { Modal } from "../components/Modal";
import { WarningIcon, CheckIcon } from "../components/icons";

interface Props {
  rateSetId: string;
  navigate: NavigateFn;
}

export function RateSetDetailPage({ rateSetId, navigate }: Props) {
  const {
    data: rateSet,
    loading,
    error,
    reload,
  } = useAsync(() => getRateSet(rateSetId), [rateSetId]);

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
  if (!rateSet) return null;

  return (
    <ReviewTable
      rateSet={rateSet}
      navigate={navigate}
      onSaved={reload}
    />
  );
}

/* ── Back Button ───────────────────────────────────────────────── */

function BackButton({ navigate }: { navigate: NavigateFn }) {
  return (
    <button
      onClick={() => navigate({ name: "rate-sets" })}
      className="flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900"
    >
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
      </svg>
      Back to Rate Sets
    </button>
  );
}

/* ── Review Table ──────────────────────────────────────────────── */

function ReviewTable({
  rateSet,
  navigate,
  onSaved,
}: {
  rateSet: RateSetDetail;
  navigate: NavigateFn;
  onSaved: () => void;
}) {
  type RowWithId = ExtractedRateRow & { id: string };
  const [rows, setRows] = useState<RowWithId[]>(rateSet.rows);
  const [dirtyIds, setDirtyIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);

  const pricedCount = rows.filter((r) => r.rate !== null).length;

  // Sort: flagged rows first
  const ordered = useMemo(
    () =>
      [...rows]
        .map((row, idx) => ({ row, idx }))
        .sort((a, b) => Number(b.row.needsReview) - Number(a.row.needsReview)),
    [rows],
  );

  const needsReview = rows.filter((r) => r.needsReview).length;

  const update = useCallback(
    <K extends keyof ExtractedRateRow>(
      idx: number,
      key: K,
      value: ExtractedRateRow[K],
    ) => {
      setRows((prev) =>
        prev.map((r, i) => {
          if (i !== idx) return r;
          const updated = { ...r, [key]: value };
          setDirtyIds((d) => new Set(d).add(r.id));
          return updated;
        }),
      );
    },
    [],
  );

  async function handleSave() {
    setSaving(true);
    try {
      const promises = rows
        .filter((r) => dirtyIds.has(r.id))
        .map((r) => {
          const { id, ...rest } = r;
          return updateRateRow(rateSet.id, id, rest);
        });
      await Promise.all(promises);
      setDirtyIds(new Set());
      onSaved();
    } catch {
      alert("Failed to save some rows. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <BackButton navigate={navigate} />

      {/* Header */}
      <div className="mt-4 mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">{rateSet.name}</h1>
        <p className="mt-1 text-sm text-slate-500">
          Source: <span className="font-mono">{rateSet.sourceFile}</span> · Extractor:{" "}
          <span className="font-mono">{rateSet.extractor}</span>
        </p>
      </div>

      {/* Stats bar */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3 text-sm text-slate-600">
          <span>{rows.length} rows extracted</span>
          {needsReview > 0 ? (
            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
              {needsReview} need review
            </span>
          ) : (
            <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
              All clear
            </span>
          )}
          {dirtyIds.size > 0 && (
            <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
              {dirtyIds.size} unsaved
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setGenerating(true)}
            disabled={pricedCount === 0}
            className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
            title={
              dirtyIds.size > 0
                ? "Tip: save your edits first so the quote uses them"
                : "Generate a priced draft quote from these rates"
            }
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
            Generate quote
          </button>
          <button
            onClick={handleSave}
            disabled={dirtyIds.size === 0 || saving}
            className="flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ? (
              <>
                <Spinner /> Saving…
              </>
            ) : (
              "Save Changes"
            )}
          </button>
        </div>
      </div>

      {generating && (
        <GenerateQuoteModal
          rateSetId={rateSet.id}
          pricedCount={pricedCount}
          skippedCount={rows.length - pricedCount}
          onClose={() => setGenerating(false)}
          onGenerated={(quoteId) =>
            navigate({ name: "quote-detail", id: quoteId })
          }
        />
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
              <th className="px-3 py-3 w-8">#</th>
              <th className="px-3 py-3">Code</th>
              <th className="px-3 py-3">Origin</th>
              <th className="px-3 py-3">Destination</th>
              <th className="px-3 py-3">Basis</th>
              <th className="px-3 py-3">Rate</th>
              <th className="px-3 py-3">Ccy</th>
              <th className="px-3 py-3">Conf</th>
              <th className="px-3 py-3">Valid From</th>
              <th className="px-3 py-3">Valid To</th>
              <th className="px-3 py-3">Issues</th>
            </tr>
          </thead>
          <tbody>
            {ordered.map(({ row, idx }) => {
              const dirty = dirtyIds.has(row.id);
              return (
                <tr
                  key={row.id}
                  className={cn(
                    "border-t transition-colors",
                    row.needsReview
                      ? "border-amber-200 bg-amber-50/70"
                      : "border-slate-100 hover:bg-slate-50/50",
                    dirty && "ring-1 ring-inset ring-blue-200",
                  )}
                >
                  <td className="px-3 py-2 text-xs text-slate-400">{idx + 1}</td>
                  <td className="px-3 py-2">
                    <Cell
                      value={row.chargeCode}
                      onChange={(v) => update(idx, "chargeCode", v || null)}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Cell
                      value={row.laneOrigin}
                      flagged={row.issues.includes("missing origin")}
                      onChange={(v) => update(idx, "laneOrigin", v)}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Cell
                      value={row.laneDestination}
                      onChange={(v) => update(idx, "laneDestination", v)}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Cell
                      value={row.basis}
                      flagged={row.basis === null}
                      onChange={(v) =>
                        update(
                          idx,
                          "basis",
                          (v || null) as ExtractedRateRow["basis"],
                        )
                      }
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Cell
                      value={row.rate}
                      flagged={row.rate === null}
                      onChange={(v) =>
                        update(idx, "rate", v === "" ? null : Number(v))
                      }
                      type="number"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Cell
                      value={row.currency}
                      flagged={row.currency === null}
                      onChange={(v) =>
                        update(
                          idx,
                          "currency",
                          (v || null) as ExtractedRateRow["currency"],
                        )
                      }
                    />
                  </td>
                  <td className="px-3 py-2 text-xs tabular-nums text-slate-500">
                    {Math.round(row.confidence * 100)}%
                  </td>
                  <td className="px-3 py-2">
                    <Cell
                      value={row.validFrom}
                      onChange={(v) => update(idx, "validFrom", v || null)}
                      type="date"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Cell
                      value={row.validTo}
                      onChange={(v) => update(idx, "validTo", v || null)}
                      type="date"
                    />
                  </td>
                  <td className="px-3 py-2 align-top">
                    {row.issues.length > 0 ? (
                      <ul className="space-y-1">
                        {row.issues.map((issue) => (
                          <li
                            key={issue}
                            className="flex items-start gap-1 text-xs text-amber-800"
                          >
                            <WarningIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                            <span>{issue}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <CheckIcon className="h-4 w-4 text-emerald-600" />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Source text (collapsed) */}
      <details className="mt-4">
        <summary className="cursor-pointer text-xs text-slate-400 hover:text-slate-600">
          Show raw source text per row
        </summary>
        <div className="mt-2 space-y-1">
          {rows.map((r, i) => (
            <div key={r.id} className="rounded bg-slate-100 px-3 py-1.5 font-mono text-xs text-slate-600">
              <span className="text-slate-400">#{i + 1}:</span> {r.source}
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}

/* ── Editable Cell ─────────────────────────────────────────────── */

function Cell({
  value,
  flagged,
  onChange,
  type = "text",
}: {
  value: string | number | null;
  flagged?: boolean;
  onChange: (value: string) => void;
  type?: "text" | "number" | "date";
}) {
  return (
    <input
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      type={type}
      placeholder={flagged ? "—" : ""}
      className={cn(
        "w-full rounded border bg-white px-2 py-1 text-sm outline-none transition-colors focus:ring-2 focus:ring-slate-400",
        flagged
          ? "border-amber-400 bg-amber-50"
          : "border-slate-200 hover:border-slate-300",
      )}
    />
  );
}

/* ── Spinner ───────────────────────────────────────────────────── */

function Spinner() {
  return (
    <svg
      className="h-4 w-4 animate-spin"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx={12}
        cy={12}
        r={10}
        stroke="currentColor"
        strokeWidth={4}
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

/* ── Page Skeleton ─────────────────────────────────────────────── */

function PageSkeleton() {
  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="h-6 w-40 animate-pulse rounded bg-slate-200" />
      <div className="h-8 w-64 animate-pulse rounded bg-slate-200" />
      <div className="h-64 animate-pulse rounded-xl bg-slate-100" />
    </div>
  );
}

/* ── Generate Quote Modal ──────────────────────────────────────── */

function GenerateQuoteModal({
  rateSetId,
  pricedCount,
  skippedCount,
  onClose,
  onGenerated,
}: {
  rateSetId: string;
  pricedCount: number;
  skippedCount: number;
  onClose: () => void;
  onGenerated: (quoteId: string) => void;
}) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [margin, setMargin] = useState(15);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getCustomers()
      .then((cs) => {
        setCustomers(cs);
        if (cs[0]) setCustomerId(cs[0].id);
      })
      .catch(() => undefined);
  }, []);

  async function generate() {
    if (!customerId) return;
    setBusy(true);
    try {
      const quote = await createQuoteFromRateSet({
        rateSetId,
        customerId,
        marginPct: margin,
      });
      onGenerated(quote.id);
    } catch {
      alert("Could not generate the quote. Please try again.");
      setBusy(false);
    }
  }

  return (
    <Modal open title="Generate quote from rates" onClose={onClose}>
      <p className="mb-4 text-sm text-slate-600">
        Creates a priced draft quote from{" "}
        <span className="font-semibold">{pricedCount}</span> priced rate
        {pricedCount === 1 ? "" : "s"}
        {skippedCount > 0 && (
          <> ({skippedCount} without a rate will be skipped)</>
        )}
        . You can edit and approve it next.
      </p>

      <label className="mb-3 block">
        <span className="mb-1 block text-xs font-medium text-slate-500">
          Customer
        </span>
        {customers.length === 0 ? (
          <span className="text-sm text-amber-700">
            No customers yet — add one under Customers first.
          </span>
        ) : (
          <select
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-400"
          >
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
      </label>

      <label className="mb-4 block">
        <span className="mb-1 block text-xs font-medium text-slate-500">
          Default margin %
        </span>
        <input
          type="number"
          value={margin}
          min={0}
          step={0.5}
          onChange={(e) => setMargin(Number(e.target.value))}
          className="w-32 rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-400"
        />
        <span className="ml-2 text-xs text-slate-500">
          applied to every line (editable after)
        </span>
      </label>

      <div className="flex justify-end gap-2">
        <button
          onClick={onClose}
          className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
        >
          Cancel
        </button>
        <button
          onClick={generate}
          disabled={busy || !customerId}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {busy ? "Generating…" : "Generate draft quote"}
        </button>
      </div>
    </Modal>
  );
}
