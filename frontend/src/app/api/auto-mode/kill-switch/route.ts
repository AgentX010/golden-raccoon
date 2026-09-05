import { NextResponse } from "next/server";
import { engageKillSwitch, getKillSwitchState, reenableKillSwitch } from "@/server/autoMode/sandbox";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const chainFamily = url.searchParams.get("chainFamily") === "stellar" ? "stellar" : "evm";
  const network = url.searchParams.get("network") ?? "legacy-evm";
  return NextResponse.json(await getKillSwitchState({ chainFamily, network }));
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { action?: string; chainFamily?: "evm" | "stellar"; network?: string; actor?: string; reason?: string };
  const scope = { chainFamily: body.chainFamily === "stellar" ? "stellar" as const : "evm" as const, network: body.network ?? "legacy-evm" };
  if (body.action === "reenable") return NextResponse.json(await reenableKillSwitch(scope, body.actor ?? "operator"));
  if (body.action === "engage") return NextResponse.json(await engageKillSwitch(scope, body.actor ?? "operator", body.reason ?? "operator_request"));
  return NextResponse.json({ error: "invalid_kill_switch_action" }, { status: 400 });
}
