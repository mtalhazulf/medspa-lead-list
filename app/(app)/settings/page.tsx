import type { Metadata } from "next";

import { ImportList } from "@/components/settings/import-list";
import { ClientTypeCatalog, TagCatalog } from "@/components/settings/catalog-manager";
import { SettingsTabs, parseSettingsTab, SETTINGS_TABS } from "@/components/settings/settings-tabs";
import { listClientTypes, listTags } from "@/lib/dal/leads";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  const tab = parseSettingsTab((await searchParams).tab);
  const meta = SETTINGS_TABS.find((item) => item.id === tab) ?? SETTINGS_TABS[0]!;
  const [types, tags] = await Promise.all([
    tab === "types" ? listClientTypes() : Promise.resolve([]),
    tab === "tags" ? listTags() : Promise.resolve([]),
  ]);

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">Settings</h1>
        <p className="mt-0.5 text-sm text-slate-500">{meta.description}</p>
      </div>

      <SettingsTabs current={tab} />

      {tab === "import" && <ImportList />}
      {tab === "types" && <ClientTypeCatalog types={types} />}
      {tab === "tags" && <TagCatalog tags={tags} />}
    </div>
  );
}
