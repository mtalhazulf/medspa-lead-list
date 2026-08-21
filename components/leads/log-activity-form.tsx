"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";

import { logActivity, type ActionState } from "@/lib/actions/leads";
import { MANUAL_ACTIVITY_TYPES, LEAD_STATUSES } from "@/lib/pipeline";
import type { LeadStatus } from "@/lib/types/database";

const INITIAL: ActionState = { ok: true, message: "" };

function LogButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? "Saving…" : "Log it"}
    </button>
  );
}

export function LogActivityForm({
  leadId,
  currentStatus,
  contacts = [],
}: {
  leadId: string;
  currentStatus: LeadStatus;
  contacts?: { id: string; full_name: string; title: string | null; do_not_contact: boolean }[];
}) {
  const [state, formAction] = useActionState(logActivity, INITIAL);
  const formRef = useRef<HTMLFormElement>(null);

  // Clear the note once it is saved so the next touch starts from a blank slate.
  useEffect(() => {
    if (state.ok && state.message) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="mt-3 space-y-3">
      <input type="hidden" name="leadId" value={leadId} />

      <textarea
        name="body"
        rows={3}
        className="input resize-y"
        placeholder="Called the front desk — owner is in Tue/Thu, asked for pricing by email."
        required
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div>
          <label className="label mb-1" htmlFor="contactId">
            Person
          </label>
          <select id="contactId" name="contactId" className="input" defaultValue="">
            <option value="">Company / front desk</option>
            {contacts.map((person) => (
              <option key={person.id} value={person.id}>
                {person.full_name}
                {person.title ? ` · ${person.title}` : ""}
                {person.do_not_contact ? " (DNC)" : ""}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label mb-1" htmlFor="type">
            Type
          </label>
          <select id="type" name="type" className="input" defaultValue="call">
            {MANUAL_ACTIVITY_TYPES.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label mb-1" htmlFor="occurredAt">
            When
          </label>
          <input id="occurredAt" name="occurredAt" type="datetime-local" className="input" />
        </div>

        <div>
          <label className="label mb-1" htmlFor="activityStatus">
            Move to
          </label>
          <select id="activityStatus" name="status" className="input" defaultValue="">
            <option value="">Keep {statusLabel(currentStatus)}</option>
            {LEAD_STATUSES.filter((s) => s.value !== currentStatus).map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label mb-1" htmlFor="activityFollowUp">
            Next follow-up
          </label>
          <input id="activityFollowUp" name="nextFollowUpAt" type="date" className="input" />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <LogButton />
        {state.message && (
          <span className={`text-sm ${state.ok ? "text-emerald-700" : "text-rose-600"}`} role="status">
            {state.message}
          </span>
        )}
      </div>
    </form>
  );
}

function statusLabel(status: LeadStatus): string {
  return LEAD_STATUSES.find((s) => s.value === status)?.label ?? status;
}
