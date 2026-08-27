import { NextResponse } from "next/server";
import { z } from "zod";
import { checkRateLimit } from "@/server/security/rateLimit";
import { RiskSnapshotInputError } from "@/server/snapshots/redaction";
import { createRiskSnapshot } from "@/server/snapshots/store";
import type { TokenScanResult } from "@/server/types";

const MAX_REQUEST_BYTES = 512 * 1024;
const createSchema = z.object({
  report: z.unknown(),
  expiresInSeconds: z.number().int().positive().optional(),
}).strict();

function noStore(response: NextResponse) {
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.headers.set("X-Content-Type-Options", "nosniff");
  return response;
}

export async function POST(request: Request) {
  const rateLimited = checkRateLimit(request, { namespace: "risk-snapshots:create", limit: 10, windowMs: 60_000 });
  if (rateLimited) return rateLimited;

  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_REQUEST_BYTES) {
    return noStore(NextResponse.json({ error: "Snapshot input exceeds 512 KiB." }, { status: 413 }));
  }

  const text = await request.text();
  if (Buffer.byteLength(text, "utf8") > MAX_REQUEST_BYTES) {
    return noStore(NextResponse.json({ error: "Snapshot input exceeds 512 KiB." }, { status: 413 }));
  }

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return noStore(NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 }));
  }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return noStore(NextResponse.json({ error: parsed.error.flatten() }, { status: 400 }));
  }

  try {
    const created = await createRiskSnapshot(parsed.data.report as TokenScanResult, {
      ttlSeconds: parsed.data.expiresInSeconds,
    });
    return noStore(NextResponse.json({
      ...created,
      shareUrl: `/snapshots/${created.id}`,
      downloadUrl: `/api/snapshots/${created.id}?download=1`,
    }, { status: 201 }));
  } catch (error) {
    if (error instanceof RiskSnapshotInputError || error instanceof z.ZodError || error instanceof TypeError) {
      return noStore(NextResponse.json({ error: error.message }, { status: 400 }));
    }
    console.error("Risk snapshot creation failed", error);
    return noStore(NextResponse.json({ error: "Risk snapshot could not be created." }, { status: 500 }));
  }
}
