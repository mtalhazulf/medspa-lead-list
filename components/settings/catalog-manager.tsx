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
import { ColorPicker } from "@/components/settings/color-picker";
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

      <form action={action} className="mt-4 space-y-3">
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[12rem] flex-1">
            <label className="label mb-1" htmlFor="tag-name">
              New tag
            </label>
            <input id="tag-name" name="name" className="input" placeholder="e.g. Hot, Chain, Referral" required />
          </div>
          <AddButton label="Add tag" />
        </div>
        <div>
          <span className="label mb-1">Color</span>
          <ColorPicker name="color" defaultValue="slate" />
        </div>
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

      <form action={action} className="mt-4 space-y-3">
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-40 flex-1">
            <label className="label mb-1" htmlFor="type-name">
              New type
            </label>
            <input id="type-name" name="name" className="input" placeholder="e.g. Med spa" required />
          </div>
          <AddButton label="Add type" />
        </div>
        <div>
          <span className="label mb-1">Color</span>
          <ColorPicker name="color" defaultValue="emerald" />
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
      <form action={action} className="space-y-3">
        <input type="hidden" name="id" value={id} />
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[10rem] flex-1">
            <label className="label mb-1">Name</label>
            <input name="name" className="input" defaultValue={name} required />
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
        </div>
        <div>
          <span className="label mb-1">Color</span>
          <ColorPicker name="color" defaultValue={color} />
        </div>
      </form>
      {state.message && (
        <p className={`mt-1 text-xs ${state.ok ? "text-emerald-700" : "text-rose-700"}`}>{state.message}</p>
      )}
    </li>
  );
}
