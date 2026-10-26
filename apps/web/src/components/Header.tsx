import Link from "next/link";
import { BackIcon } from "./Icons";

export function Header({ title, back = "/home" }: { title: string; back?: string }) {
  return (
    <div className="header">
      <Link href={back} className="icon-btn" aria-label="Back">
        <BackIcon />
      </Link>
      <h1 className="h2">{title}</h1>
    </div>
  );
}
