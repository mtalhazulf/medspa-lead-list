"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUser } from "@/lib/dal/auth";
import { createClient } from "@/lib/supabase/server";

export interface ActionState {
  ok: boolean;
  message: string;
}

const uuid = z.string().uuid();
const optionalText = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v));

function contactError(message: string) {
  if (/lead_contacts_email_idx/.test(message)) return "That email is already on this company.";
  return message;
}

function revalidateLead(leadId: string) {
  revalidatePath("/leads");
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/dashboard");
}

const personSchema = z.object({
  leadId: uuid,
  contactId: z.string().trim(),
  fullName: z.string().trim().min(1, "Name is required").max(120),
  title: optionalText.pipe(z.string().max(80).nullable()),
  email: optionalText.pipe(z.string().max(160).nullable()),
  phone: optionalText.pipe(z.string().max(40).nullable()),
  linkedin: optionalText.pipe(z.string().max(300).nullable()),
  notes: optionalText.pipe(z.string().max(2000).nullable()),
  isPrimary: z.boolean(),
  doNotContact: z.boolean(),
});

function parsePerson(formData: FormData) {
  return personSchema.safeParse({
    leadId: formData.get("leadId"),
    contactId: formData.get("contactId") ?? "",
    fullName: formData.get("fullName") ?? "",
    title: formData.get("title") ?? "",
    email: formData.get("email") ?? "",
    phone: formData.get("phone") ?? "",
    linkedin: formData.get("linkedin") ?? "",
    notes: formData.get("notes") ?? "",
    isPrimary: formData.get("isPrimary") === "on" || formData.get("isPrimary") === "true",
    doNotContact: formData.get("doNotContact") === "on" || formData.get("doNotContact") === "true",
  });
}

export async function saveLeadContact(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  const parsed = parsePerson(formData);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { leadId, contactId, fullName, title, email, phone, linkedin, notes, isPrimary, doNotContact } =
    parsed.data;
  const supabase = await createClient();
  const row = {
    lead_id: leadId,
    full_name: fullName,
    title,
    email,
    phone,
    linkedin,
    notes,
    is_primary: isPrimary,
    do_not_contact: doNotContact,
  };

  if (contactId && uuid.safeParse(contactId).success) {
    const { error } = await supabase.from("lead_contacts").update(row).eq("id", contactId).eq("lead_id", leadId);
    if (error) return { ok: false, message: contactError(error.message) };
  } else {
    const { error } = await supabase.from("lead_contacts").insert(row);
    if (error) return { ok: false, message: contactError(error.message) };
  }

  revalidateLead(leadId);
  return { ok: true, message: contactId ? "Person saved" : "Person added" };
}

export async function deleteLeadContact(leadId: string, contactId: string): Promise<ActionState> {
  await requireUser();
  const parsed = z.object({ leadId: uuid, contactId: uuid }).safeParse({ leadId, contactId });
  if (!parsed.success) return { ok: false, message: "Invalid person" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("lead_contacts")
    .delete()
    .eq("id", parsed.data.contactId)
    .eq("lead_id", parsed.data.leadId);
  if (error) return { ok: false, message: error.message };

  revalidateLead(parsed.data.leadId);
  return { ok: true, message: "Person removed" };
}

export async function setPrimaryContact(leadId: string, contactId: string): Promise<ActionState> {
  await requireUser();
  const parsed = z.object({ leadId: uuid, contactId: uuid }).safeParse({ leadId, contactId });
  if (!parsed.success) return { ok: false, message: "Invalid person" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("lead_contacts")
    .update({ is_primary: true })
    .eq("id", parsed.data.contactId)
    .eq("lead_id", parsed.data.leadId);
  if (error) return { ok: false, message: error.message };

  revalidateLead(parsed.data.leadId);
  return { ok: true, message: "Primary contact updated" };
}
