import { useState, useMemo, useCallback } from "react";
import { applyMargin, marginPctOf, CURRENCIES } from "@quoteflow/shared";
import {
  getCustomers,
  createCustomer,
  getRateSets,
  getRateSet,
  createQuote,
  createInvoiceFromQuote,
  type Customer,
  type QuoteLine,
  type RateSet,
} from "../lib/api";
import { useAsync, formatCurrency, cn, type NavigateFn } from "../lib/hooks";

interface Props {
  navigate: NavigateFn;
  editId?: string;
}

interface BuilderLine {
  key: string;
  description: string;
  costRate: number;
  marginPct: number;
  sellRate: number;
  currency: string;
}

let lineCounter = 0;
function newLine(defaults?: Partial<BuilderLine>): BuilderLine {
  const cost = defaults?.costRate ?? 0;
  const margin = defaults?.marginPct ?? 15;
  return {
    key: `line-${++lineCounter}`,
    description: defaults?.description ?? "",
    costRate: cost,
    marginPct: margin,
    sellRate: applyMargin(cost, margin),
    currency: defaults?.currency ?? "USD",
  };
}

export function QuoteBuilderPage({ navigate }: Props) {
  // ── Customer state ──
  const { data: customers, reload: reloadCustomers } = useAsync(getCustomers, []);
  const [customerId, setCustomerId] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [newCustName, setNewCustName] = useState("");
  const [newCustEmail, setNewCustEmail] = useState("");
  const [newCustContact, setNewCustContact] = useState("");

  // ── Rate set picker ──
  const { data: rateSets } = useAsync(getRateSets, []);
  const [selectedRateSet, setSelectedRateSet] = useState("");
  const [loadingRateSet, setLoadingRateSet] = useState(false);

  // ── Lines ──
  const [lines, setLines] = useState<BuilderLine[]>([newLine()]);
  const [defaultMargin, setDefaultMargin] = useState(15);

  // ── Saving ──
  const [saving, setSaving] = useState(false);
  const [converting, setConverting] = useState(false);

  // ── Computed totals ──
  const totals = useMemo(() => {
    const totalCost = lines.reduce((s, l) => s + l.costRate, 0);
    const totalSell = lines.reduce((s, l) => s + l.sellRate, 0);
    const overallMargin = totalCost > 0 ? marginPctOf(totalCost, totalSell) : 0;
    return { totalCost, totalSell, overallMargin };
  }, [lines]);

  // ── Filtered customers ──
  const filteredCustomers = useMemo(() => {
    if (!customers) return [];
    if (!customerSearch) return customers;
    const lower = customerSearch.toLowerCase();
    return customers.filter(
      (c: Customer) =>
        c.name.toLowerCase().includes(lower) ||
        c.email.toLowerCase().includes(lower),
    );
  }, [customers, customerSearch]);

  const selectedCustomer = customers?.find((c: Customer) => c.id === customerId);

  // ── Line operations ──
  const updateLine = useCallback(
    (key: string, field: keyof BuilderLine, value: string | number) => {
      setLines((prev) =>
        prev.map((l) => {
          if (l.key !== key) return l;
          const updated = { ...l, [field]: value };
          if (field === "costRate") {
            updated.costRate = Number(value) || 0;
            updated.sellRate = applyMargin(updated.costRate, updated.marginPct);
          } else if (field === "marginPct") {
            updated.marginPct = Number(value) || 0;
            updated.sellRate = applyMargin(updated.costRate, updated.marginPct);
          } else if (field === "sellRate") {
            updated.sellRate = Number(value) || 0;
            updated.marginPct = marginPctOf(updated.costRate, updated.sellRate);
          }
          return updated;
        }),
      );
    },
    [],
  );

  function addLine() {
    setLines((prev) => [...prev, newLine({ marginPct: defaultMargin })]);
  }

  function removeLine(key: string) {
    setLines((prev) => prev.filter((l) => l.key !== key));
  }

  function applyDefaultMargin() {
    setLines((prev) =>
      prev.map((l) => ({
        ...l,
        marginPct: defaultMargin,
        sellRate: applyMargin(l.costRate, defaultMargin),
      })),
    );
  }

  // ── Import from rate set ──
  async function importFromRateSet(rsId: string) {
    if (!rsId) return;
    setLoadingRateSet(true);
    try {
      const detail = await getRateSet(rsId);
      const imported: BuilderLine[] = detail.rows
        .filter((r) => r.rate !== null)
        .map((r) => {
          const desc = [r.chargeType, r.laneOrigin, "→", r.laneDestination, r.unit]
            .filter(Boolean)
            .join(" ");
          return newLine({
            description: desc,
            costRate: r.rate!,
            marginPct: defaultMargin,
            currency: r.currency ?? "USD",
          });
        });
      setLines((prev) => [...prev.filter((l) => l.description), ...imported]);
    } catch {
      alert("Failed to load rate set.");
    } finally {
      setLoadingRateSet(false);
    }
  }

  // ── Create customer inline ──
  async function handleCreateCustomer() {
    if (!newCustName.trim()) return;
    try {
      const created = await createCustomer({
        name: newCustName.trim(),
        email: newCustEmail.trim(),
        contact: newCustContact.trim(),
      });
      setCustomerId(created.id);
      setShowNewCustomer(false);
      setNewCustName("");
      setNewCustEmail("");
      setNewCustContact("");
      reloadCustomers();
    } catch {
      alert("Failed to create customer.");
    }
  }

  // ── Save quote ──
  async function handleSave() {
    if (!customerId) {
      alert("Please select or create a customer.");
      return;
    }
    if (lines.length === 0) {
      alert("Add at least one line.");
      return;
    }
    setSaving(true);
    try {
      const quoteLines: QuoteLine[] = lines.map((l) => ({
        description: l.description,
        costRate: l.costRate,
        marginPct: l.marginPct,
        sellRate: l.sellRate,
        currency: l.currency,
      }));
      await createQuote({
        customerId,
        customerName: selectedCustomer?.name ?? "",
        status: "DRAFT",
        lines: quoteLines,
        totalCost: totals.totalCost,
        totalSell: totals.totalSell,
        overallMarginPct: totals.overallMargin,
      });
      navigate({ name: "quotes" });
    } catch {
      alert("Failed to save quote.");
    } finally {
      setSaving(false);
    }
  }

  // ── Convert to invoice ──
  async function handleConvertToInvoice() {
    if (!customerId) {
      alert("Save the quote first.");
      return;
    }
    setSaving(true);
    setConverting(true);
    try {
      const quoteLines: QuoteLine[] = lines.map((l) => ({
        description: l.description,
        costRate: l.costRate,
        marginPct: l.marginPct,
        sellRate: l.sellRate,
        currency: l.currency,
      }));
      const quote = await createQuote({
        customerId,
        customerName: selectedCustomer?.name ?? "",
        status: "ACCEPTED",
        lines: quoteLines,
        totalCost: totals.totalCost,
        totalSell: totals.totalSell,
        overallMarginPct: totals.overallMargin,
      });
      await createInvoiceFromQuote(quote.id);
      navigate({ name: "invoices" });
    } catch {
      alert("Failed to convert to invoice.");
    } finally {
      setSaving(false);
      setConverting(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      {/* Back */}
      <button
        onClick={() => navigate({ name: "quotes" })}
        className="mb-4 flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
        </svg>
        Back to Quotes
      </button>

      <h1 className="mb-6 text-2xl font-semibold text-slate-900">New Quote</h1>

      <div className="space-y-6">
        {/* ── Customer Section ── */}
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500">
            Customer
          </h2>
          {!showNewCustomer ? (
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <input
                  type="text"
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  placeholder="Search customers…"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                />
                {customerSearch && filteredCustomers.length > 0 && !customerId && (
                  <div className="mt-1 max-h-40 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                    {filteredCustomers.map((c: Customer) => (
                      <button
                        key={c.id}
                        onClick={() => {
                          setCustomerId(c.id);
                          setCustomerSearch(c.name);
                        }}
                        className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
                      >
                        <span className="font-medium">{c.name}</span>
                        {c.email && (
                          <span className="ml-2 text-slate-400">{c.email}</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {selectedCustomer && (
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                  {selectedCustomer.name}
                </span>
              )}
              <button
                onClick={() => setShowNewCustomer(true)}
                className="shrink-0 text-sm font-medium text-slate-600 hover:text-slate-900"
              >
                + New Customer
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <input
                  value={newCustName}
                  onChange={(e) => setNewCustName(e.target.value)}
                  placeholder="Company name *"
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
                />
                <input
                  value={newCustEmail}
                  onChange={(e) => setNewCustEmail(e.target.value)}
                  placeholder="Email"
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
                />
                <input
                  value={newCustContact}
                  onChange={(e) => setNewCustContact(e.target.value)}
                  placeholder="Contact name"
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleCreateCustomer}
                  className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
                >
                  Create Customer
                </button>
                <button
                  onClick={() => setShowNewCustomer(false)}
                  className="rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </section>

        {/* ── Import from Rate Set ── */}
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500">
            Import from Rate Set
          </h2>
          <div className="flex items-center gap-3">
            <select
              value={selectedRateSet}
              onChange={(e) => setSelectedRateSet(e.target.value)}
              className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
            >
              <option value="">Select a rate set…</option>
              {rateSets?.map((rs: RateSet) => (
                <option key={rs.id} value={rs.id}>
                  {rs.name} ({rs.rowCount} rows)
                </option>
              ))}
            </select>
            <button
              onClick={() => importFromRateSet(selectedRateSet)}
              disabled={!selectedRateSet || loadingRateSet}
              className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 disabled:opacity-50"
            >
              {loadingRateSet ? "Importing…" : "Import Lanes"}
            </button>
          </div>
        </section>

        {/* ── Default Margin ── */}
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
                Default Margin
              </h2>
              <p className="mt-0.5 text-xs text-slate-400">
                Applied to new lines or all lines when you click &quot;Apply to All&quot;.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={defaultMargin}
                  onChange={(e) => setDefaultMargin(Number(e.target.value) || 0)}
                  className="w-20 rounded-lg border border-slate-200 px-3 py-2 text-right text-sm outline-none focus:border-slate-400"
                />
                <span className="text-sm text-slate-500">%</span>
              </div>
              <button
                onClick={applyDefaultMargin}
                className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200"
              >
                Apply to All
              </button>
            </div>
          </div>
        </section>

        {/* ── Quote Lines ── */}
        <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
              Quote Lines
            </h2>
            <button
              onClick={addLine}
              className="flex items-center gap-1 rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-200"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Add Line
            </button>
          </div>

          {lines.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-slate-400">
              No lines yet. Add a line or import from a rate set.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                    <th className="px-4 py-2.5 w-[35%]">Description</th>
                    <th className="px-4 py-2.5 w-[10%]">Currency</th>
                    <th className="px-4 py-2.5 w-[15%] text-right">Cost Rate</th>
                    <th className="px-4 py-2.5 w-[12%] text-right">Margin %</th>
                    <th className="px-4 py-2.5 w-[15%] text-right">Sell Rate</th>
                    <th className="px-4 py-2.5 w-[5%]"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {lines.map((line) => (
                    <tr key={line.key} className="hover:bg-slate-50/50">
                      <td className="px-4 py-2">
                        <input
                          value={line.description}
                          onChange={(e) =>
                            updateLine(line.key, "description", e.target.value)
                          }
                          placeholder="Description"
                          className="w-full rounded border border-slate-200 px-2.5 py-1.5 text-sm outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-200"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <select
                          value={line.currency}
                          onChange={(e) =>
                            updateLine(line.key, "currency", e.target.value)
                          }
                          className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-slate-400"
                        >
                          {CURRENCIES.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="number"
                          value={line.costRate || ""}
                          onChange={(e) =>
                            updateLine(line.key, "costRate", e.target.value)
                          }
                          placeholder="0.00"
                          className="w-full rounded border border-slate-200 px-2.5 py-1.5 text-right text-sm outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-200"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            value={line.marginPct || ""}
                            onChange={(e) =>
                              updateLine(line.key, "marginPct", e.target.value)
                            }
                            placeholder="15"
                            className="w-full rounded border border-slate-200 px-2.5 py-1.5 text-right text-sm outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-200"
                          />
                          <span className="shrink-0 text-xs text-slate-400">%</span>
                        </div>
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="number"
                          value={line.sellRate || ""}
                          onChange={(e) =>
                            updateLine(line.key, "sellRate", e.target.value)
                          }
                          placeholder="0.00"
                          className="w-full rounded border border-emerald-200 bg-emerald-50/30 px-2.5 py-1.5 text-right text-sm font-medium outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200"
                        />
                      </td>
                      <td className="px-4 py-2 text-center">
                        <button
                          onClick={() => removeLine(line.key)}
                          className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                          title="Remove line"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ── Totals ── */}
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid grid-cols-3 gap-6 text-center">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
                Total Cost
              </p>
              <p className="mt-1 text-xl font-semibold text-slate-700">
                {formatCurrency(totals.totalCost)}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
                Total Sell
              </p>
              <p className="mt-1 text-xl font-semibold text-emerald-700">
                {formatCurrency(totals.totalSell)}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
                Overall Margin
              </p>
              <p
                className={cn(
                  "mt-1 text-xl font-semibold",
                  totals.overallMargin > 0
                    ? "text-emerald-700"
                    : totals.overallMargin < 0
                      ? "text-red-600"
                      : "text-slate-500",
                )}
              >
                {totals.overallMargin.toFixed(2)}%
              </p>
            </div>
          </div>
        </section>

        {/* ── Actions ── */}
        <div className="flex items-center justify-between pb-8">
          <button
            onClick={() => navigate({ name: "quotes" })}
            className="rounded-lg px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            Cancel
          </button>
          <div className="flex gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-slate-800 disabled:opacity-50"
            >
              {saving && !converting ? "Saving…" : "Save as Draft"}
            </button>
            <button
              onClick={handleConvertToInvoice}
              disabled={saving}
              className="flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:opacity-50"
            >
              {converting ? "Converting…" : "Save & Create Invoice"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
