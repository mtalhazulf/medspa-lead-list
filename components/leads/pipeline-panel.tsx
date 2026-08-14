"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { saveLeadDetails, type ActionState } from "@/lib/actions/leads";
import { formatDateTime, formatRelative } from "@/lib/format";
import type { LeadDetail, Teammate } from "@/lib/leads/types";
import { LEAD_STATUSES, PRIORITY_LABELS } from "@/lib/pipeline";

const INITIAL: ActionState = { ok: true, message: "" };

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary w-full" disabled={pending}>
      {pending ? "Saving…" : "Save"}
    </button>
  );
}

export function PipelinePanel({ lead, teammates }: { lead: LeadDetail; teammates: Teammate[] }) {
  const [state, formAction] = useActionState(saveLeadDetails, INITIAL);

  return (
    <form action={formAction} className="card sticky top-20 space-y-4 p-5">
      <input type="hidden" name="leadId" value={lead.id} />

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900">Pipeline</h2>
        <span className="text-xs text-slate-400">
          updated {formatRelative(lead.updated_at)}
        </span>
      </div>

      <div>
        <label className="label mb-1" htmlFor="status">
          Status
        </label>
        <select id="status" name="status" defaultValue={lead.status} className="input">
          {LEAD_STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label mb-1" htmlFor="priority">
            Priority
          </label>
          <select id="priority" name="priority" defaultValue={lead.priority} className="input">
            {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label mb-1" htmlFor="dealValue">
            Deal value
          </label>
          <input
            id="dealValue"
            name="dealValue"
            type="number"
            min={0}
            step="100"
            defaultValue={lead.deal_value ?? ""}
            className="input"
            placeholder="0"
          />
        </div>
      </div>

      <div>
        <label className="label mb-1" htmlFor="ownerId">
          Owner
        </label>
        <select id="ownerId" name="ownerId" defaultValue={lead.owner_id ?? ""} className="input">
          <option value="">Unassigned</option>
          <option value="me">Me</option>
          {teammates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="label mb-1" htmlFor="nextFollowUpAt">
          Next follow-up
        </label>
        <input
          id="nextFollowUpAt"
          name="nextFollowUpAt"
          type="date"
          defaultValue={lead.next_follow_up_at ?? ""}
          className="input"
        />
        <p className="mt-1 text-xs text-slate-400">
          Last contacted: {formatDateTime(lead.last_contacted_at)}
        </p>
      </div>

      <div>
        <label className="label mb-1" htmlFor="tags">
          Tags
        </label>
        <input
          id="tags"
          name="tags"
          defaultValue={lead.tags.join(", ")}
          className="input"
          placeholder="botox, high-volume, referral"
        />
        <p className="mt-1 text-xs text-slate-400">Comma separated.</p>
      </div>

      <div>
        <label className="label mb-1" htmlFor="notes">
          Notes
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={6}
          defaultValue={lead.notes ?? ""}
          className="input resize-y"
          placeholder="Decision maker, current stack, objections…"
        />
      </div>

      {state.message && (
        <p
          className={`rounded-lg px-3 py-2 text-sm ${
            state.ok ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-700"
          }`}
          role="status"
        >
          {state.message}
        </p>
      )}

      <SaveButton />
    </form>
  );
}
