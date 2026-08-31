import { readFile } from "node:fs/promises";

const requiredRoutes = [
  "src/app/api/watchlist/route.ts",
  "src/app/api/watchlist/[id]/route.ts",
  "src/app/api/rules/route.ts",
  "src/app/api/execute/prepare/route.ts",
  "src/app/api/execute/submit/route.ts",
  "src/app/api/auto-mode/authorization/route.ts",
  "src/app/api/recovery/route.ts",
];

const root = new URL("../", import.meta.url);
const missing: string[] = [];
async function main() {
  for (const relative of requiredRoutes) {
    try {
      const source = await readFile(new URL(relative, root), "utf8");
      if (!/AUTHZ_CAPABILITY\s*=/.test(source) || !/withCapability|evaluateCapability/.test(source)) missing.push(relative);
    } catch {
      missing.push(relative);
    }
  }

  if (missing.length > 0) {
    console.error(`Authorization declarations missing:\n${missing.join("\n")}`);
    process.exit(1);
  }
  console.log(`Authorization coverage OK (${requiredRoutes.length} wallet/mutating routes).`);
}

void main();
