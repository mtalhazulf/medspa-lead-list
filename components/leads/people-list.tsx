"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";

import {
  deleteLeadContact,
  saveLeadContact,
  setPrimaryContact,
  type ActionState,
} from "@/lib/actions/contacts";
import { formatRelative, telHref } from "@/lib/format";
import type { LeadContact } from "@/lib/leads/types";

const INITIAL: ActionState = { ok: true, message: "" };

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? "Saving…" : label}
    </button>
  );
}

export function PeopleList({ leadId, contacts }: { leadId: string; contacts: LeadContact[] }) {
  const router = useRouter();
  const [state, action] = useActionState(saveLeadContact, INITIAL);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(contacts.length === 0);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<ActionState | null>(null);

  const editing = contacts.find((c) => c.id === editingId) ?? null;

  useEffect(() => {
    if (state.ok && state.message) {
      setAdding(false);
      setEditingId(null);
    }
  }, [state]);

  function run(fn: () => Promise<ActionState>) {
    startTransition(async () => {
      const result = await fn();
      setMessage(result);
      if (result.ok) router.refresh();
    });
  }

  return (
    <section className="card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">People</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            Reach more than one person at this company — owner, office manager, injector.
          </p>
        </div>
        {!adding && (
          <button type="button" className="btn-secondary h-9 px-2.5 text-sm" onClick={() => setAdding(true)}>
            Add person
          </button>
        )}
      </div>

      {contacts.length === 0 && !adding && (
        <p className="mt-4 text-sm text-slate-500">No people on file yet. Add someone to call besides the front desk.</p>
      )}

      {contacts.length > 0 && (
        <ul className="mt-4 divide-y divide-slate-100">
          {contacts.map((person) => (
            <li key={person.id} className="py-3 first:pt-0">
              {editingId === person.id ? null : (
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-slate-900">{person.full_name}</p>
                      {person.is_primary && (
                        <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[11px] font-medium text-white">
                          Primary
                        </span>
                      )}
                      {person.do_not_contact && (
                        <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-700">
                          Do not contact
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-sm text-slate-500">
                      {[person.title, person.email, person.phone].filter(Boolean).join(" · ") || "No details yet"}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-3 text-xs text-slate-500">
                      {person.phone && (
                        <a href={telHref(person.phone) ?? "#"} className="hover:underline">
                          Call
                        </a>
                      )}
                      {person.email && (
                        <a href={`mailto:${person.email}`} className="hover:underline">
                          Email
                        </a>
                      )}
                      {person.linkedin && (
                        <a
                          href={person.linkedin.startsWith("http") ? person.linkedin : `https://${person.linkedin}`}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="hover:underline"
                        >
                          LinkedIn
                        </a>
                      )}
                      {person.last_contacted_at && (
                        <span>touched {formatRelative(person.last_contacted_at)}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {!person.is_primary && (
                      <button
                        type="button"
                        className="btn-ghost text-xs"
                        disabled={isPending}
                        onClick={() => run(() => setPrimaryContact(leadId, person.id))}
                      >
                        Make primary
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn-ghost text-xs"
                      onClick={() => {
                        setAdding(false);
                        setEditingId(person.id);
                      }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn-ghost text-xs text-rose-600 hover:bg-rose-50"
                      disabled={isPending}
                      onClick={() => run(() => deleteLeadContact(leadId, person.id))}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {(adding || editing) && (
        <PersonForm
          key={editing?.id ?? "new"}
          leadId={leadId}
          person={editing}
          action={action}
          state={state}
          onCancel={() => {
            setAdding(false);
            setEditingId(null);
          }}
        />
      )}

      {(message?.message) && (
        <p className={`mt-3 text-sm ${message.ok ? "text-emerald-700" : "text-rose-700"}`}>{message.message}</p>
      )}
    </section>
  );
}

function PersonForm({
  leadId,
  person,
  action,
  state,
  onCancel,
}: {
  leadId: string;
  person: LeadContact | null;
  action: (formData: FormData) => void;
  state: ActionState;
  onCancel: () => void;
}) {
  return (
    <form action={action} className="mt-4 space-y-3 border-t border-slate-100 pt-4">
      <input type="hidden" name="leadId" value={leadId} />
      <input type="hidden" name="contactId" value={person?.id ?? ""} />

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label mb-1" htmlFor="fullName">
            Name
          </label>
          <input
            id="fullName"
            name="fullName"
            className="input"
            required
            defaultValue={person?.full_name ?? ""}
            placeholder="Alex Chen"
          />
        </div>
        <div>
          <label className="label mb-1" htmlFor="title">
            Title
          </label>
          <input
            id="title"
            name="title"
            className="input"
            defaultValue={person?.title ?? ""}
            placeholder="Owner, office manager…"
          />
        </div>
        <div>
          <label className="label mb-1" htmlFor="personEmail">
            Email
          </label>
          <input
            id="personEmail"
            name="email"
            type="email"
            className="input"
            defaultValue={person?.email ?? ""}
          />
        </div>
        <div>
          <label className="label mb-1" htmlFor="personPhone">
            Phone
          </label>
          <input id="personPhone" name="phone" className="input" defaultValue={person?.phone ?? ""} />
        </div>
        <div className="sm:col-span-2">
          <label className="label mb-1" htmlFor="linkedin">
            LinkedIn
          </label>
          <input
            id="linkedin"
            name="linkedin"
            className="input"
            defaultValue={person?.linkedin ?? ""}
            placeholder="https://linkedin.com/in/…"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="label mb-1" htmlFor="personNotes">
            Notes
          </label>
          <textarea
            id="personNotes"
            name="notes"
            rows={2}
            className="input resize-y"
            defaultValue={person?.notes ?? ""}
            placeholder="Best time to call, gatekeeper, referred by…"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-4 text-sm text-slate-700">
        <label className="inline-flex items-center gap-2">
          <input type="checkbox" name="isPrimary" defaultChecked={person?.is_primary ?? false} />
          Primary contact
        </label>
        <label className="inline-flex items-center gap-2">
          <input type="checkbox" name="doNotContact" defaultChecked={person?.do_not_contact ?? false} />
          Do not contact
        </label>
      </div>

      <div className="flex items-center gap-2">
        <SubmitButton label={person ? "Save person" : "Add person"} />
        <button type="button" className="btn-ghost text-sm" onClick={onCancel}>
          Cancel
        </button>
        {state.message && (
          <span className={`text-sm ${state.ok ? "text-emerald-700" : "text-rose-700"}`}>{state.message}</span>
        )}
      </div>
    </form>
  );
}
