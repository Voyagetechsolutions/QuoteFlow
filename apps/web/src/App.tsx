import { useState } from "react";
import type { Page } from "./lib/hooks";
import { Layout } from "./components/Layout";
import { RateSetsPage } from "./pages/RateSetsPage";
import { RateSetDetailPage } from "./pages/RateSetDetailPage";
import { QuotesPage } from "./pages/QuotesPage";
import { QuoteBuilderPage } from "./pages/QuoteBuilderPage";
import { QuoteDetailPage } from "./pages/QuoteDetailPage";
import { InvoicesPage } from "./pages/InvoicesPage";
import { CustomersPage } from "./pages/CustomersPage";

export function App() {
  const [page, setPage] = useState<Page>({ name: "rate-sets" });

  function navigate(next: Page) {
    setPage(next);
    // Scroll to top on navigation
    window.scrollTo({ top: 0 });
  }

  return (
    <Layout page={page} navigate={navigate}>
      <div className="animate-fade-in" key={pageKey(page)}>
        <PageRenderer page={page} navigate={navigate} />
      </div>
    </Layout>
  );
}

function PageRenderer({
  page,
  navigate,
}: {
  page: Page;
  navigate: (p: Page) => void;
}) {
  switch (page.name) {
    case "rate-sets":
      return <RateSetsPage navigate={navigate} />;
    case "rate-set-detail":
      return <RateSetDetailPage rateSetId={page.id} navigate={navigate} />;
    case "quotes":
      return <QuotesPage navigate={navigate} />;
    case "quote-builder":
      return <QuoteBuilderPage navigate={navigate} editId={page.editId} />;
    case "quote-detail":
      return <QuoteDetailPage quoteId={page.id} navigate={navigate} />;
    case "invoices":
      return <InvoicesPage navigate={navigate} />;
    case "invoice-detail":
      // Handled inline in InvoicesPage
      return <InvoicesPage navigate={navigate} />;
    case "customers":
      return <CustomersPage navigate={navigate} />;
    default:
      return <RateSetsPage navigate={navigate} />;
  }
}

/** Unique key per "page instance" so React re-mounts with the fade-in animation. */
function pageKey(page: Page): string {
  switch (page.name) {
    case "rate-set-detail":
      return `rate-set-detail-${page.id}`;
    case "quote-builder":
      return `quote-builder-${page.editId ?? "new"}`;
    case "quote-detail":
      return `quote-detail-${page.id}`;
    case "invoice-detail":
      return `invoice-detail-${page.id}`;
    default:
      return page.name;
  }
}
