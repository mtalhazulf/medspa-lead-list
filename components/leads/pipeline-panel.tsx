"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";

import { saveLeadDetails, type ActionState } from "@/lib/actions/leads";
import { LabelChip } from "@/components/label-chip";
import { formatDateTime, formatRelative } from "@/lib/format";
import { LEAD_SOURCES } from "@/lib/leads/labels";
import type { CatalogClientType, CatalogTag, LeadDetail, Teammate } from "@/lib/leads/types";
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

export function PipelinePanel({
  lead,
  teammates,
  clientTypes,
  tags,
}: {
  lead: LeadDetail;
  teammates: Teammate[];
  clientTypes: CatalogClientType[];
  tags: CatalogTag[];
}) {
  const [state, formAction] = useActionState(saveLeadDetails, INITIAL);
  const selectedTags = new Set(lead.tags);

  return (
    <form action={formAction} className="card sticky top-4 space-y-4 p-5">
      <input type="hidden" name="leadId" value={lead.id} />

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900">Pipeline</h2>
        <span className="text-xs text-slate-400">updated {formatRelative(lead.updated_at)}</span>
      </div>

      <div>
        <label className="label mb-1" htmlFor="clientTypeId">
          Client type
        </label>
        <select id="clientTypeId" name="clientTypeId" defaultValue={lead.client_type_id ?? ""} className="input">
          <option value="">Unset</option>
          {clientTypes.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
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
        <p className="mt-1 text-xs text-slate-400">Last contacted: {formatDateTime(lead.last_contacted_at)}</p>
      </div>

      <div>
        <label className="label mb-1" htmlFor="leadSource">
          Source
        </label>
        <select id="leadSource" name="leadSource" defaultValue={lead.lead_source ?? ""} className="input">
          <option value="">Unknown</option>
          {LEAD_SOURCES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      <fieldset>
        <legend className="label mb-2">Tags</legend>
        {tags.length === 0 ? (
          <p className="text-xs text-slate-500">
            No tags yet.{" "}
            <Link href="/settings" className="underline hover:text-slate-900">
              Configure them in Settings
            </Link>
            .
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <label key={tag.id} className="cursor-pointer">
                <input
                  type="checkbox"
                  name="tagIds"
                  value={tag.id}
                  defaultChecked={selectedTags.has(tag.name)}
                  className="peer sr-only"
                />
                <span className="block peer-checked:ring-2 peer-checked:ring-slate-900/40 peer-checked:ring-offset-1">
                  <LabelChip name={tag.name} color={tag.color} />
                </span>
              </label>
            ))}
          </div>
        )}
      </fieldset>

      <div className="grid gap-3">
        <div>
          <label className="label mb-1" htmlFor="contactName">
            Decision maker
          </label>
          <input
            id="contactName"
            name="contactName"
            className="input"
            defaultValue={lead.contact_name ?? ""}
            placeholder="Name"
          />
        </div>
        <div>
          <label className="label mb-1" htmlFor="contactTitle">
            Title
          </label>
          <input
            id="contactTitle"
            name="contactTitle"
            className="input"
            defaultValue={lead.contact_title ?? ""}
            placeholder="Owner, office manager…"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label mb-1" htmlFor="contactEmail">
              Their email
            </label>
            <input
              id="contactEmail"
              name="contactEmail"
              type="email"
              className="input"
              defaultValue={lead.contact_email ?? ""}
            />
          </div>
          <div>
            <label className="label mb-1" htmlFor="contactPhone">
              Their phone
            </label>
            <input
              id="contactPhone"
              name="contactPhone"
              className="input"
              defaultValue={lead.contact_phone ?? ""}
            />
          </div>
        </div>
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
