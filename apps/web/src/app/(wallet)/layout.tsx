import type { ReactNode } from "react";

/** Wallet screens: a phone-width column, centred on larger screens. */
export default function WalletLayout({ children }: { children: ReactNode }) {
  return <main className="app">{children}</main>;
}
