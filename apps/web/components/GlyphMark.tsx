/**
 * The Caelus mark: an ecliptic ring with a body on it and a central sun.
 * Pure SVG so it doubles as the favicon and OpenGraph seed.
 */
export default function GlyphMark({ size = 22 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      role="img"
      aria-label="Caelus mark"
      style={{ display: "block", flexShrink: 0 }}
    >
      <circle cx="16" cy="16" r="13" stroke="var(--accent)" strokeWidth="1.5" opacity="0.55" />
      <circle cx="16" cy="16" r="9" stroke="var(--text-mute)" strokeWidth="1" opacity="0.4" />
      <circle cx="16" cy="16" r="3.2" fill="var(--warm)" />
      <circle cx="29" cy="16" r="2.4" fill="var(--accent)" />
      <circle cx="10.4" cy="9.2" r="1.5" fill="var(--text)" />
    </svg>
  );
}
