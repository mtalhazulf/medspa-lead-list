import type { Metadata } from "next";

import { ClientTypeCatalog, TagCatalog } from "@/components/settings/catalog-manager";
import { listClientTypes, listTags } from "@/lib/dal/leads";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const [types, tags] = await Promise.all([listClientTypes(), listTags()]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">Settings</h1>
        <p className="mt-0.5 text-sm text-slate-500">
          Configure the client types and tags the whole team uses to track the list.
        </p>
      </div>

      <ClientTypeCatalog types={types} />
      <TagCatalog tags={tags} />
    </div>
  );
}
