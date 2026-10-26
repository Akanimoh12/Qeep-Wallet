import { explorerTx } from "@/lib/config";
import { shortAddress } from "@/lib/format";
import type { HistoryItem } from "@/lib/storage";

const LABELS: Record<HistoryItem["kind"], { icon: string; title: string }> = {
  sent: { icon: "↑", title: "Sent" },
  "vault-sent": { icon: "↑", title: "Sent with Vault Key" },
  limit: { icon: "⚙", title: "Daily limit changed" },
  restore: { icon: "↺", title: "Wallet restored" },
  created: { icon: "✓", title: "Wallet created" },
};

export function HistoryRow({ item }: { item: HistoryItem }) {
  const label = LABELS[item.kind];
  const when = new Date(item.at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  return (
    <a href={explorerTx(item.hash)} target="_blank" rel="noreferrer" className="list-item">
      <span className="list-icon" aria-hidden="true">
        {label.icon}
      </span>
      <span className="stack" style={{ gap: 2, flex: 1 }}>
        <span style={{ fontSize: 14, fontWeight: 500 }}>{label.title}</span>
        <span className="muted tiny">
          {item.to ? `To ${shortAddress(item.to)} · ` : ""}
          {when}
        </span>
      </span>
      {item.amount && <span style={{ fontSize: 14, fontWeight: 600 }}>−{item.amount}</span>}
    </a>
  );
}
