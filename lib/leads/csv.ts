/**
 * Shared spreadsheet mapping for the Settings importer and the CLI script.
 * Headers match loosely: case, spaces and punctuation are ignored.
 */

export const FIELD_ALIASES: Record<string, string[]> = {
  company_name: ["companyname", "company", "name", "businessname"],
  address_line1: ["addressline1", "address1", "address", "street"],
  address_line2: ["addressline2", "address2", "suite", "unit"],
  city: ["city", "town"],
  state: ["state", "province", "region"],
  postal_code: ["postalcode", "zip", "zipcode", "postcode"],
  phone: ["companyphone", "phone", "phonenumber", "telephone"],
  google_url: ["googleurl", "googlemapsurl", "mapsurl", "googlemaps"],
  google_rating: ["googlestarrating", "starrating", "rating", "googlerating"],
  google_reviews: ["numberofgooglereviews", "googlereviews", "reviews", "reviewcount"],
  num_locations: ["numberoflocations", "locations", "locationcount"],
  website: ["website", "url", "site", "websiteurl"],
  categories: ["categories", "category", "types"],
  email: ["email", "emailaddress", "contactemail"],
  latitude: ["latitude", "lat"],
  longitude: ["longitude", "lng", "lon", "long"],
  instagram: ["instagram", "ig", "instagramurl", "instagramhandle"],
  facebook: ["facebook", "fb", "facebookurl"],
  tiktok: ["tiktok", "tiktokurl", "tiktokhandle"],
  booking_url: ["bookingurl", "booking", "bookinglink", "scheduler"],
  contact_name: ["contactname", "decisionmaker", "ownername", "fullname"],
  contact_title: ["contacttitle", "title", "jobtitle", "role"],
  contact_email: ["contactemail2", "personalemail", "directemail"],
  contact_phone: ["contactphone", "mobile", "cellphone", "directphone"],
  lead_source: ["leadsource", "source", "origin"],
};

export const IMPORT_BATCH_SIZE = 250;
export const IMPORT_MAX_ROWS = 50_000;
export const IMPORT_MAX_BYTES = 40 * 1024 * 1024;

export type ScrapedLead = {
  company_name: string;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  phone: string | null;
  google_url: string | null;
  google_cid: string | null;
  google_rating: number | null;
  google_reviews: number | null;
  num_locations: number | null;
  website: string | null;
  primary_category: string | null;
  categories: string[];
  email: string | null;
  latitude: number | null;
  longitude: number | null;
  instagram: string | null;
  facebook: string | null;
  tiktok: string | null;
  booking_url: string | null;
  contact_name: string | null;
  contact_title: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  lead_source: string | null;
  source: string;
};

export type CsvParseResult =
  | {
      ok: true;
      leads: ScrapedLead[];
      skipped: number;
      duplicates: number;
      mapped: string[];
    }
  | { ok: false; message: string };

const normalizeHeader = (header: string) => header.toLowerCase().replace(/[^a-z0-9]/g, "");

export function buildColumnMap(headers: string[]): Record<string, number> {
  const map: Record<string, number> = {};
  headers.forEach((header, index) => {
    const normalized = normalizeHeader(header);
    if (!normalized) return;
    for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
      if (map[field] === undefined && aliases.includes(normalized)) {
        map[field] = index;
        return;
      }
    }
  });
  return map;
}

const text = (value: string | null | undefined) => {
  const trimmed = String(value ?? "").trim();
  return trimmed === "" || trimmed === "-" || trimmed === "N/A" ? null : trimmed;
};

const number = (value: string | null | undefined) => {
  const cleaned = text(value)?.replace(/[^0-9.\-]/g, "");
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
};

const integer = (value: string | null | undefined) => {
  const parsed = number(value);
  return parsed === null ? null : Math.round(parsed);
};

const googleCid = (url: string | null) => url?.match(/[?&]cid=(\d+)/)?.[1] ?? null;

const splitCategories = (value: string | null) =>
  (value ?? "")
    .split(/[;|]/)
    .map((c) => c.trim())
    .filter(Boolean)
    .slice(0, 20);

export function dedupeKey(lead: Pick<ScrapedLead, "company_name" | "address_line1" | "postal_code">) {
  return [
    lead.company_name.trim().toLowerCase(),
    (lead.address_line1 ?? "").trim().toLowerCase(),
    (lead.postal_code ?? "").trim().toLowerCase(),
  ].join("|");
}

export function rowToLead(row: string[], columns: Record<string, number>, source: string): ScrapedLead | null {
  const get = (field: string) => {
    const index = columns[field];
    return index === undefined ? null : row[index];
  };

  const companyName = text(get("company_name"));
  if (!companyName) return null;

  const categories = splitCategories(text(get("categories")));
  const rating = number(get("google_rating"));
  const mapsUrl = text(get("google_url"));

  return {
    company_name: companyName.slice(0, 200),
    address_line1: text(get("address_line1"))?.slice(0, 200) ?? null,
    address_line2: text(get("address_line2"))?.slice(0, 200) ?? null,
    city: text(get("city"))?.slice(0, 80) ?? null,
    state: text(get("state"))?.toUpperCase().slice(0, 2) ?? null,
    postal_code: text(get("postal_code"))?.slice(0, 20) ?? null,
    phone: text(get("phone"))?.slice(0, 40) ?? null,
    google_url: mapsUrl?.slice(0, 500) ?? null,
    google_cid: googleCid(mapsUrl),
    google_rating: rating === null ? null : Math.min(5, Math.max(0, rating)),
    google_reviews: integer(get("google_reviews")),
    num_locations: integer(get("num_locations")),
    website: text(get("website"))?.slice(0, 300) ?? null,
    primary_category: categories[0] ?? null,
    categories,
    email: text(get("email"))?.toLowerCase().slice(0, 160) ?? null,
    latitude: number(get("latitude")),
    longitude: number(get("longitude")),
    instagram: text(get("instagram"))?.slice(0, 200) ?? null,
    facebook: text(get("facebook"))?.slice(0, 300) ?? null,
    tiktok: text(get("tiktok"))?.slice(0, 200) ?? null,
    booking_url: text(get("booking_url"))?.slice(0, 500) ?? null,
    contact_name: text(get("contact_name"))?.slice(0, 120) ?? null,
    contact_title: text(get("contact_title"))?.slice(0, 80) ?? null,
    contact_email: text(get("contact_email"))?.toLowerCase().slice(0, 160) ?? null,
    contact_phone: text(get("contact_phone"))?.slice(0, 40) ?? null,
    lead_source: text(get("lead_source"))?.slice(0, 40) ?? null,
    source: source.slice(0, 120),
  };
}

/** RFC 4180-ish: commas, doubled quotes, CRLF. */
export function parseCsv(text: string): string[][] {
  const input = text.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let i = 0;
  let inQuotes = false;

  while (i < input.length) {
    const char = input[i]!;
    if (inQuotes) {
      if (char === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += char;
      i += 1;
      continue;
    }
    if (char === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (char === ",") {
      row.push(field);
      field = "";
      i += 1;
      continue;
    }
    if (char === "\n" || char === "\r") {
      if (char === "\r" && input[i + 1] === "\n") i += 1;
      row.push(field);
      field = "";
      if (row.some((cell) => cell.trim() !== "")) rows.push(row);
      row = [];
      i += 1;
      continue;
    }
    field += char;
    i += 1;
  }

  row.push(field);
  if (row.some((cell) => cell.trim() !== "")) rows.push(row);
  return rows;
}

export function importedPerson(lead: Pick<ScrapedLead, "contact_name" | "contact_title" | "contact_email" | "contact_phone">) {
  const full_name = text(lead.contact_name);
  const email = text(lead.contact_email)?.toLowerCase() ?? null;
  const phone = text(lead.contact_phone);
  const title = text(lead.contact_title);
  if (!full_name && !email && !phone) return null;
  return {
    full_name: (full_name ?? email ?? phone)!.slice(0, 120),
    title: title?.slice(0, 80) ?? null,
    email: email?.slice(0, 160) ?? null,
    phone: phone?.slice(0, 40) ?? null,
  };
}

export function parseLeadTable(table: string[][], filename: string): CsvParseResult {
  const start = table.findIndex((row) => row.some((cell) => String(cell ?? "").trim() !== ""));
  const headers = start >= 0 ? table[start] : undefined;
  if (!headers || headers.length < 2) {
    return { ok: false, message: "This file has no header row." };
  }

  const columns = buildColumnMap(headers);
  if (columns.company_name === undefined) {
    return {
      ok: false,
      message: `Could not find a company name column. Headers seen: ${headers.slice(0, 12).join(", ")}`,
    };
  }

  const leads: ScrapedLead[] = [];
  const seenKeys = new Set<string>();
  const seenCids = new Set<string>();
  let skipped = 0;
  let duplicates = 0;

  for (const row of table.slice(start + 1)) {
    if (leads.length >= IMPORT_MAX_ROWS) break;
    const lead = rowToLead(row, columns, filename);
    if (!lead) {
      skipped += 1;
      continue;
    }

    const key = dedupeKey(lead);
    if (seenKeys.has(key)) {
      duplicates += 1;
      continue;
    }
    seenKeys.add(key);

    if (lead.google_cid) {
      if (seenCids.has(lead.google_cid)) lead.google_cid = null;
      else seenCids.add(lead.google_cid);
    }

    leads.push(lead);
  }

  return {
    ok: true,
    leads,
    skipped,
    duplicates,
    mapped: Object.keys(columns),
  };
}

export function parseLeadCsv(csvText: string, filename: string): CsvParseResult {
  return parseLeadTable(parseCsv(csvText), filename);
}
