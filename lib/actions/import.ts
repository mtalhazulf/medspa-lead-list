"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUser } from "@/lib/dal/auth";
import { IMPORT_BATCH_SIZE } from "@/lib/leads/csv";
import { createClient } from "@/lib/supabase/server";
import type { LeadInsert } from "@/lib/types/database";

export interface ImportBatchResult {
  ok: boolean;
  upserted: number;
  failed: number;
  message: string;
}

const nullableText = z.string().max(500).nullable();

const scrapedLeadSchema = z.object({
  company_name: z.string().trim().min(1).max(200),
  address_line1: nullableText,
  address_line2: nullableText,
  city: z.string().max(80).nullable(),
  state: z.string().max(2).nullable(),
  postal_code: z.string().max(20).nullable(),
  phone: z.string().max(40).nullable(),
  google_url: nullableText,
  google_cid: z.string().max(40).nullable(),
  google_rating: z.number().min(0).max(5).nullable(),
  google_reviews: z.number().int().nullable(),
  num_locations: z.number().int().nullable(),
  website: z.string().max(300).nullable(),
  primary_category: z.string().max(120).nullable(),
  categories: z.array(z.string().max(80)).max(20),
  email: z.string().max(160).nullable(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  instagram: z.string().max(200).nullable(),
  facebook: z.string().max(300).nullable(),
  tiktok: z.string().max(200).nullable(),
  booking_url: z.string().max(500).nullable(),
  contact_name: z.string().max(120).nullable(),
  contact_title: z.string().max(80).nullable(),
  contact_email: z.string().max(160).nullable(),
  contact_phone: z.string().max(40).nullable(),
  lead_source: z.string().max(40).nullable(),
  source: z.string().trim().min(1).max(120),
});

export async function importLeadBatch(
  rows: unknown[],
  options: { finalize?: boolean } = {},
): Promise<ImportBatchResult> {
  await requireUser();

  if (!Array.isArray(rows) || rows.length === 0) {
    return { ok: false, upserted: 0, failed: 0, message: "Nothing to import in this batch." };
  }
  if (rows.length > IMPORT_BATCH_SIZE) {
    return {
      ok: false,
      upserted: 0,
      failed: rows.length,
      message: `Batch too large (max ${IMPORT_BATCH_SIZE}).`,
    };
  }

  const parsed = z.array(scrapedLeadSchema).safeParse(rows);
  if (!parsed.success) {
    return { ok: false, upserted: 0, failed: rows.length, message: "A row in this batch failed validation." };
  }

  const payload: LeadInsert[] = parsed.data.map((row) => ({
    company_name: row.company_name,
    address_line1: row.address_line1,
    address_line2: row.address_line2,
    city: row.city,
    state: row.state,
    postal_code: row.postal_code,
    phone: row.phone,
    google_url: row.google_url,
    google_cid: row.google_cid,
    google_rating: row.google_rating,
    google_reviews: row.google_reviews,
    num_locations: row.num_locations,
    website: row.website,
    primary_category: row.primary_category,
    categories: row.categories,
    email: row.email,
    latitude: row.latitude,
    longitude: row.longitude,
    instagram: row.instagram,
    facebook: row.facebook,
    tiktok: row.tiktok,
    booking_url: row.booking_url,
    contact_name: row.contact_name,
    contact_title: row.contact_title,
    contact_email: row.contact_email,
    contact_phone: row.contact_phone,
    lead_source: row.lead_source,
    source: row.source,
  }));

  const supabase = await createClient();
  const { error } = await supabase.from("leads").upsert(payload, {
    onConflict: "dedupe_key",
    ignoreDuplicates: false,
  });

  if (error) {
    return { ok: false, upserted: 0, failed: payload.length, message: error.message };
  }

  if (options.finalize) {
    revalidatePath("/leads");
    revalidatePath("/dashboard");
    revalidatePath("/settings");
  }

  return { ok: true, upserted: payload.length, failed: 0, message: "" };
}
