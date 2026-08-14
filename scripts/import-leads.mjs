#!/usr/bin/env node
/**
 * Bulk-import the med spa lead sheet into Supabase.
 *
 *   node scripts/import-leads.mjs data/leads.csv
 *   node scripts/import-leads.mjs data/leads.csv --dry-run
 *   node scripts/import-leads.mjs data/leads.csv --batch=1000
 *
 * Requires (put them in .env.local, the npm script loads that file):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY   <- server-side only, never ships to the browser
 *
 * Re-running is safe: rows are upserted on `dedupe_key`
 * (company + street + zip), and only scraped columns are written — status,
 * owner, notes, tags and follow-up dates are never overwritten.
 */
import { createReadStream } from "node:fs";
import { basename } from "node:path";
import process from "node:process";

import { parse } from "csv-parse";
import { createClient } from "@supabase/supabase-js";

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("-"));
const dryRun = args.includes("--dry-run");
const batchSize = Number(args.find((a) => a.startsWith("--batch="))?.split("=")[1] ?? 500);

if (!file) {
  console.error("Usage: node scripts/import-leads.mjs <file.csv> [--dry-run] [--batch=500]");
  process.exit(1);
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!dryRun && (!SUPABASE_URL || !SERVICE_KEY)) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const supabase = dryRun
  ? null
  : createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

// --- header mapping -------------------------------------------------------
// Source headers are matched loosely: case, spaces and punctuation are ignored.
const FIELD_ALIASES = {
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
};

const normalizeHeader = (header) => String(header ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

function buildColumnMap(headers) {
  const map = {};
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

// --- value cleaning -------------------------------------------------------
const text = (value) => {
  const trimmed = String(value ?? "").trim();
  return trimmed === "" || trimmed === "-" || trimmed === "N/A" ? null : trimmed;
};

const number = (value) => {
  const cleaned = text(value)?.replace(/[^0-9.\-]/g, "");
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
};

const integer = (value) => {
  const parsed = number(value);
  return parsed === null ? null : Math.round(parsed);
};

const googleCid = (url) => text(url)?.match(/[?&]cid=(\d+)/)?.[1] ?? null;

const splitCategories = (value) =>
  (text(value) ?? "")
    .split(/[;|]/)
    .map((c) => c.trim())
    .filter(Boolean);

function toLead(row, columns) {
  const get = (field) => {
    const index = columns[field];
    return index === undefined ? null : row[index];
  };

  const companyName = text(get("company_name"));
  if (!companyName) return null;

  const categories = splitCategories(get("categories"));
  const rating = number(get("google_rating"));

  return {
    company_name: companyName,
    address_line1: text(get("address_line1")),
    address_line2: text(get("address_line2")),
    city: text(get("city")),
    state: text(get("state"))?.toUpperCase().slice(0, 2) ?? null,
    postal_code: text(get("postal_code")),
    phone: text(get("phone")),
    google_url: text(get("google_url")),
    google_cid: googleCid(get("google_url")),
    google_rating: rating === null ? null : Math.min(5, Math.max(0, rating)),
    google_reviews: integer(get("google_reviews")),
    num_locations: integer(get("num_locations")),
    website: text(get("website")),
    primary_category: categories[0] ?? null,
    categories,
    email: text(get("email"))?.toLowerCase() ?? null,
    latitude: number(get("latitude")),
    longitude: number(get("longitude")),
    instagram: text(get("instagram")),
    facebook: text(get("facebook")),
    tiktok: text(get("tiktok")),
    booking_url: text(get("booking_url")),
    source: basename(file),
  };
}

/** Must match the generated column in the migration. */
const dedupeKey = (lead) =>
  [
    lead.company_name.trim().toLowerCase(),
    (lead.address_line1 ?? "").trim().toLowerCase(),
    (lead.postal_code ?? "").trim().toLowerCase(),
  ].join("|");

// --- run ------------------------------------------------------------------
async function flush(batch, stats) {
  if (batch.length === 0) return;

  if (dryRun) {
    stats.upserted += batch.length;
    return;
  }

  const { error } = await supabase
    .from("leads")
    .upsert(batch, { onConflict: "dedupe_key", ignoreDuplicates: false });

  if (error) {
    stats.failed += batch.length;
    console.error(`  ! batch failed: ${error.message}`);
    return;
  }

  stats.upserted += batch.length;
}

async function main() {
  const stats = { read: 0, skipped: 0, duplicates: 0, upserted: 0, failed: 0 };
  const seen = new Set();

  let columns = null;
  let batch = [];

  const parser = createReadStream(file).pipe(
    parse({ bom: true, skip_empty_lines: true, relax_column_count: true, trim: false }),
  );

  for await (const row of parser) {
    if (!columns) {
      columns = buildColumnMap(row);
      if (columns.company_name === undefined) {
        throw new Error(
          `Could not find a company name column. Headers seen: ${row.join(", ").slice(0, 300)}`,
        );
      }
      console.log(`Mapped ${Object.keys(columns).length} columns from ${basename(file)}`);
      continue;
    }

    stats.read += 1;
    const lead = toLead(row, columns);

    if (!lead) {
      stats.skipped += 1;
      continue;
    }

    // A duplicate inside one batch would break ON CONFLICT, so dedupe up front.
    const key = dedupeKey(lead);
    if (seen.has(key)) {
      stats.duplicates += 1;
      continue;
    }
    seen.add(key);

    batch.push(lead);

    if (batch.length >= batchSize) {
      await flush(batch, stats);
      batch = [];
      if (stats.upserted % (batchSize * 10) === 0) {
        console.log(`  … ${stats.upserted.toLocaleString()} rows`);
      }
    }
  }

  await flush(batch, stats);

  console.log(
    [
      "",
      dryRun ? "Dry run complete (nothing written)." : "Import complete.",
      `  rows read:        ${stats.read.toLocaleString()}`,
      `  upserted:         ${stats.upserted.toLocaleString()}`,
      `  in-file dupes:    ${stats.duplicates.toLocaleString()}`,
      `  skipped (no name):${stats.skipped.toLocaleString()}`,
      `  failed:           ${stats.failed.toLocaleString()}`,
    ].join("\n"),
  );

  if (stats.failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
