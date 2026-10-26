"use client";

import { useEffect, useState } from "react";
import { HistoryRow } from "@/components/HistoryRow";
import { ExternalIcon } from "@/components/Icons";
import { RequireWallet } from "@/components/RequireWallet";
import { TabBar } from "@/components/TabBar";
import { explorerAddress } from "@/lib/config";
import { loadHistory, type HistoryItem } from "@/lib/storage";
import { useWallet } from "@/lib/wallet";

function ActivityScreen() {
  const { wallet } = useWallet();
  const [items, setItems] = useState<HistoryItem[]>([]);
  useEffect(() => setItems(loadHistory()), []);

  return (
    <>
      <div className="screen with-tabs">
        <h1 className="h1" style={{ paddingTop: 8 }}>
          Activity
        </h1>
        <p className="lead small">
          Actions made from this device. Incoming payments and full history are on the Mezo Explorer.
        </p>
        {wallet && (
          <a
            href={explorerAddress(wallet.account)}
            target="_blank"
            rel="noreferrer"
            className="btn btn-secondary btn-small"
          >
            Full history on Mezo Explorer <ExternalIcon />
          </a>
        )}
        <div className="stack" style={{ gap: 0 }}>
          {items.length === 0 ? (
            <p className="muted small">Nothing yet.</p>
          ) : (
            items.map((h) => <HistoryRow key={h.hash} item={h} />)
          )}
        </div>
      </div>
      <TabBar />
    </>
  );
}

export default function ActivityPage() {
  return (
    <RequireWallet>
      <ActivityScreen />
    </RequireWallet>
  );
}
