import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { chromium, type Browser } from "playwright";

/**
 * Renders HTML to PDF via Playwright/Chromium. One lazily-launched browser is
 * reused across requests; pages are created and closed per render.
 */
@Injectable()
export class PdfService implements OnModuleDestroy {
  private readonly logger = new Logger(PdfService.name);
  private browser?: Browser;
  private launching?: Promise<Browser>;

  private async getBrowser(): Promise<Browser> {
    if (this.browser?.isConnected()) return this.browser;
    if (!this.launching) {
      this.launching = chromium
        .launch({ args: ["--no-sandbox"] })
        .then((b) => {
          this.browser = b;
          this.launching = undefined;
          return b;
        });
    }
    return this.launching;
  }

  async render(html: string): Promise<Buffer> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();
    try {
      await page.setContent(html, { waitUntil: "networkidle" });
      // Wait for any images (e.g. a data-URL company logo) to finish decoding —
      // networkidle doesn't cover data: URLs, so the logo could miss the render.
      await page.evaluate(() =>
        Promise.all(
          Array.from(document.images).map((img) =>
            img.complete
              ? Promise.resolve()
              : new Promise<void>((resolve) => {
                  img.onload = () => resolve();
                  img.onerror = () => resolve();
                }),
          ),
        ),
      );
      return await page.pdf({
        format: "A4",
        printBackground: true,
        margin: { top: "16mm", bottom: "16mm", left: "14mm", right: "14mm" },
      });
    } finally {
      await page.close();
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.browser?.close().catch((e) => this.logger.warn(String(e)));
  }
}
