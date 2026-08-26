import { commonErrorCodes, ApiError, jsonError } from '../src/server/api/errors';
import * as assert from 'assert';

console.log('Validating error taxonomy...');

// Check required categories
const requiredCodes = [
  "validation_error",
  "auth_error",
  "rate_limited",
  "provider_timeout",
  "stale_data",
  "network_mismatch",
  "wallet_rejection",
  "payment_failure",
  "simulation_failure",
  "submission_failure",
  "internal_error"
];

for (const code of requiredCodes) {
  assert(Object.values(commonErrorCodes).includes(code as any), `Missing required error code: ${code}`);
}

// Check ApiError instantiation
const err = new ApiError("rate_limited", "Too many requests", 429);
assert(err.code === "rate_limited");
assert(err.retryable === true);
assert(err.recoveryAction === "retry");

const fatal = new ApiError("wallet_rejection", "User rejected", 400);
assert(fatal.retryable === false);
assert(fatal.recoveryAction === "stop");

// Ensure terminal safety failures are NEVER marked retryable
// Assuming simulation_failure, submission_failure, payment_failure, wallet_rejection
const terminalCodes = [
  "wallet_rejection",
  "payment_failure",
  "simulation_failure",
  "submission_failure"
] as const;

for (const code of terminalCodes) {
  const e = new ApiError(code, "Failure", 500);
  assert(e.retryable === false, `${code} should not be retryable by default`);
}

console.log('Error contract conformance check passed!');
