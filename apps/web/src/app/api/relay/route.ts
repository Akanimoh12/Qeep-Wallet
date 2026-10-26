import { NextResponse } from "next/server";
import { handleRelay } from "@/lib/server/relayer";
import type { RelayRequest } from "@/lib/relay-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: RelayRequest;
  try {
    body = (await req.json()) as RelayRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const result = await handleRelay(body);
  return NextResponse.json(result, { status: "error" in result ? 400 : 200 });
}
