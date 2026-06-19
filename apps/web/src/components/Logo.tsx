/**
 * QuoteFlow wordmark. "Quote" in regular weight + "Flow" in bold, brand navy,
 * with an angled flow/speed glyph. Two colourways:
 *   - "navy"  : navy ink on light backgrounds (login, light surfaces)
 *   - "light" : light/white ink on the dark navy sidebar
 */
const NAVY = "#1a3c5e";

export function Logo({
  variant = "navy",
  size = "md",
  withGlyph = true,
  className = "",
}: {
  variant?: "navy" | "light";
  size?: "sm" | "md" | "lg";
  withGlyph?: boolean;
  className?: string;
}) {
  const quoteColor = variant === "light" ? "#cdd9e6" : NAVY;
  const flowColor = variant === "light" ? "#ffffff" : NAVY;
  const fontSize = size === "lg" ? 28 : size === "sm" ? 18 : 22;
  const glyph = Math.round(fontSize * 0.8);

  return (
    <span
      className={"inline-flex items-center " + className}
      style={{ gap: fontSize * 0.32 }}
      aria-label="QuoteFlow"
    >
      <span
        style={{
          fontSize,
          lineHeight: 1,
          letterSpacing: "-0.03em",
          fontFamily: '"Inter", system-ui, sans-serif',
        }}
      >
        <span style={{ color: quoteColor, fontWeight: 400 }}>Quote</span>
        <span style={{ color: flowColor, fontWeight: 700 }}>Flow</span>
      </span>
      {withGlyph && <FlowGlyph color={flowColor} size={glyph} />}
    </span>
  );
}

/** Two slanted motion bars suggesting forward flow / speed. */
export function FlowGlyph({
  color = NAVY,
  size = 18,
}: {
  color?: string;
  size?: number;
}) {
  return (
    <svg
      width={size * 1.5}
      height={size}
      viewBox="0 0 30 20"
      fill={color}
      aria-hidden="true"
      style={{ display: "block" }}
    >
      <rect x="3" y="3" width="22" height="3.4" rx="1.7" transform="skewX(-20)" />
      <rect x="8" y="13" width="17" height="3.4" rx="1.7" transform="skewX(-20)" />
    </svg>
  );
}
