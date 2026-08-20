"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUser } from "@/lib/dal/auth";
import { LABEL_COLORS, slugify } from "@/lib/leads/labels";
import { createClient } from "@/lib/supabase/server";

export interface CatalogState {
  ok: boolean;
  message: string;
}

const colorEnum = z.enum(LABEL_COLORS.map((c) => c.value) as [string, ...string[]]);

function revalidateCatalog() {
  revalidatePath("/settings");
  revalidatePath("/leads");
  revalidatePath("/dashboard");
}

async function uniqueSlug(
  table: "tags" | "client_types",
  name: string,
  excludeId?: string,
): Promise<string | null> {
  const base = slugify(name);
  if (!base) return null;

  const supabase = await createClient();
  for (let i = 0; i < 8; i++) {
    const candidate = i === 0 ? base : `${base}-${i + 1}`;
    const { data } = await supabase.from(table).select("id").eq("slug", candidate).maybeSingle();
    if (!data || data.id === excludeId) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}

const createSchema = z.object({
  name: z.string().trim().min(1, "Enter a name").max(60),
  color: colorEnum.default("slate"),
  description: z.string().trim().max(160).optional(),
});

export async function createTag(_prev: CatalogState, formData: FormData): Promise<CatalogState> {
  await requireUser();
  const parsed = createSchema.safeParse({
    name: formData.get("name"),
    color: formData.get("color") || "slate",
  });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid" };

  const slug = await uniqueSlug("tags", parsed.data.name);
  if (!slug) return { ok: false, message: "Enter a name" };

  const supabase = await createClient();
  const { count } = await supabase.from("tags").select("id", { count: "exact", head: true });
  const { error } = await supabase.from("tags").insert({
    name: parsed.data.name,
    slug,
    color: parsed.data.color,
    sort_order: ((count ?? 0) + 1) * 10,
  });

  if (error) {
    if (error.code === "23505") return { ok: false, message: "A tag with that name already exists" };
    return { ok: false, message: error.message };
  }

  revalidateCatalog();
  return { ok: true, message: `Added “${parsed.data.name}”` };
}

export async function createClientType(
  _prev: CatalogState,
  formData: FormData,
): Promise<CatalogState> {
  await requireUser();
  const parsed = createSchema.safeParse({
    name: formData.get("name"),
    color: formData.get("color") || "slate",
    description: formData.get("description") ?? "",
  });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid" };

  const slug = await uniqueSlug("client_types", parsed.data.name);
  if (!slug) return { ok: false, message: "Enter a name" };

  const supabase = await createClient();
  const { count } = await supabase.from("client_types").select("id", { count: "exact", head: true });
  const { error } = await supabase.from("client_types").insert({
    name: parsed.data.name,
    slug,
    color: parsed.data.color,
    description: parsed.data.description || null,
    sort_order: ((count ?? 0) + 1) * 10,
  });

  if (error) {
    if (error.code === "23505") return { ok: false, message: "A type with that name already exists" };
    return { ok: false, message: error.message };
  }

  revalidateCatalog();
  return { ok: true, message: `Added “${parsed.data.name}”` };
}

const updateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(60),
  color: colorEnum,
  description: z.string().trim().max(160).optional(),
});

export async function updateTag(_prev: CatalogState, formData: FormData): Promise<CatalogState> {
  await requireUser();
  const parsed = updateSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    color: formData.get("color") || "slate",
  });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("tags")
    .update({ name: parsed.data.name, color: parsed.data.color })
    .eq("id", parsed.data.id);

  if (error) {
    if (error.code === "23505") return { ok: false, message: "A tag with that name already exists" };
    return { ok: false, message: error.message };
  }

  revalidateCatalog();
  return { ok: true, message: "Saved" };
}

export async function updateClientType(
  _prev: CatalogState,
  formData: FormData,
): Promise<CatalogState> {
  await requireUser();
  const parsed = updateSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    color: formData.get("color") || "slate",
    description: formData.get("description") ?? "",
  });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("client_types")
    .update({
      name: parsed.data.name,
      color: parsed.data.color,
      description: parsed.data.description || null,
    })
    .eq("id", parsed.data.id);

  if (error) {
    if (error.code === "23505") return { ok: false, message: "A type with that name already exists" };
    return { ok: false, message: error.message };
  }

  revalidateCatalog();
  return { ok: true, message: "Saved" };
}

export async function deleteTag(id: string): Promise<CatalogState> {
  await requireUser();
  const parsed = z.string().uuid().safeParse(id);
  if (!parsed.success) return { ok: false, message: "Invalid tag" };

  const supabase = await createClient();
  const { error } = await supabase.from("tags").delete().eq("id", parsed.data);
  if (error) return { ok: false, message: error.message };

  revalidateCatalog();
  return { ok: true, message: "Tag removed" };
}

export async function deleteClientType(id: string): Promise<CatalogState> {
  await requireUser();
  const parsed = z.string().uuid().safeParse(id);
  if (!parsed.success) return { ok: false, message: "Invalid type" };

  const supabase = await createClient();
  const { error } = await supabase.from("client_types").delete().eq("id", parsed.data);
  if (error) return { ok: false, message: error.message };

  revalidateCatalog();
  return { ok: true, message: "Type removed" };
}
