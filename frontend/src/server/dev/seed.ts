import { devFixtures } from "./fixtures";
import { createTransactionRecord } from "../storage";

export async function resetDevEnvironment() {
  if (process.env.APP_MODE === "production") {
    throw new Error("Cannot reset in production");
  }
  
  // Clean memory stores via some exported hook, or just for SQL:
  // getPostgresStorageAdapter().query('TRUNCATE table cascade...');
  console.log("Resetting environment...");
  // In a real implementation we would drop/truncate the tables.
}

export async function seedDevEnvironment() {
  if (process.env.APP_MODE === "production") {
    throw new Error("Cannot seed in production");
  }
  
  console.log("Seeding environment with fixtures...");
  
  for (const tx of devFixtures.transactions) {
    createTransactionRecord(tx as any);
  }
  
  return { seeded: true };
}
