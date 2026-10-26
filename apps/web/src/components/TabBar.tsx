"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HomeIcon, ListIcon, ShieldIcon } from "./Icons";

const TABS = [
  { href: "/home", label: "Home", icon: <HomeIcon /> },
  { href: "/activity", label: "Activity", icon: <ListIcon /> },
  { href: "/security", label: "Security", icon: <ShieldIcon size={22} /> },
];

export function TabBar() {
  const path = usePathname();
  return (
    <nav className="tabbar" aria-label="Main">
      {TABS.map((t) => (
        <Link key={t.href} href={t.href} className={`tab${path === t.href ? " active" : ""}`}>
          {t.icon}
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
