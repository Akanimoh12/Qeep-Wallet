import type { ReactNode } from "react";

export { LogoMark } from "./Brand";

function Svg({ size = 22, children }: { size?: number; children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 22 22"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export const BackIcon = () => (
  <Svg size={20}>
    <path d="M13.5 4.5l-6.5 6.5 6.5 6.5" />
  </Svg>
);
export const SendIcon = () => (
  <Svg>
    <path d="M11 18V4M5 10l6-6 6 6" />
  </Svg>
);
export const ReceiveIcon = () => (
  <Svg>
    <path d="M11 4v14M5 12l6 6 6-6" />
  </Svg>
);
export const PlusIcon = () => (
  <Svg>
    <path d="M11 4v14M4 11h14" />
  </Svg>
);
export const LockIcon = () => (
  <Svg>
    <rect x="4" y="9" width="14" height="10" rx="2.5" />
    <path d="M7.5 9V6.5a3.5 3.5 0 017 0V9" />
  </Svg>
);
export const ShieldIcon = ({ size = 14 }: { size?: number }) => (
  <Svg size={size}>
    <path d="M11 2l7.5 3v5.5c0 4.5-3.2 8-7.5 9.5-4.3-1.5-7.5-5-7.5-9.5V5L11 2z" />
  </Svg>
);
export const ShieldCheckIcon = ({ size = 44 }: { size?: number }) => (
  <Svg size={size}>
    <path d="M11 2l7.5 3v5.5c0 4.5-3.2 8-7.5 9.5-4.3-1.5-7.5-5-7.5-9.5V5L11 2z" />
    <path d="M7.5 11l2.5 2.5 4.5-5" />
  </Svg>
);
export const WarnIcon = () => (
  <Svg>
    <path d="M11 2l7.5 3v5.5c0 4.5-3.2 8-7.5 9.5-4.3-1.5-7.5-5-7.5-9.5V5L11 2z" />
    <path d="M11 7.5v4M11 14.5v.01" />
  </Svg>
);
export const CopyIcon = () => (
  <Svg size={18}>
    <rect x="7" y="7" width="11" height="11" rx="2" />
    <path d="M4 14V5a1 1 0 011-1h9" />
  </Svg>
);
export const SwapIcon = () => (
  <Svg>
    <path d="M4 8h13l-3.5-3.5M18 14H5l3.5 3.5" />
  </Svg>
);
export const QrIcon = () => (
  <Svg>
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="12" y="3" width="7" height="7" rx="1.5" />
    <rect x="3" y="12" width="7" height="7" rx="1.5" />
    <path d="M13 13h2v2h-2zM17 17h2v2h-2z" />
  </Svg>
);
export const HomeIcon = () => (
  <Svg>
    <path d="M3 10l8-6 8 6v8a1 1 0 01-1 1h-4v-5H8v5H4a1 1 0 01-1-1v-8z" />
  </Svg>
);
export const ListIcon = () => (
  <Svg>
    <path d="M7 6h11M7 11h11M7 16h11M3.5 6h.01M3.5 11h.01M3.5 16h.01" />
  </Svg>
);
export const ExternalIcon = () => (
  <Svg size={16}>
    <path d="M13 3h6v6M19 3l-9 9M16 13v5a1 1 0 01-1 1H4a1 1 0 01-1-1V7a1 1 0 011-1h5" />
  </Svg>
);
