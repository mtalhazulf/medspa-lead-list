import type { Route } from "next";
import Link from "next/link";

export const SETTINGS_TABS = [
  {
    id: "import",
    label: "Import list",
    description: "Drop a client CSV or Excel file to fill or refresh the desk.",
  },
  {
    id: "types",
    label: "Client types",
    description: "What kind of account each lead is — med spa, dermatology, and anything you add.",
  },
  {
    id: "tags",
    label: "Tags",
    description: "Shared labels the team applies on the list, including in bulk.",
  },
  {
    id: "fields",
    label: "Custom data",
    description: "Extra fields on every client, shown on the profile and optionally as list columns.",
  },
] as const;

export type SettingsTab = (typeof SETTINGS_TABS)[number]["id"];

export function parseSettingsTab(value: string | string[] | undefined): SettingsTab {
  const raw = Array.isArray(value) ? value[0] : value;
  return SETTINGS_TABS.some((tab) => tab.id === raw) ? (raw as SettingsTab) : "import";
}

export function SettingsTabs({ current }: { current: SettingsTab }) {
  return (
    <nav className="flex flex-wrap gap-1 border-b border-slate-200" aria-label="Settings sections">
      {SETTINGS_TABS.map((tab) => {
        const active = tab.id === current;
        return (
          <Link
            key={tab.id}
            href={`/settings?tab=${tab.id}` as Route}
            aria-current={active ? "page" : undefined}
            className={`-mb-px border-b-2 px-3 py-2.5 text-sm font-medium transition ${
              active
                ? "border-slate-900 text-slate-900"
                : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
