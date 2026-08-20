"use client";

import { useActionState, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";

import {
  createClientType,
  createTag,
  deleteClientType,
  deleteTag,
  updateClientType,
  updateTag,
  type CatalogState,
} from "@/lib/actions/catalog";
import { LabelChip } from "@/components/label-chip";
import { LABEL_COLORS } from "@/lib/leads/labels";
import type { CatalogClientType, CatalogTag } from "@/lib/leads/types";

const INITIAL: CatalogState = { ok: true, message: "" };

function AddButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? "Adding…" : label}
    </button>
  );
}

function SaveRowButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-secondary text-xs" disabled={pending}>
      {pending ? "…" : "Save"}
    </button>
  );
}

export function TagCatalog({ tags }: { tags: CatalogTag[] }) {
  const [state, action] = useActionState(createTag, INITIAL);

  return (
    <section className="card p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Tags</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            Shared labels you apply to leads, including in bulk. Rename here and every lead updates.
          </p>
        </div>
      </div>

      <form action={action} className="mt-4 flex flex-wrap items-end gap-2">
        <div className="min-w-[12rem] flex-1">
          <label className="label mb-1" htmlFor="tag-name">
            New tag
          </label>
          <input id="tag-name" name="name" className="input" placeholder="e.g. Hot, Chain, Referral" required />
        </div>
        <div>
          <label className="label mb-1" htmlFor="tag-color">
            Color
          </label>
          <select id="tag-color" name="color" className="input w-auto" defaultValue="slate">
            {LABEL_COLORS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <AddButton label="Add tag" />
      </form>
      {state.message && (
        <p className={`mt-2 text-sm ${state.ok ? "text-emerald-700" : "text-rose-700"}`}>{state.message}</p>
      )}

      <ul className="mt-4 divide-y divide-slate-100">
        {tags.map((tag) => (
          <CatalogRow
            key={tag.id}
            id={tag.id}
            name={tag.name}
            color={tag.color}
            kind="tag"
          />
        ))}
        {tags.length === 0 && (
          <li className="py-6 text-sm text-slate-500">No tags yet — add the labels your team actually uses.</li>
        )}
      </ul>
    </section>
  );
}

export function ClientTypeCatalog({ types }: { types: CatalogClientType[] }) {
  const [state, action] = useActionState(createClientType, INITIAL);

  return (
    <section className="card p-5">
      <div>
        <h2 className="text-sm font-semibold text-slate-900">Client types</h2>
        <p className="mt-0.5 text-sm text-slate-500">
          What kind of account this is — med spa, dermatology, wellness, or anything you add.
        </p>
      </div>

      <form action={action} className="mt-4 flex flex-col gap-2">
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-40 flex-1">
            <label className="label mb-1" htmlFor="type-name">
              New type
            </label>
            <input id="type-name" name="name" className="input" placeholder="e.g. Med spa" required />
          </div>
          <div>
            <label className="label mb-1" htmlFor="type-color">
              Color
            </label>
            <select id="type-color" name="color" className="input w-auto" defaultValue="emerald">
              {LABEL_COLORS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <AddButton label="Add type" />
        </div>
        <div>
          <label className="label mb-1" htmlFor="type-desc">
            Description
          </label>
          <input id="type-desc" name="description" className="input" placeholder="Optional" />
        </div>
      </form>
      {state.message && (
        <p className={`mt-2 text-sm ${state.ok ? "text-emerald-700" : "text-rose-700"}`}>{state.message}</p>
      )}

      <ul className="mt-4 divide-y divide-slate-100">
        {types.map((type) => (
          <CatalogRow
            key={type.id}
            id={type.id}
            name={type.name}
            color={type.color}
            description={type.description}
            kind="type"
          />
        ))}
        {types.length === 0 && (
          <li className="py-6 text-sm text-slate-500">No types yet — add every kind of client you sell to.</li>
        )}
      </ul>
    </section>
  );
}

function CatalogRow({
  id,
  name,
  color,
  description,
  kind,
}: {
  id: string;
  name: string;
  color: string;
  description?: string | null;
  kind: "tag" | "type";
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const updateAction = kind === "tag" ? updateTag : updateClientType;
  const [state, action] = useActionState(updateAction, INITIAL);

  function onDelete() {
    const noun = kind === "tag" ? "tag" : "client type";
    if (!confirm(`Delete “${name}”? It will be removed from every lead.`)) return;
    startTransition(async () => {
      const result = kind === "tag" ? await deleteTag(id) : await deleteClientType(id);
      if (!result.ok) alert(result.message);
      else router.refresh();
    });
  }

  if (!editing) {
    return (
      <li className="flex flex-wrap items-center gap-2 py-3">
        <LabelChip name={name} color={color} />
        {description && <span className="text-xs text-slate-500">{description}</span>}
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
        <input type="hidden" name="id" value={id} />
        <div className="min-w-[10rem] flex-1">
          <label className="label mb-1">Name</label>
          <input name="name" className="input" defaultValue={name} required />
        </div>
        <div>
          <label className="label mb-1">Color</label>
          <select name="color" className="input w-auto" defaultValue={color}>
            {LABEL_COLORS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        {kind === "type" && (
          <div className="min-w-[10rem] flex-1">
            <label className="label mb-1">Description</label>
            <input name="description" className="input" defaultValue={description ?? ""} />
          </div>
        )}
        <SaveRowButton />
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
