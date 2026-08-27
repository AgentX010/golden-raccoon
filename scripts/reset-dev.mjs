import { execSync } from "node:child_process";

const NEXT_PORT = process.env.PORT || 3000;
const URL = `http://127.0.0.1:${NEXT_PORT}/api/dev/reset`;

console.log("=> Checking development mode before reset...");
if (process.env.APP_MODE === "production") {
  console.error("[ERROR] Cannot run reset in production mode!");
  process.exit(1);
}

try {
  console.log("=> Requesting dev reset via API...");
  const curlOut = execSync(`curl -s -X POST ${URL} -H "Content-Type: application/json"`).toString();
  console.log("Response:", curlOut);
  console.log("=> Reset complete.");
} catch (err) {
  console.error("Failed to reset dev environment:", err.message);
  process.exit(1);
}
