"use client";

import { useId, useState } from "react";

import { LABEL_COLORS, toLabelHex } from "@/lib/leads/labels";

export function ColorPicker({
  name,
  defaultValue,
  defaultHex,
}: {
  name: string;
  defaultValue?: string;
  defaultHex?: string;
}) {
  const pickerId = useId();
  const [value, setValue] = useState(toLabelHex(defaultValue ?? defaultHex ?? "slate"));

  return (
    <div>
      <input type="hidden" name={name} value={value} />
      <div className="flex flex-wrap items-center gap-1.5">
        {LABEL_COLORS.map((swatch) => {
          const selected = value === swatch.hex;
          return (
            <button
              key={swatch.hex}
              type="button"
              title={swatch.label}
              aria-label={swatch.label}
              aria-pressed={selected}
              onClick={() => setValue(swatch.hex)}
              className={`h-7 w-7 rounded-full border border-black/10 transition ${
                selected ? "ring-2 ring-slate-900 ring-offset-2" : "hover:scale-105"
              }`}
              style={{ backgroundColor: swatch.hex }}
            />
          );
        })}
        <label
          htmlFor={pickerId}
          title="Custom color"
          className="relative h-7 w-7 cursor-pointer overflow-hidden rounded-full border border-dashed border-slate-400"
          style={{ backgroundColor: value }}
        >
          <span className="sr-only">Custom color</span>
          <input
            id={pickerId}
            type="color"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            className="absolute inset-0 cursor-pointer opacity-0"
          />
        </label>
      </div>
    </div>
  );
}
