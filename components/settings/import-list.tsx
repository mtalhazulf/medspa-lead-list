"use client";

import { useRef, useState } from "react";

import { importLeadBatch } from "@/lib/actions/import";
import {
  IMPORT_BATCH_SIZE,
  IMPORT_MAX_BYTES,
  parseLeadCsv,
  type ScrapedLead,
} from "@/lib/leads/csv";
import { parseLeadXlsx } from "@/lib/leads/xlsx";
import { formatNumber } from "@/lib/format";

type ReadyFile = {
  name: string;
  size: number;
  leads: ScrapedLead[];
  skipped: number;
  duplicates: number;
  mapped: string[];
};

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function fileKind(file: File): "csv" | "xlsx" | null {
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv") || file.type === "text/csv" || file.type === "application/csv") return "csv";
  if (name.endsWith(".xlsx") || file.type === XLSX_MIME) return "xlsx";
  return null;
}

export function ImportList() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState<ReadyFile | null>(null);
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [result, setResult] = useState<string | null>(null);

  async function loadFile(file: File) {
    setError(null);
    setResult(null);
    setProgress(null);
    setReady(null);
    setReading(true);

    try {
      const kind = fileKind(file);
      if (!kind) {
        setError("Use a .csv or .xlsx file.");
        return;
      }
      if (file.size > IMPORT_MAX_BYTES) {
        setError("That file is larger than 40 MB. Split it, or use the CLI importer for very large lists.");
        return;
      }

      const parsed =
        kind === "csv"
          ? parseLeadCsv(await file.text(), file.name)
          : await parseLeadXlsx(await file.arrayBuffer(), file.name);
      if (!parsed.ok) {
        setError(parsed.message);
        return;
      }
      if (parsed.leads.length === 0) {
        setError("No client rows found after reading the header.");
        return;
      }

      setReady({
        name: file.name,
        size: file.size,
        leads: parsed.leads,
        skipped: parsed.skipped,
        duplicates: parsed.duplicates,
        mapped: parsed.mapped,
      });
    } finally {
      setReading(false);
    }
  }

  async function runImport() {
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    setResult(null);

    let upserted = 0;
    const total = ready.leads.length;

    for (let i = 0; i < total; i += IMPORT_BATCH_SIZE) {
      const batch = ready.leads.slice(i, i + IMPORT_BATCH_SIZE);
      const finalize = i + IMPORT_BATCH_SIZE >= total;
      const outcome = await importLeadBatch(batch, { finalize });
      if (!outcome.ok) {
        setError(outcome.message);
        setBusy(false);
        setProgress({ done: upserted, total });
        return;
      }
      upserted += outcome.upserted;
      setProgress({ done: upserted, total });
    }

    setBusy(false);
    setResult(
      `Imported ${formatNumber(upserted)} clients from ${ready.name}. Re-running the same file updates scraped fields and leaves status, owner, notes, and follow-ups alone.`,
    );
  }

  return (
    <section className="card max-w-2xl p-6">
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void loadFile(file);
          event.target.value = "";
        }}
      />

      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragOver(false);
          const file = event.dataTransfer.files[0];
          if (file) void loadFile(file);
        }}
        className={`rounded-xl border border-dashed px-5 py-10 text-center transition ${
          dragOver ? "border-slate-900 bg-slate-50" : "border-slate-300 bg-slate-50/60"
        }`}
      >
        <p className="text-sm font-medium text-slate-900">Drop the client list here</p>
        <p className="mt-1 text-sm text-slate-500">
          CSV or Excel (.xlsx) with a Company Name column. Same file can be imported again.
        </p>
        <button
          type="button"
          className="btn-secondary mt-4"
          onClick={() => inputRef.current?.click()}
          disabled={busy || reading}
        >
          {reading ? "Reading file…" : "Choose file"}
        </button>
      </div>

      {error && (
        <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">
          {error}
        </p>
      )}

      {ready && (
        <div className="mt-5 space-y-3">
          <div className="rounded-lg border border-slate-200 px-4 py-3">
            <p className="text-sm font-medium text-slate-900">{ready.name}</p>
            <p className="mt-1 text-sm text-slate-500">
              {formatNumber(ready.leads.length)} clients ready
              {ready.duplicates > 0 ? ` · ${formatNumber(ready.duplicates)} in-file duplicates skipped` : ""}
              {ready.skipped > 0 ? ` · ${formatNumber(ready.skipped)} rows without a name` : ""}
            </p>
            <p className="mt-2 text-xs text-slate-400">Mapped: {ready.mapped.join(", ")}</p>
          </div>

          <p className="text-sm leading-6 text-slate-500">
            Rows upsert on company + street + ZIP. Pipeline fields (status, owner, notes, tags,
            follow-ups) are never overwritten.
          </p>

          <button type="button" className="btn-primary" onClick={() => void runImport()} disabled={busy}>
            {busy
              ? `Importing ${formatNumber(progress?.done ?? 0)} of ${formatNumber(ready.leads.length)}…`
              : `Import ${formatNumber(ready.leads.length)} clients`}
          </button>

          {progress && !busy && error && (
            <p className="text-sm text-slate-500">
              Stopped after {formatNumber(progress.done)} of {formatNumber(progress.total)}.
            </p>
          )}
        </div>
      )}

      {result && (
        <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800" role="status">
          {result}
        </p>
      )}
    </section>
  );
}
