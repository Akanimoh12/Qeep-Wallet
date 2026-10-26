import type { ReactNode } from "react";

/** Re-mounts on every navigation, so each screen eases in like an iOS view. */
export default function Template({ children }: { children: ReactNode }) {
  return <div className="page">{children}</div>;
}
