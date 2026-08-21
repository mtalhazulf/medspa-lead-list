import { labelChipStyle } from "@/lib/leads/labels";

export function LabelChip({
  name,
  color,
  className = "",
}: {
  name: string;
  color?: string | null;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${className}`.trim()}
      style={labelChipStyle(color)}
    >
      {name}
    </span>
  );
}
