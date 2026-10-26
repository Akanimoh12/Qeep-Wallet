/**
 * Qeep brand mark ("Keyhole"): a Q whose bowl holds a keyhole. One SVG body in a 120×120 box
 * using currentColor, so it works in any single color. The same artwork lives in brand/ as SVG
 * and PNG, and in public/ as the app icons. Change all three together.
 */
export const MARK = `<circle cx="58" cy="58" r="38" fill="none" stroke="currentColor" stroke-width="14"/><path d="M58 38a9 9 0 0 1 5 16.5l3 14.5h-16l3-14.5A9 9 0 0 1 58 38z" fill="currentColor"/><path d="M76 82l24 18" stroke="currentColor" stroke-width="14" stroke-linecap="round"/>`;

export function LogoMark({
  size = 28,
  color = "var(--mint)",
  className,
}: {
  size?: number;
  color?: string;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      aria-hidden="true"
      className={className}
      style={{ color, flexShrink: 0 }}
      dangerouslySetInnerHTML={{ __html: MARK }}
    />
  );
}

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <span className="brand" style={{ fontSize: size * 0.78, gap: size * 0.28 }}>
      <LogoMark size={size} />
      Qeep
    </span>
  );
}
