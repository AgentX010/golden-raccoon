import { NextResponse } from "next/server"; import { getRuntimeMode } from "@/server/env/runtimeMode"; import { seedDevEnvironment } from "@/server/dev/seed";
export async function POST() { if (getRuntimeMode() === "live") return NextResponse.json({ error: "Dev seed disabled in live mode." }, { status: 403 }); return NextResponse.json(await seedDevEnvironment()); }
