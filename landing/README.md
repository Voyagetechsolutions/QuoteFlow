# QuoteFlow — landing page

A single, self-contained `index.html` (no build step) — the public page you link
from a DM/WhatsApp/email. Reuses the QuoteFlow brand (navy `#1a3c5e`, wordmark +
flow glyph, Inter).

## Edit these 3 things before publishing

Open `index.html` and search for each token:

1. **`CONTACT_EMAIL`** — the `mailto:` (currently `mthokochaza@gmail.com`). Swap
   for a business email if you have one.
2. **`WHATSAPP_NUMBER`** — replace with your number in international format,
   digits only, no `+` or spaces (e.g. `263771234567`). It's used in a
   `https://wa.me/...` link.
3. **`DEMO_VIDEO`** — once your 90-second demo exists, replace the
   `.video-frame` placeholder block with a YouTube/Loom `<iframe>`. The single
   highest-impact upgrade to this page.

## Preview locally

```sh
python -m http.server 4180 --directory landing
# then open http://localhost:4180
```

## Publish (pick one, both free)

- **Netlify Drop** — go to https://app.netlify.com/drop and drag the `landing`
  folder onto the page. Live in ~10 seconds, gives you a URL you can rename.
- **GitHub Pages** — push the repo, enable Pages, point it at `/landing`.

Add your own domain later (e.g. `quoteflow.africa`) from either host's settings.

## What it's for

This page does **not** sell on its own. It's the credible landing spot at the
end of a direct message. The flow is: DM/WhatsApp a forwarder → they click →
they hit the "send us your rate sheet" offer → you reply with a real branded
quote made from their sheet. The page's only job is to make that offer
believable. Keep it pointed at one action.
