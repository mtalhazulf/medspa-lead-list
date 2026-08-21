"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { saveLeadCustomData, type ActionState } from "@/lib/actions/leads";
import type { CatalogCustomField } from "@/lib/leads/types";
import type { CustomData } from "@/lib/types/database";

const INITIAL: ActionState = { ok: true, message: "" };

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? "Saving…" : "Save custom data"}
    </button>
  );
}

export function CustomDataForm({
  leadId,
  fields,
  values,
}: {
  leadId: string;
  fields: CatalogCustomField[];
  values: CustomData;
}) {
  const [state, action] = useActionState(saveLeadCustomData, INITIAL);

  if (fields.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        No custom fields yet. Add them under Settings → Custom data.
      </p>
    );
  }

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="leadId" value={leadId} />
      <div className="grid gap-3 sm:grid-cols-2">
        {fields.map((field) => (
          <FieldInput key={field.id} field={field} value={values[field.slug]} />
        ))}
      </div>
      {state.message && (
        <p className={`text-sm ${state.ok ? "text-emerald-700" : "text-rose-700"}`}>{state.message}</p>
      )}
      <SaveButton />
    </form>
  );
}

function FieldInput({
  field,
  value,
}: {
  field: CatalogCustomField;
  value: string | number | boolean | null | undefined;
}) {
  const name = `cf_${field.slug}`;
  const str = value === null || value === undefined ? "" : String(value);

  if (field.field_type === "boolean") {
    const selected = value === true ? "true" : value === false ? "false" : "";
    return (
      <div>
        <label className="label mb-1" htmlFor={name}>
          {field.name}
        </label>
        <select id={name} name={name} className="input" defaultValue={selected}>
          <option value="">—</option>
          <option value="true">Yes</option>
          <option value="false">No</option>
        </select>
      </div>
    );
  }

  const inputType =
    field.field_type === "number" ? "number" : field.field_type === "date" ? "date" : field.field_type === "url" ? "url" : "text";

  return (
    <div>
      <label className="label mb-1" htmlFor={name}>
        {field.name}
      </label>
      <input id={name} name={name} type={inputType} className="input" defaultValue={str} />
    </div>
  );
}
