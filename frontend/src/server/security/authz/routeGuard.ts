import { jsonError } from "@/server/api/errors";
import type { Capability } from "./capabilities";
import { evaluateCapability } from "./evaluator";
import { subjectFromRequest } from "./subject";
import type { AuthzResource } from "./ownership";

export function withCapability<T>(input: {
  request: Request;
  capability: Capability;
  resource?: AuthzResource;
  handler: (subject: ReturnType<typeof subjectFromRequest>) => Promise<T> | T;
}) {
  const resource = input.resource ?? {};
  const subject = subjectFromRequest(input.request, { chainFamily: resource.chainFamily, network: resource.network });
  const decision = evaluateCapability(subject, input.capability, resource);
  if (!decision.allowed) {
    return jsonError({ code: "auth_error", message: "The requested capability is not available.", status: 403, recoveryAction: "reconnect", details: { reason: decision.reason, capability: decision.capability } });
  }
  return input.handler(subject);
}
