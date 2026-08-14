import { statusMeta } from "@/lib/pipeline";
import type { LeadStatus } from "@/lib/types/database";

export function StatusPill({ status }: { status: LeadStatus }) {
  const meta = statusMeta(status);
  return <span className={`pill ${meta.className}`}>{meta.label}</span>;
}
