export const LABEL_COLORS = [
  { value: "slate", label: "Slate", pill: "bg-slate-100 text-slate-700 ring-slate-200", dot: "bg-slate-500" },
  { value: "sky", label: "Sky", pill: "bg-sky-100 text-sky-800 ring-sky-200", dot: "bg-sky-500" },
  { value: "indigo", label: "Indigo", pill: "bg-indigo-100 text-indigo-800 ring-indigo-200", dot: "bg-indigo-500" },
  { value: "violet", label: "Violet", pill: "bg-violet-100 text-violet-800 ring-violet-200", dot: "bg-violet-500" },
  { value: "emerald", label: "Emerald", pill: "bg-emerald-100 text-emerald-800 ring-emerald-200", dot: "bg-emerald-500" },
  { value: "teal", label: "Teal", pill: "bg-teal-100 text-teal-800 ring-teal-200", dot: "bg-teal-500" },
  { value: "amber", label: "Amber", pill: "bg-amber-100 text-amber-800 ring-amber-200", dot: "bg-amber-500" },
  { value: "orange", label: "Orange", pill: "bg-orange-100 text-orange-800 ring-orange-200", dot: "bg-orange-400" },
  { value: "rose", label: "Rose", pill: "bg-rose-100 text-rose-800 ring-rose-200", dot: "bg-rose-500" },
  { value: "zinc", label: "Zinc", pill: "bg-zinc-200 text-zinc-800 ring-zinc-300", dot: "bg-zinc-600" },
] as const;

export type LabelColor = (typeof LABEL_COLORS)[number]["value"];

const COLOR_BY_VALUE = new Map(LABEL_COLORS.map((c) => [c.value, c]));

export function labelColor(value: string | null | undefined) {
  return COLOR_BY_VALUE.get((value ?? "slate") as LabelColor) ?? LABEL_COLORS[0];
}

export function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export const LEAD_SOURCES = [
  { value: "import", label: "Imported list" },
  { value: "referral", label: "Referral" },
  { value: "inbound", label: "Inbound" },
  { value: "outbound", label: "Outbound" },
  { value: "event", label: "Event" },
  { value: "partner", label: "Partner" },
  { value: "other", label: "Other" },
] as const;
