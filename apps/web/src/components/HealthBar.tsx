import { formatRatio, loanHealth } from "@/lib/format";

/** Collateral ratio meter. Liquidation at 110% sits at the left edge. */
export function HealthBar({ ratio }: { ratio: bigint }) {
  const h = loanHealth(ratio);
  return (
    <div className="stack" style={{ gap: 8 }}>
      <div className="row between small">
        <span className="muted">Collateral ratio</span>
        <span style={{ color: h.color, fontWeight: 600 }}>
          {formatRatio(ratio)} · {h.label}
        </span>
      </div>
      <div className="health" aria-hidden="true">
        <span style={{ width: `${Math.max(h.fill * 100, 3)}%`, background: h.color }} />
      </div>
      <div className="row between tiny muted">
        <span>110% liquidation</span>
        <span>150%+ recommended</span>
      </div>
    </div>
  );
}
