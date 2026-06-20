# QuoteFlow brand assets

The official QuoteFlow logo, ready to use. SVGs are the source of truth (scale
to any size); PNGs are 4× transparent exports for email, social, docs, etc.

| File | Use |
|---|---|
| `quoteflow-logo.svg` / `.png` | **Primary** — navy wordmark, for light backgrounds |
| `quoteflow-logo-reversed.svg` / `.png` | **Reversed** — white wordmark (transparent), for dark backgrounds |
| `quoteflow-mark.svg` / `.png` | **Icon mark** — the flow glyph in a navy square, for avatars / app icons / favicons |

## Colours

| | Hex |
|---|---|
| Brand navy (wordmark, "Flow", mark) | `#1a3c5e` |
| Reversed "Quote" tint | `#cdd9e6` |
| Reversed "Flow" / glyph | `#ffffff` |

## Type

The wordmark is **Inter** — "Quote" in Regular (400), "Flow" in Bold (700).
The PNGs already bake the font in, so they render identically everywhere.

## Usage

- Keep clear space around the logo of at least the height of the flow glyph.
- Don't recolour, stretch, rotate, or add effects.
- Use the **reversed** version on navy/dark photos; the **primary** on white/light.
- Use the **mark** alone only where the full wordmark won't fit (favicon, avatar).

## Regenerating the PNGs

The PNGs are rendered from the SVGs (with Inter loaded) by:

```sh
node scripts/render-logos.cjs
```
