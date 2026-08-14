import type { ActivityType, LeadStatus } from "@/lib/types/database";

export interface StatusMeta {
  value: LeadStatus;
  label: string;
  /** Bucket used for grouping in the dashboard and for default filters. */
  group: "untouched" | "working" | "warm" | "closed_won" | "closed_lost";
  /** Tailwind classes for the status pill. */
  className: string;
}

export const LEAD_STATUSES: readonly StatusMeta[] = [
  {
    value: "new",
    label: "New",
    group: "untouched",
    className: "bg-slate-100 text-slate-700 ring-slate-200",
  },
  {
    value: "contacted",
    label: "Contacted",
    group: "working",
    className: "bg-sky-100 text-sky-800 ring-sky-200",
  },
  {
    value: "follow_up",
    label: "Follow up",
    group: "working",
    className: "bg-indigo-100 text-indigo-800 ring-indigo-200",
  },
  {
    value: "interested",
    label: "Interested",
    group: "warm",
    className: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  },
  {
    value: "meeting_booked",
    label: "Meeting booked",
    group: "warm",
    className: "bg-teal-100 text-teal-800 ring-teal-200",
  },
  {
    value: "proposal_sent",
    label: "Proposal sent",
    group: "warm",
    className: "bg-violet-100 text-violet-800 ring-violet-200",
  },
  {
    value: "won",
    label: "Won",
    group: "closed_won",
    className: "bg-green-600 text-white ring-green-700",
  },
  {
    value: "lost",
    label: "Lost",
    group: "closed_lost",
    className: "bg-rose-100 text-rose-800 ring-rose-200",
  },
  {
    value: "not_interested",
    label: "Not interested",
    group: "closed_lost",
    className: "bg-orange-100 text-orange-800 ring-orange-200",
  },
  {
    value: "unqualified",
    label: "Unqualified",
    group: "closed_lost",
    className: "bg-stone-100 text-stone-700 ring-stone-200",
  },
  {
    value: "do_not_contact",
    label: "Do not contact",
    group: "closed_lost",
    className: "bg-zinc-800 text-zinc-100 ring-zinc-900",
  },
] as const;

const STATUS_BY_VALUE = new Map<LeadStatus, StatusMeta>(LEAD_STATUSES.map((s) => [s.value, s]));

export function statusMeta(status: LeadStatus): StatusMeta {
  return (
    STATUS_BY_VALUE.get(status) ?? {
      value: status,
      label: status,
      group: "working",
      className: "bg-slate-100 text-slate-700 ring-slate-200",
    }
  );
}

export const OPEN_STATUSES: LeadStatus[] = LEAD_STATUSES.filter(
  (s) => s.group === "untouched" || s.group === "working" || s.group === "warm",
).map((s) => s.value);

export const WARM_STATUSES: LeadStatus[] = LEAD_STATUSES.filter((s) => s.group === "warm").map(
  (s) => s.value,
);

export const PRIORITY_LABELS: Record<number, string> = {
  0: "—",
  1: "Low",
  2: "Medium",
  3: "High",
};

export interface ActivityMeta {
  value: ActivityType;
  label: string;
  icon: string;
  /** Loggable by hand from the lead page; the rest are written by triggers. */
  manual: boolean;
}

export const ACTIVITY_TYPES: readonly ActivityMeta[] = [
  { value: "note", label: "Note", icon: "✎", manual: true },
  { value: "call", label: "Call", icon: "☎", manual: true },
  { value: "email", label: "Email", icon: "✉", manual: true },
  { value: "sms", label: "SMS", icon: "💬", manual: true },
  { value: "dm", label: "DM", icon: "◎", manual: true },
  { value: "meeting", label: "Meeting", icon: "◇", manual: true },
  { value: "status_change", label: "Status change", icon: "→", manual: false },
  { value: "assignment", label: "Assignment", icon: "◆", manual: false },
  { value: "import", label: "Import", icon: "↧", manual: false },
] as const;

export const MANUAL_ACTIVITY_TYPES = ACTIVITY_TYPES.filter((a) => a.manual);

export function activityMeta(type: ActivityType): ActivityMeta {
  return ACTIVITY_TYPES.find((a) => a.value === type) ?? ACTIVITY_TYPES[0]!;
}
