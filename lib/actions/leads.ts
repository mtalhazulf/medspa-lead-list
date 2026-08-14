"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUser } from "@/lib/dal/auth";
import { listLeadIdsForQuery } from "@/lib/dal/leads";
import { parseLeadQuery, type RawSearchParams } from "@/lib/leads/query";
import { createClient } from "@/lib/supabase/server";
import { LEAD_STATUSES, MANUAL_ACTIVITY_TYPES } from "@/lib/pipeline";
import type { LeadStatus, LeadUpdate } from "@/lib/types/database";

export interface ActionState {
  ok: boolean;
  message: string;
}

const statusEnum = z.enum(LEAD_STATUSES.map((s) => s.value) as [LeadStatus, ...LeadStatus[]]);

const activityEnum = z.enum(
  MANUAL_ACTIVITY_TYPES.map((a) => a.value) as [
    (typeof MANUAL_ACTIVITY_TYPES)[number]["value"],
    ...(typeof MANUAL_ACTIVITY_TYPES)[number]["value"][],
  ],
);

const uuid = z.string().uuid();

/** Empty strings from `<form>` inputs mean "clear this field". */
const optionalText = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v));

const optionalNumber = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : Number(v)))
  .refine((v) => v === null || Number.isFinite(v), "Must be a number");

function revalidateLead(leadId: string) {
  revalidatePath("/leads");
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/dashboard");
}

const detailsSchema = z.object({
  leadId: uuid,
  status: statusEnum,
  priority: z.coerce.number().int().min(0).max(3),
  ownerId: z.string().trim(),
  nextFollowUpAt: optionalText,
  dealValue: optionalNumber,
  tags: z.string().trim().max(300),
  notes: z.string().trim().max(20_000),
});

export async function saveLeadDetails(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();

  const parsed = detailsSchema.safeParse({
    leadId: formData.get("leadId"),
    status: formData.get("status"),
    priority: formData.get("priority"),
    ownerId: formData.get("ownerId") ?? "",
    nextFollowUpAt: formData.get("nextFollowUpAt") ?? "",
    dealValue: formData.get("dealValue") ?? "",
    tags: formData.get("tags") ?? "",
    notes: formData.get("notes") ?? "",
  });

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { leadId, ownerId, tags, ...rest } = parsed.data;
  const supabase = await createClient();

  const patch: LeadUpdate = {
    status: rest.status,
    priority: rest.priority,
    owner_id: ownerId === "me" ? user.id : ownerId === "" ? null : ownerId,
    next_follow_up_at: rest.nextFollowUpAt,
    deal_value: rest.dealValue,
    notes: rest.notes === "" ? null : rest.notes,
    tags: tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 20),
  };

  const { error } = await supabase.from("leads").update(patch).eq("id", leadId);
  if (error) return { ok: false, message: error.message };

  revalidateLead(leadId);
  return { ok: true, message: "Saved" };
}

const activitySchema = z.object({
  leadId: uuid,
  type: activityEnum,
  body: z.string().trim().min(1, "Write something first").max(10_000),
  occurredAt: z.string().trim(),
  nextFollowUpAt: optionalText,
  status: z.union([statusEnum, z.literal("")]),
});

export async function logActivity(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();

  const parsed = activitySchema.safeParse({
    leadId: formData.get("leadId"),
    type: formData.get("type"),
    body: formData.get("body") ?? "",
    occurredAt: formData.get("occurredAt") ?? "",
    nextFollowUpAt: formData.get("nextFollowUpAt") ?? "",
    status: formData.get("status") ?? "",
  });

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { leadId, type, body, occurredAt, nextFollowUpAt, status } = parsed.data;
  const supabase = await createClient();

  const { error } = await supabase.from("lead_activities").insert({
    lead_id: leadId,
    user_id: user.id,
    type,
    body,
    from_status: null,
    to_status: null,
    ...(occurredAt ? { occurred_at: new Date(occurredAt).toISOString() } : {}),
  });

  if (error) return { ok: false, message: error.message };

  // Advancing the status and scheduling the next touch are part of the same
  // "I just worked this lead" gesture, so they ride along with the log entry.
  const patch: LeadUpdate = {};
  if (status) patch.status = status;
  if (nextFollowUpAt !== null) patch.next_follow_up_at = nextFollowUpAt;

  if (Object.keys(patch).length > 0) {
    const { error: updateError } = await supabase.from("leads").update(patch).eq("id", leadId);
    if (updateError) return { ok: false, message: updateError.message };
  }

  revalidateLead(leadId);
  return { ok: true, message: "Logged" };
}

const bulkSchema = z.object({
  ids: z.array(uuid).min(1, "Select at least one lead").max(2000),
  status: statusEnum.optional(),
  owner: z.enum(["me", "unassigned"]).optional(),
  priority: z.number().int().min(0).max(3).optional(),
  nextFollowUpAt: z.string().optional(),
  addTag: z.string().trim().max(40).optional(),
});

export type BulkPatch = Omit<z.infer<typeof bulkSchema>, "ids">;

export async function bulkUpdateLeads(ids: string[], patch: BulkPatch): Promise<ActionState> {
  const user = await requireUser();

  const parsed = bulkSchema.safeParse({ ids, ...patch });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createClient();
  const update: LeadUpdate = {};

  if (parsed.data.status) update.status = parsed.data.status;
  if (parsed.data.owner) update.owner_id = parsed.data.owner === "me" ? user.id : null;
  if (parsed.data.priority !== undefined) update.priority = parsed.data.priority;
  if (parsed.data.nextFollowUpAt !== undefined) {
    update.next_follow_up_at = parsed.data.nextFollowUpAt || null;
  }

  if (Object.keys(update).length === 0 && !parsed.data.addTag) {
    return { ok: false, message: "Nothing to update" };
  }

  if (Object.keys(update).length > 0) {
    const { error } = await supabase.from("leads").update(update).in("id", parsed.data.ids);
    if (error) return { ok: false, message: error.message };
  }

  if (parsed.data.addTag) {
    // Tag appends must not clobber existing tags, so merge per lead.
    const { data: current, error: readError } = await supabase
      .from("leads")
      .select("id, tags")
      .in("id", parsed.data.ids);

    if (readError) return { ok: false, message: readError.message };

    const tag = parsed.data.addTag;
    const needsTag = (current ?? []).filter((row) => !row.tags.includes(tag));

    for (const row of needsTag) {
      const { error: tagError } = await supabase
        .from("leads")
        .update({ tags: [...row.tags, tag] })
        .eq("id", row.id);
      if (tagError) return { ok: false, message: tagError.message };
    }
  }

  revalidatePath("/leads");
  revalidatePath("/dashboard");
  return { ok: true, message: `Updated ${parsed.data.ids.length} lead${parsed.data.ids.length === 1 ? "" : "s"}` };
}

/**
 * Ids of every lead matching a filter set, for "select all N matching".
 * Capped so one click can never queue an unbounded bulk write.
 */
export async function getMatchingLeadIds(params: RawSearchParams): Promise<string[]> {
  await requireUser();
  return listLeadIdsForQuery(parseLeadQuery(params), 2000);
}

export async function setLeadStatus(leadId: string, status: LeadStatus): Promise<ActionState> {
  await requireUser();

  const parsed = z.object({ leadId: uuid, status: statusEnum }).safeParse({ leadId, status });
  if (!parsed.success) return { ok: false, message: "Invalid input" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("leads")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.leadId);

  if (error) return { ok: false, message: error.message };

  revalidateLead(parsed.data.leadId);
  return { ok: true, message: "Status updated" };
}

export async function claimLead(leadId: string): Promise<ActionState> {
  const user = await requireUser();

  const parsed = uuid.safeParse(leadId);
  if (!parsed.success) return { ok: false, message: "Invalid lead" };

  const supabase = await createClient();
  const { error } = await supabase.from("leads").update({ owner_id: user.id }).eq("id", parsed.data);

  if (error) return { ok: false, message: error.message };

  revalidateLead(parsed.data);
  return { ok: true, message: "Assigned to you" };
}
