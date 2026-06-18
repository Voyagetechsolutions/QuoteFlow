import { useState } from "react";
import type { ExtractedRateRow, ExtractionResult } from "@quoteflow/shared";
import {
  getRateSets,
  deleteRateSet,
  extractRateSheet,
  saveRateSet,
  type RateSet,
} from "../lib/api";
import { useAsync, formatDate, type NavigateFn } from "../lib/hooks";
import { Modal } from "../components/Modal";

interface Props {
  navigate: NavigateFn;
}

export function RateSetsPage({ navigate }: Props) {
  const { data: rateSets, loading, error, reload } = useAsync(getRateSets, []);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [draft, setDraft] = useState<ExtractionResult | null>(null);
  const [uploading, setUploading] = useState(false);

  function pickAndExtract() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".pdf,.xlsx,.xls,.csv";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      setUploading(true);
      try {
        const result = await extractRateSheet(file);
        setDraft(result);
      } catch (e) {
        alert(
          `Extraction failed: ${e instanceof Error ? e.message : "unknown error"}`,
        );
      } finally {
        setUploading(false);
      }
    };
    input.click();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this rate set? This cannot be undone.")) return;
    setDeleting(id);
    try {
      await deleteRateSet(id);
      reload();
    } catch {
      alert("Failed to delete rate set.");
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Rate Sets</h1>
          <p className="mt-1 text-sm text-slate-500">
            Upload carrier rate sheets and review extracted rates.
          </p>
        </div>
        <UploadButton uploading={uploading} onClick={pickAndExtract} />
      </div>

      {draft && (
        <ReviewModal
          draft={draft}
          onClose={() => setDraft(null)}
          onSaved={() => {
            setDraft(null);
            reload();
          }}
        />
      )}

      {/* Content */}
      {loading ? (
        <LoadingSkeleton />
      ) : error ? (
        <ErrorCard message={error} onRetry={reload} />
      ) : !rateSets || rateSets.length === 0 ? (
        <EmptyState onUpload={pickAndExtract} />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Source File</th>
                <th className="px-4 py-3">Rows</th>
                <th className="px-4 py-3">Review</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rateSets.map((rs: RateSet) => (
                <tr
                  key={rs.id}
                  className="cursor-pointer transition-colors hover:bg-slate-50"
                  onClick={() => navigate({ name: "rate-set-detail", id: rs.id })}
                >
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {rs.name}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">
                    {rs.sourceFile}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{rs.rowCount}</td>
                  <td className="px-4 py-3">
                    {rs.needsReviewCount > 0 ? (
                      <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                        {rs.needsReviewCount} flagged
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                        All clear
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {formatDate(rs.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(rs.id);
                      }}
                      disabled={deleting === rs.id}
                      className="rounded-md px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                      {deleting === rs.id ? "Deleting…" : "Delete"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ── Upload Button ─────────────────────────────────────────────── */

function UploadButton({
  uploading,
  onClick,
}: {
  uploading: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={uploading}
      className="flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-slate-800 disabled:opacity-50"
    >
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
      </svg>
      {uploading ? "Extracting…" : "Upload Rate Sheet"}
    </button>
  );
}

/* ── Review Modal (extracted rows, before saving) ──────────────── */

function ReviewModal({
  draft,
  onClose,
  onSaved,
}: {
  draft: ExtractionResult;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(draft.sourceFile.replace(/\.[^.]+$/, ""));
  const [saving, setSaving] = useState(false);
  const flagged = draft.rows.filter((r) => r.needsReview).length;

  async function handleSave() {
    setSaving(true);
    try {
      const validFrom = draft.rows.find((r) => r.validFrom)?.validFrom ?? null;
      const validTo = draft.rows.find((r) => r.validTo)?.validTo ?? null;
      await saveRateSet({
        name: name.trim() || draft.sourceFile,
        sourceFilename: draft.sourceFile,
        extractor: draft.extractor,
        validFrom,
        validTo,
        rows: draft.rows,
      });
      onSaved();
    } catch (e) {
      alert(
        `Could not save (a database is required for this step): ${
          e instanceof Error ? e.message : "unknown error"
        }`,
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open title="Review extracted rates" onClose={onClose} width="max-w-4xl">
      <div className="mb-3 flex items-center justify-between text-sm">
        <div className="flex items-center gap-2 text-slate-600">
          <span className="font-mono text-xs">{draft.sourceFile}</span>
          <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-500">
            {draft.extractor}
          </span>
        </div>
        <div>
          {draft.rowCount} rows ·{" "}
          {flagged > 0 ? (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
              {flagged} need review
            </span>
          ) : (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
              all clear
            </span>
          )}
        </div>
      </div>

      <label className="mb-3 block">
        <span className="mb-1 block text-xs font-medium text-slate-500">
          Rate set name
        </span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-400"
        />
      </label>

      <div className="max-h-80 overflow-auto rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2">Code</th>
              <th className="px-3 py-2">Origin</th>
              <th className="px-3 py-2">Destination</th>
              <th className="px-3 py-2">Basis</th>
              <th className="px-3 py-2 text-right">Rate</th>
              <th className="px-3 py-2">Ccy</th>
              <th className="px-3 py-2 text-right">Conf</th>
              <th className="px-3 py-2">Review</th>
            </tr>
          </thead>
          <tbody>
            {[...draft.rows]
              .sort((a, b) => Number(b.needsReview) - Number(a.needsReview))
              .map((row: ExtractedRateRow, i) => (
                <tr
                  key={i}
                  className={
                    row.needsReview
                      ? "border-t border-amber-200 bg-amber-50"
                      : "border-t border-slate-100"
                  }
                >
                  <td className="px-3 py-2 font-medium">
                    {row.chargeCode ?? row.chargeType ?? "—"}
                  </td>
                  <td className="px-3 py-2">{row.laneOrigin ?? "—"}</td>
                  <td className="px-3 py-2">{row.laneDestination ?? "—"}</td>
                  <td
                    className={
                      "px-3 py-2 " +
                      (row.basis === null ? "bg-amber-100 font-medium text-amber-900" : "")
                    }
                  >
                    {row.basis ?? "—"}
                  </td>
                  <td
                    className={
                      "px-3 py-2 text-right tabular-nums " +
                      (row.rate === null ? "bg-amber-100 font-medium text-amber-900" : "")
                    }
                  >
                    {row.rate ?? "—"}
                  </td>
                  <td
                    className={
                      "px-3 py-2 " +
                      (row.currency === null ? "bg-amber-100 font-medium text-amber-900" : "")
                    }
                  >
                    {row.currency ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-xs text-slate-500">
                    {Math.round(row.confidence * 100)}%
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {row.issues.length > 0 ? (
                      <span className="text-amber-800">
                        ⚠ {row.issues.join("; ")}
                      </span>
                    ) : (
                      <span className="text-emerald-700">✓</span>
                    )}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <button
          onClick={onClose}
          className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save rate set"}
        </button>
      </div>
    </Modal>
  );
}

/* ── Empty State ───────────────────────────────────────────────── */

function EmptyState({ onUpload }: { onUpload: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-white px-6 py-16 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
        <svg className="h-7 w-7 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-slate-900">No rate sets yet</h3>
      <p className="mt-2 max-w-sm text-sm text-slate-500">
        Upload a carrier rate sheet (PDF or Excel) to get started. We&apos;ll extract the rates and let you review them.
      </p>
      <button
        onClick={onUpload}
        className="mt-6 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-slate-800"
      >
        Upload Your First Rate Sheet
      </button>
    </div>
  );
}

/* ── Loading Skeleton ──────────────────────────────────────────── */

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="h-16 animate-pulse rounded-xl border border-slate-200 bg-white"
        />
      ))}
    </div>
  );
}

/* ── Error Card ────────────────────────────────────────────────── */

function ErrorCard({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
      <p className="text-sm text-red-700">{message}</p>
      <button
        onClick={onRetry}
        className="mt-3 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
      >
        Retry
      </button>
    </div>
  );
}
