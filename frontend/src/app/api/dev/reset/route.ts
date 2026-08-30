import { NextResponse } from "next/server";
import { resetDevEnvironment } from "@/server/dev/seed";
export async function POST() {
  if (process.env.APP_MODE === "production") return NextResponse.json({ error: "Dev reset disabled in production." }, { status: 403 });
  return NextResponse.json(await resetDevEnvironment());
}
