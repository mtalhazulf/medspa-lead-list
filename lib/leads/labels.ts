export const LABEL_COLORS = [
  { value: "slate", label: "Slate", hex: "#64748b" },
  { value: "sky", label: "Sky", hex: "#0ea5e9" },
  { value: "indigo", label: "Indigo", hex: "#6366f1" },
  { value: "violet", label: "Violet", hex: "#8b5cf6" },
  { value: "emerald", label: "Emerald", hex: "#10b981" },
  { value: "teal", label: "Teal", hex: "#14b8a6" },
  { value: "amber", label: "Amber", hex: "#d97706" },
  { value: "orange", label: "Orange", hex: "#ea580c" },
  { value: "rose", label: "Rose", hex: "#e11d48" },
  { value: "zinc", label: "Zinc", hex: "#52525b" },
] as const;

export type LabelColorName = (typeof LABEL_COLORS)[number]["value"];

const HEX_BY_NAME = new Map(LABEL_COLORS.map((c) => [c.value, c.hex]));

const HEX = /^#([0-9a-f]{6})$/i;

export function isHexColor(value: string): boolean {
  return HEX.test(value);
}

/** Named palette values and #rrggbb both become a 6-digit hex. */
export function toLabelHex(value: string | null | undefined): string {
  const raw = (value ?? "").trim();
  if (HEX.test(raw)) return `#${raw.slice(1).toLowerCase()}`;
  return HEX_BY_NAME.get(raw.toLowerCase() as LabelColorName) ?? "#64748b";
}

function hexToRgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mixTowardBlack(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  const t = 1 - amount;
  const to = (c: number) => Math.round(c * t)
    .toString(16)
    .padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}

export function labelChipStyle(color: string | null | undefined): {
  backgroundColor: string;
  color: string;
  boxShadow: string;
} {
  const hex = toLabelHex(color);
  const [r, g, b] = hexToRgb(hex);
  return {
    backgroundColor: `rgb(${r} ${g} ${b} / 0.14)`,
    color: mixTowardBlack(hex, 0.42),
    boxShadow: `inset 0 0 0 1px rgb(${r} ${g} ${b} / 0.32)`,
  };
}

export function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/** Machine key for custom fields — letters, numbers, underscores. */
export function slugifyKey(input: string): string {
  const slug = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  if (!slug) return "";
  return /^[a-z]/.test(slug) ? slug : `f_${slug}`.slice(0, 40);
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
