/**
 * Branded HTML templates for customer-facing documents, rendered to PDF by
 * PdfService (Playwright/Chromium HTML→PDF).
 *
 * IMPORTANT: these are CUSTOMER-FACING. They show sell prices only — never
 * cost or margin. Leaking internal margin onto a quote is a trust disaster.
 */

interface Company {
  name: string;
  logo?: string | null; // data URL
}
interface Customer {
  name: string;
  email?: string | null;
  contact?: string | null;
}
interface DocLine {
  description: string;
  unit?: string | null;
  basis?: string | null;
  amount: number; // sell price (quote) or line amount (invoice)
  currency: string;
}
interface DocModel {
  kind: "QUOTATION" | "INVOICE";
  number: string;
  status: string;
  createdAt: string | Date;
  dueDate?: string | Date | null;
  currency: string;
  customer: Customer;
  lines: DocLine[];
  total: number;
}

const esc = (s: unknown): string =>
  String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
      c
    ] as string,
  );

const money = (n: number, ccy: string): string =>
  `${esc(ccy)} ${Number(n).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const fmtDate = (d: string | Date | null | undefined): string =>
  d
    ? new Date(d).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";

const prettyBasis = (b: string | null | undefined): string =>
  b ? esc(b).replace(/_/g, " ") : "";

export function documentHtml(doc: DocModel, company: Company): string {
  const accent = "#0f766e"; // teal, matches the app
  const rows = doc.lines
    .map(
      (l, i) => `
      <tr>
        <td class="num">${i + 1}</td>
        <td>
          <div class="desc">${esc(l.description)}</div>
          ${
            l.basis || l.unit
              ? `<div class="sub">${prettyBasis(l.basis) || esc(l.unit)}</div>`
              : ""
          }
        </td>
        <td class="amt">${money(l.amount, l.currency || doc.currency)}</td>
      </tr>`,
    )
    .join("");

  const dateLabel = doc.kind === "INVOICE" ? "Invoice date" : "Quote date";

  return `<!doctype html>
<html><head><meta charset="utf-8"><style>
  * { box-sizing: border-box; }
  body { font: 13px/1.5 -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
         color: #1e293b; margin: 0; }
  .head { display: flex; justify-content: space-between; align-items: flex-start;
          border-bottom: 3px solid ${accent}; padding-bottom: 16px; }
  .brand { font-size: 22px; font-weight: 700; color: ${accent}; }
  .brand .tag { display:block; font-size: 11px; font-weight: 500; color: #64748b; margin-top: 2px; }
  .doc-meta { text-align: right; }
  .doc-type { font-size: 20px; font-weight: 700; letter-spacing: 1px; }
  .doc-num { color: #475569; margin-top: 2px; }
  .badge { display:inline-block; margin-top:6px; padding: 2px 10px; border-radius: 999px;
           font-size: 11px; font-weight: 600; background: #f1f5f9; color: #475569; }
  .parties { display:flex; justify-content: space-between; margin: 24px 0; }
  .parties h4 { margin: 0 0 4px; font-size: 11px; text-transform: uppercase;
                letter-spacing: .5px; color: #94a3b8; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  thead th { text-align: left; font-size: 11px; text-transform: uppercase;
             letter-spacing: .5px; color: #94a3b8; border-bottom: 1px solid #e2e8f0;
             padding: 8px 10px; }
  th.amt, td.amt { text-align: right; }
  td { padding: 10px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
  td.num { color: #cbd5e1; width: 28px; }
  .desc { font-weight: 500; }
  .sub { color: #94a3b8; font-size: 11px; margin-top: 2px; }
  .amt { white-space: nowrap; font-variant-numeric: tabular-nums; }
  .totals { margin-top: 16px; display:flex; justify-content: flex-end; }
  .totals table { width: 280px; }
  .totals td { border: none; padding: 6px 10px; }
  .totals .grand td { border-top: 2px solid ${accent}; font-size: 16px; font-weight: 700; }
  .foot { margin-top: 40px; padding-top: 12px; border-top: 1px solid #e2e8f0;
          color: #94a3b8; font-size: 11px; }
</style></head>
<body>
  <div class="head">
    <div class="brand">${
      company.logo
        ? `<img src="${esc(company.logo)}" alt="${esc(company.name)}" height="52" style="height:52px;width:auto;max-width:260px;display:block" />`
        : `${esc(company.name)}<span class="tag">Freight forwarding</span>`
    }</div>
    <div class="doc-meta">
      <div class="doc-type">${doc.kind}</div>
      <div class="doc-num">${esc(doc.number)}</div>
      <div class="badge">${esc(doc.status)}</div>
    </div>
  </div>

  <div class="parties">
    <div>
      <h4>Billed to</h4>
      <div><strong>${esc(doc.customer.name)}</strong></div>
      ${doc.customer.contact ? `<div>${esc(doc.customer.contact)}</div>` : ""}
      ${doc.customer.email ? `<div>${esc(doc.customer.email)}</div>` : ""}
    </div>
    <div style="text-align:right">
      <h4>${dateLabel}</h4>
      <div>${fmtDate(doc.createdAt)}</div>
      ${
        doc.kind === "INVOICE"
          ? `<h4 style="margin-top:10px">Due date</h4><div>${fmtDate(doc.dueDate)}</div>`
          : ""
      }
    </div>
  </div>

  <table>
    <thead><tr><th class="num">#</th><th>Description</th><th class="amt">Amount</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>

  <div class="totals">
    <table>
      <tr class="grand"><td>Total</td><td class="amt">${money(doc.total, doc.currency)}</td></tr>
    </table>
  </div>

  <div class="foot">
    ${
      doc.kind === "QUOTATION"
        ? "Rates exclude duties, taxes and statutory charges unless stated. Subject to space and equipment availability at time of booking."
        : "Please reference the invoice number with your payment. Thank you for your business."
    }
  </div>
</body></html>`;
}
