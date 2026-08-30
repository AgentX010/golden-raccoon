import { NextResponse } from "next/server";
import { seedDevEnvironment } from "@/server/dev/seed";
export async function POST() {
  if (process.env.APP_MODE === "production") return NextResponse.json({ error: "Dev seed disabled in production." }, { status: 403 });
  return NextResponse.json(await seedDevEnvironment());
}
