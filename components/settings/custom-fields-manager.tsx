"use client";

import { useActionState, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";

import {
  createCustomField,
  deleteCustomField,
  updateCustomField,
  type CatalogState,
} from "@/lib/actions/custom-fields";
import type { CatalogCustomField } from "@/lib/leads/types";

const INITIAL: CatalogState = { ok: true, message: "" };

const FIELD_TYPES = [
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
  { value: "url", label: "URL" },
  { value: "boolean", label: "Yes / No" },
] as const;

function AddButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? "Adding…" : "Add field"}
    </button>
  );
}

export function CustomFieldsManager({ fields }: { fields: CatalogCustomField[] }) {
  const [state, action] = useActionState(createCustomField, INITIAL);

  return (
    <section className="card p-5">
      <div>
        <h2 className="text-sm font-semibold text-slate-900">Custom fields</h2>
        <p className="mt-0.5 text-sm text-slate-500">
          Extra data on every client — shown on the profile and, if you choose, as a sortable
          column on the list. 24 field cap.
        </p>
      </div>

      <form action={action} className="mt-4 space-y-3">
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[12rem] flex-1">
            <label className="label mb-1" htmlFor="cf-name">
              Field name
            </label>
            <input id="cf-name" name="name" className="input" placeholder="e.g. Beds, EMR, Decision cycle" required />
          </div>
          <div>
            <label className="label mb-1" htmlFor="cf-type">
              Type
            </label>
            <select id="cf-type" name="fieldType" className="input w-auto" defaultValue="text">
              {FIELD_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <label className="flex h-9 items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" name="showInTable" defaultChecked className="rounded border-slate-300" />
            Show on list
          </label>
          <AddButton />
        </div>
      </form>
      {state.message && (
        <p className={`mt-2 text-sm ${state.ok ? "text-emerald-700" : "text-rose-700"}`}>{state.message}</p>
      )}

      <ul className="mt-4 divide-y divide-slate-100">
        {fields.map((field) => (
          <FieldRow key={field.id} field={field} />
        ))}
        {fields.length === 0 && (
          <li className="py-6 text-sm text-slate-500">
            No custom fields yet — add anything the spreadsheet didn’t already cover.
          </li>
        )}
      </ul>
    </section>
  );
}

function FieldRow({ field }: { field: CatalogCustomField }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [state, action] = useActionState(updateCustomField, INITIAL);

  function onDelete() {
    if (!confirm(`Delete “${field.name}”? Values already entered stay on each client until edited.`)) return;
    startTransition(async () => {
      const result = await deleteCustomField(field.id);
      if (!result.ok) alert(result.message);
      else router.refresh();
    });
  }

  if (!editing) {
    return (
      <li className="flex flex-wrap items-center gap-2 py-3">
        <span className="text-sm font-medium text-slate-900">{field.name}</span>
        <span className="text-xs text-slate-400">{typeLabel(field.field_type)}</span>
        {field.show_in_table && <span className="text-xs text-slate-500">List column</span>}
        <div className="ml-auto flex gap-1">
          <button type="button" className="btn-ghost text-xs" onClick={() => setEditing(true)}>
            Edit
          </button>
          <button
            type="button"
            className="btn-ghost text-xs text-rose-600 hover:bg-rose-50"
            onClick={onDelete}
            disabled={isPending}
          >
            Delete
          </button>
        </div>
      </li>
    );
  }

  return (
    <li className="py-3">
      <form action={action} className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="id" value={field.id} />
        <div className="min-w-[10rem] flex-1">
          <label className="label mb-1">Name</label>
          <input name="name" className="input" defaultValue={field.name} required />
        </div>
        <div>
          <label className="label mb-1">Type</label>
          <select name="fieldType" className="input w-auto" defaultValue={field.field_type}>
            {FIELD_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <label className="flex h-9 items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            name="showInTable"
            defaultChecked={field.show_in_table}
            className="rounded border-slate-300"
          />
          Show on list
        </label>
        <button type="submit" className="btn-secondary text-xs">
          Save
        </button>
        <button type="button" className="btn-ghost text-xs" onClick={() => setEditing(false)}>
          Cancel
        </button>
      </form>
      {state.message && (
        <p className={`mt-1 text-xs ${state.ok ? "text-emerald-700" : "text-rose-700"}`}>{state.message}</p>
      )}
    </li>
  );
}

function typeLabel(type: string) {
  return FIELD_TYPES.find((t) => t.value === type)?.label ?? type;
}
