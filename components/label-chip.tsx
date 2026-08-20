import { labelColor } from "@/lib/leads/labels";

export function LabelChip({
  name,
  color,
  className = "",
}: {
  name: string;
  color?: string | null;
  className?: string;
}) {
  const meta = labelColor(color);
  return (
    <span className={`pill ${meta.pill} ${className}`.trim()}>{name}</span>
  );
}
