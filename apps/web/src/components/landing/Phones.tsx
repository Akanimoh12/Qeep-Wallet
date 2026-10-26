import type { ReactNode } from "react";
import s from "@/app/landing.module.css";
import { LogoMark } from "../Brand";
import { LockIcon, PlusIcon, ReceiveIcon, SendIcon, ShieldCheckIcon } from "../Icons";

/** An iPhone-style frame with a dynamic island. Purely decorative. */
export function Phone({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className={s.phone} role="img" aria-label={label}>
      <div className={s.screen}>
        <span className={s.island} aria-hidden="true" />
        {children}
      </div>
    </div>
  );
}

/** The Qeep home screen, drawn at phone scale for the landing page. Sample balances. */
export function HomePreview() {
  return (
    <Phone label="Qeep home screen showing a MUSD balance, spending pocket and vault pocket">
      <div className={s.mRow}>
        <span className={s.mBrand}>
          <LogoMark size={20} />
          Qeep
        </span>
        <span className={s.mBadge}>Mezo testnet</span>
      </div>
      <div className={s.mCard}>
        <span className={s.mMuted}>Total balance</span>
        <span className={s.mBalance}>
          1,250.00<small>MUSD</small>
        </span>
        <span className={s.mMuted}>≈ $1,250.00 · backed by Bitcoin</span>
        <span className={s.mShield}>Vault quantum-protected</span>
      </div>
      <div className={s.mActions}>
        <span className={s.mAction}>
          <SendIcon />
          Send
        </span>
        <span className={s.mAction}>
          <ReceiveIcon />
          Receive
        </span>
        <span className={s.mAction}>
          <PlusIcon />
          Get MUSD
        </span>
        <span className={s.mAction}>
          <LockIcon />
          Vault
        </span>
      </div>
      <div className={s.mPockets}>
        <div className={s.mPocket}>
          <span className={s.mMuted}>Spendable today</span>
          <span className={s.mPocketAmount}>250.00</span>
          <span className={s.mMuted}>Daily key</span>
        </div>
        <div className={s.mPocketVault}>
          <span className={s.mMuted} style={{ color: "var(--mint)" }}>
            Vault
          </span>
          <span className={s.mPocketAmount}>1,000.00</span>
          <span className={s.mMuted}>Needs Vault Key</span>
        </div>
      </div>
      <div className={s.mList}>
        <div className={s.mItem}>
          <span className={s.mItemIcon}>↓</span>
          <span className={s.mGrow}>
            Received
            <span className={s.mMuted}>Today</span>
          </span>
          +300.00
        </div>
        <div className={s.mItem}>
          <span className={s.mItemIcon}>↑</span>
          <span className={s.mGrow}>
            Sent with Vault Key
            <span className={s.mMuted}>Yesterday</span>
          </span>
          −750.00
        </div>
      </div>
      <div className={s.mTab}>
        <span className={s.mTabActive}>Home</span>
        <span>Activity</span>
        <span>Security</span>
      </div>
    </Phone>
  );
}

/** The Vault Key approval screen at phone scale. */
export function VaultPreview() {
  return (
    <Phone label="Qeep Vault Key approval screen for a 750 MUSD send">
      <span className={s.mTitle}>Approve with Vault Key</span>
      <div className={s.mCenter}>
        <span className={s.mShieldBig}>
          <ShieldCheckIcon size={30} />
        </span>
        <span className={s.mAmount}>750.00 MUSD</span>
        <span className={s.mMuted}>to 0x8f3e…a21c</span>
      </div>
      <div className={s.mCard} style={{ gap: 10 }}>
        <div className={s.mStep}>
          <span className={s.mStepNum}>1</span>
          <span className={s.mGrow}>
            <strong>Post-quantum signature</strong>
            <span className={s.mMuted}>Hash-based, quantum-safe</span>
          </span>
        </div>
        <div className={s.mStep}>
          <span className={s.mStepNum}>2</span>
          <span className={s.mGrow}>
            <strong>One-time key</strong>
            <span className={s.mMuted}>Rotates after every use</span>
          </span>
        </div>
        <div className={s.mStep}>
          <span className={s.mStepNum}>3</span>
          <span className={s.mGrow}>
            <strong>Checked on Mezo</strong>
            <span className={s.mMuted}>Verified on-chain</span>
          </span>
        </div>
      </div>
      <div className={s.mWords}>••••• ••••• ••••• ••••• ••••• ••••• ••••• •••••</div>
      <div className={s.mButton}>Sign and send</div>
    </Phone>
  );
}
