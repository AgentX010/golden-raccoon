import { execSync } from "node:child_process";

const NEXT_PORT = process.env.PORT || 3000;
const URL = `http://127.0.0.1:${NEXT_PORT}/api/dev/seed`;

console.log("=> Checking development mode before seed...");
if (process.env.APP_MODE === "production") {
  console.error("[ERROR] Cannot run seed in production mode!");
  process.exit(1);
}

try {
  console.log("=> Requesting dev seed via API...");
  const curlOut = execSync(`curl -s -X POST ${URL} -H "Content-Type: application/json"`).toString();
  console.log("Response:", curlOut);
  console.log("=> Seed complete.");
} catch (err) {
  console.error("Failed to seed dev environment:", err.message);
  process.exit(1);
}
