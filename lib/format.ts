const numberFmt = new Intl.NumberFormat("en-US");
const currencyFmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});
const dateFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });
const dateTimeFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export function formatNumber(value: number | null | undefined): string {
  return value === null || value === undefined ? "—" : numberFmt.format(value);
}

export function formatCurrency(value: number | null | undefined): string {
  return value === null || value === undefined ? "—" : currencyFmt.format(value);
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value.length === 10 ? `${value}T00:00:00Z` : value);
  return Number.isNaN(date.getTime()) ? "—" : dateFmt.format(date);
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : dateTimeFmt.format(date);
}

/** "3d ago" / "in 2d" — compact enough for a dense table cell. */
export function formatRelative(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value.length === 10 ? `${value}T00:00:00Z` : value);
  if (Number.isNaN(date.getTime())) return "—";

  const diffMs = date.getTime() - Date.now();
  const abs = Math.abs(diffMs);
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;

  let text: string;
  if (abs < hour) text = `${Math.max(1, Math.round(abs / minute))}m`;
  else if (abs < day) text = `${Math.round(abs / hour)}h`;
  else if (abs < 30 * day) text = `${Math.round(abs / day)}d`;
  else if (abs < 365 * day) text = `${Math.round(abs / (30 * day))}mo`;
  else text = `${Math.round(abs / (365 * day))}y`;

  return diffMs < 0 ? `${text} ago` : `in ${text}`;
}

export function isOverdue(date: string | null | undefined): boolean {
  if (!date) return false;
  return date.slice(0, 10) < new Date().toISOString().slice(0, 10);
}

/** Source rows carry bare domains as often as full URLs. */
export function toHref(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export function prettyDomain(url: string | null | undefined): string {
  const href = toHref(url);
  if (!href) return "—";
  try {
    return new URL(href).hostname.replace(/^www\./, "");
  } catch {
    return url ?? "—";
  }
}

export function instagramHandle(value: string | null | undefined): string | null {
  if (!value) return null;
  const handle = value.trim().replace(/^@/, "").replace(/\/$/, "").split("/").pop();
  return handle ? `@${handle}` : null;
}

export function instagramHref(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  const handle = trimmed.replace(/^@/, "");
  return handle ? `https://instagram.com/${handle}` : null;
}

export function telHref(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/[^\d+]/g, "");
  return digits ? `tel:${digits}` : null;
}

/** Today in ISO date form, for `<input type="date">` defaults. */
export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
