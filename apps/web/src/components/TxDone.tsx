import Link from "next/link";
import { explorerTx } from "@/lib/config";
import { ExternalIcon, ShieldCheckIcon } from "./Icons";

export function TxDone({ title, detail, hash }: { title: string; detail: string; hash: string }) {
  return (
    <div className="stack-lg" style={{ alignItems: "center", textAlign: "center", paddingTop: 40 }}>
      <div
        style={{
          width: 88,
          height: 88,
          borderRadius: 28,
          background: "var(--mint-soft)",
          color: "var(--mint)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ShieldCheckIcon />
      </div>
      <h1 className="h1">{title}</h1>
      <p className="lead">{detail}</p>
      <a href={explorerTx(hash)} target="_blank" rel="noreferrer" className="row small" style={{ gap: 6 }}>
        View on Mezo Explorer <ExternalIcon />
      </a>
      <Link href="/home" className="btn btn-primary" style={{ marginTop: 24 }}>
        Back to home
      </Link>
    </div>
  );
}
