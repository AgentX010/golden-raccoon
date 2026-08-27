import { NextResponse } from "next/server";
import { z } from "zod";
import { checkRateLimit } from "@/server/security/rateLimit";
import { revokeRiskSnapshot } from "@/server/snapshots/store";

const SNAPSHOT_ID = /^snapshot_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const bodySchema = z.object({ revocationToken: z.string().min(32).max(256) }).strict();

function noStore(response: NextResponse) {
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.headers.set("X-Content-Type-Options", "nosniff");
  return response;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const rateLimited = checkRateLimit(request, { namespace: "risk-snapshots:revoke", limit: 10, windowMs: 60_000 });
  if (rateLimited) return rateLimited;

  const { id } = await params;
  if (!SNAPSHOT_ID.test(id)) {
    return noStore(NextResponse.json({ error: "Invalid snapshot id." }, { status: 400 }));
  }
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return noStore(NextResponse.json({ error: "A valid revocation token is required." }, { status: 400 }));
  }
  const result = await revokeRiskSnapshot(id, parsed.data.revocationToken);
  if (!result.ok) {
    const status = result.code === "not_found" ? 404 : 403;
    return noStore(NextResponse.json({ error: result.detail, code: result.code }, { status }));
  }
  return noStore(NextResponse.json(result));
}
