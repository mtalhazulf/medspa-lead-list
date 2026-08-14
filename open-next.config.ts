import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig({
  // No ISR/data cache is used: every page is request-time dynamic and reads from Supabase,
  // so the default in-memory queue/cache is all this app needs.
});
