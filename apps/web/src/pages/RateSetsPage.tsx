import { useState } from "react";
import { getRateSets, deleteRateSet, type RateSet } from "../lib/api";
import { useAsync, formatDate, type NavigateFn } from "../lib/hooks";

interface Props {
  navigate: NavigateFn;
}

export function RateSetsPage({ navigate }: Props) {
  const { data: rateSets, loading, error, reload } = useAsync(getRateSets, []);
  const [deleting, setDeleting] = useState<string | null>(null);

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
        <UploadButton onUpload={reload} />
      </div>

      {/* Content */}
      {loading ? (
        <LoadingSkeleton />
      ) : error ? (
        <ErrorCard message={error} onRetry={reload} />
      ) : !rateSets || rateSets.length === 0 ? (
        <EmptyState onUpload={reload} />
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

function UploadButton({ onUpload }: { onUpload: () => void }) {
  const [uploading, setUploading] = useState(false);

  function handleClick() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".pdf,.xlsx,.xls,.csv";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      setUploading(true);
      try {
        const { uploadRateSet } = await import("../lib/api");
        await uploadRateSet(file);
        onUpload();
      } catch {
        alert(
          "Upload is not yet connected to the backend. This feature will work once the extraction API is built.",
        );
      } finally {
        setUploading(false);
      }
    };
    input.click();
  }

  return (
    <button
      onClick={handleClick}
      disabled={uploading}
      className="flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-slate-800 disabled:opacity-50"
    >
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
      </svg>
      {uploading ? "Uploading…" : "Upload Rate Sheet"}
    </button>
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
