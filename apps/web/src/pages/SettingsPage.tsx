import { useState } from "react";
import {
  getCompany,
  updateCompanyName,
  uploadCompanyLogo,
  deleteCompanyLogo,
  type Company,
} from "../lib/api";
import { useAsync, type NavigateFn } from "../lib/hooks";

interface Props {
  navigate: NavigateFn;
}

export function SettingsPage(_props: Props) {
  const { data: company, loading, error, reload } = useAsync(getCompany, []);

  if (loading) return <PageSkeleton />;
  if (error)
    return (
      <div className="mx-auto max-w-2xl rounded-xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-700">
        {error}
      </div>
    );
  if (!company) return null;

  return <SettingsForm company={company} onChanged={reload} />;
}

function SettingsForm({
  company,
  onChanged,
}: {
  company: Company;
  onChanged: () => void;
}) {
  const [name, setName] = useState(company.name);
  const [savingName, setSavingName] = useState(false);
  const [busyLogo, setBusyLogo] = useState(false);

  async function saveName() {
    setSavingName(true);
    try {
      await updateCompanyName(name.trim() || company.name);
      onChanged();
    } catch {
      alert("Could not save the company name.");
    } finally {
      setSavingName(false);
    }
  }

  function pickLogo() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/png,image/jpeg,image/svg+xml,image/webp";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      if (file.size > 1024 * 1024) {
        alert("Logo must be under 1 MB.");
        return;
      }
      setBusyLogo(true);
      try {
        await uploadCompanyLogo(file);
        onChanged();
      } catch {
        alert("Could not upload the logo (must be an image under 1 MB).");
      } finally {
        setBusyLogo(false);
      }
    };
    input.click();
  }

  async function removeLogo() {
    setBusyLogo(true);
    try {
      await deleteCompanyLogo();
      onChanged();
    } catch {
      alert("Could not remove the logo.");
    } finally {
      setBusyLogo(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-semibold text-slate-900">Company settings</h1>
      <p className="mt-1 text-sm text-slate-500">
        Your name and logo appear on the quotes and invoices you send.
      </p>

      {/* Company name */}
      <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Company name</h2>
        <div className="mt-3 flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-400"
          />
          <button
            onClick={saveName}
            disabled={savingName || name.trim() === company.name}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-40"
          >
            {savingName ? "Saving…" : "Save"}
          </button>
        </div>
      </section>

      {/* Logo */}
      <section className="mt-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Logo</h2>
        <p className="mt-1 text-xs text-slate-500">
          Shown on your quote and invoice PDFs. PNG, JPG, SVG or WebP, under 1 MB.
        </p>

        <div className="mt-4 flex items-center gap-5">
          <div className="flex h-20 w-48 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 p-2">
            {company.logo ? (
              <img
                src={company.logo}
                alt="Company logo"
                className="max-h-16 max-w-full object-contain"
              />
            ) : (
              <span className="text-xs text-slate-400">No logo yet</span>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <button
              onClick={pickLogo}
              disabled={busyLogo}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-40"
            >
              {busyLogo ? "Working…" : company.logo ? "Replace logo" : "Upload logo"}
            </button>
            {company.logo && (
              <button
                onClick={removeLogo}
                disabled={busyLogo}
                className="rounded-lg px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-40"
              >
                Remove
              </button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function PageSkeleton() {
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="h-8 w-56 animate-pulse rounded bg-slate-200" />
      <div className="h-32 animate-pulse rounded-xl bg-slate-100" />
      <div className="h-40 animate-pulse rounded-xl bg-slate-100" />
    </div>
  );
}
