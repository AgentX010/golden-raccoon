import { isSupabaseConfigured } from "@/lib/supabase";
import { resetDevEnvironment, seedDevEnvironment } from "../dev/seed";

export function bootstrapStorage() {
  if (!isSupabaseConfigured()) return;
}

export { resetDevEnvironment, seedDevEnvironment };
