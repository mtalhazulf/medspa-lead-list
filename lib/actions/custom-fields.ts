"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUser } from "@/lib/dal/auth";
import { slugifyKey } from "@/lib/leads/labels";
import { createClient } from "@/lib/supabase/server";
import type { CustomFieldType } from "@/lib/types/database";

export interface CatalogState {
  ok: boolean;
  message: string;
}

const TYPES = ["text", "number", "date", "url", "boolean"] as const;

const createSchema = z.object({
  name: z.string().trim().min(1, "Enter a name").max(60),
  fieldType: z.enum(TYPES),
  showInTable: z.boolean(),
});

function revalidate() {
  revalidatePath("/settings");
  revalidatePath("/leads");
  revalidatePath("/dashboard");
}

async function uniqueSlug(name: string, excludeId?: string): Promise<string | null> {
  const base = slugifyKey(name);
  if (!base) return null;
  const supabase = await createClient();
  for (let i = 0; i < 8; i++) {
    const candidate = i === 0 ? base : `${base}_${i + 1}`.slice(0, 40);
    const { data } = await supabase.from("custom_fields").select("id").eq("slug", candidate).maybeSingle();
    if (!data || data.id === excludeId) return candidate;
  }
  return `${base}_${Date.now().toString(36)}`.slice(0, 40);
}

export async function createCustomField(_prev: CatalogState, formData: FormData): Promise<CatalogState> {
  await requireUser();
  const parsed = createSchema.safeParse({
    name: formData.get("name"),
    fieldType: formData.get("fieldType") || "text",
    showInTable: formData.get("showInTable") === "on",
  });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid" };

  const slug = await uniqueSlug(parsed.data.name);
  if (!slug) return { ok: false, message: "Enter a name" };

  const supabase = await createClient();
  const { count } = await supabase.from("custom_fields").select("id", { count: "exact", head: true });
  if ((count ?? 0) >= 24) return { ok: false, message: "24 custom fields is the cap." };

  const { error } = await supabase.from("custom_fields").insert({
    name: parsed.data.name,
    slug,
    field_type: parsed.data.fieldType,
    show_in_table: parsed.data.showInTable,
    sort_order: ((count ?? 0) + 1) * 10,
  });

  if (error) {
    if (error.code === "23505") return { ok: false, message: "A field with that name already exists" };
    return { ok: false, message: error.message };
  }

  revalidate();
  return { ok: true, message: `Added “${parsed.data.name}”` };
}

export async function updateCustomField(_prev: CatalogState, formData: FormData): Promise<CatalogState> {
  await requireUser();
  const parsed = z
    .object({
      id: z.string().uuid(),
      name: z.string().trim().min(1).max(60),
      fieldType: z.enum(TYPES),
      showInTable: z.boolean(),
    })
    .safeParse({
      id: formData.get("id"),
      name: formData.get("name"),
      fieldType: formData.get("fieldType") || "text",
      showInTable: formData.get("showInTable") === "on",
    });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("custom_fields")
    .update({
      name: parsed.data.name,
      field_type: parsed.data.fieldType as CustomFieldType,
      show_in_table: parsed.data.showInTable,
    })
    .eq("id", parsed.data.id);

  if (error) {
    if (error.code === "23505") return { ok: false, message: "A field with that name already exists" };
    return { ok: false, message: error.message };
  }

  revalidate();
  return { ok: true, message: "Saved" };
}

export async function deleteCustomField(id: string): Promise<CatalogState> {
  await requireUser();
  const parsed = z.string().uuid().safeParse(id);
  if (!parsed.success) return { ok: false, message: "Invalid field" };

  const supabase = await createClient();
  const { error } = await supabase.from("custom_fields").delete().eq("id", parsed.data);
  if (error) return { ok: false, message: error.message };

  revalidate();
  return { ok: true, message: "Field removed" };
}
