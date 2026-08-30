import { NextResponse } from "next/server"; import { getRuntimeMode } from "@/server/env/runtimeMode"; import { resetDevEnvironment } from "@/server/dev/seed";
export async function POST() { if (getRuntimeMode() === "live") return NextResponse.json({ error: "Dev reset disabled in live mode." }, { status: 403 }); return NextResponse.json(await resetDevEnvironment()); }
