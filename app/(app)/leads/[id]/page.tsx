import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ActivityTimeline } from "@/components/leads/activity-timeline";
import { CustomDataForm } from "@/components/leads/custom-data-form";
import { LeadTabs } from "@/components/leads/lead-tabs";
import { LogActivityForm } from "@/components/leads/log-activity-form";
import { PeopleList } from "@/components/leads/people-list";
import { PipelinePanel } from "@/components/leads/pipeline-panel";
import { LabelChip } from "@/components/label-chip";
import { listTeammates } from "@/lib/dal/auth";
import { getLead, listCustomFields, listClientTypes, listLeadActivities, listTags } from "@/lib/dal/leads";
import { formatDate, formatNumber, instagramHandle, instagramHref, prettyDomain, telHref, toHref } from "@/lib/format";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const lead = await getLead(id);
  return { title: lead?.company_name ?? "Lead" };
}

export default async function LeadPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  const { id } = await params;
  const tabParam = (await searchParams).tab;
  const tab = (Array.isArray(tabParam) ? tabParam[0] : tabParam) === "history" ? "history" : "profile";

  const lead = await getLead(id);
  if (!lead) notFound();

  const [activities, teammates, clientTypes, tags, customFields] = await Promise.all([
    listLeadActivities(id),
    listTeammates(),
    listClientTypes(),
    listTags(),
    listCustomFields(),
  ]);

  const address = [
    [lead.address_line1, lead.address_line2].filter(Boolean).join(" "),
    [lead.city, lead.state].filter(Boolean).join(", "),
    lead.postal_code,
  ]
    .filter(Boolean)
    .join(" · ");

  const website = toHref(lead.website);
  const tel = telHref(lead.phone);
  const insta = instagramHref(lead.instagram);
  const mapsHref =
    lead.google_url ??
    (lead.latitude !== null && lead.longitude !== null
      ? `https://www.google.com/maps/search/?api=1&query=${lead.latitude},${lead.longitude}`
      : null);

  return (
    <div className="space-y-4">
      <Link href="/leads" className="text-sm text-slate-500 hover:text-slate-900">
        ← Back to leads
      </Link>

      <LeadTabs leadId={lead.id} current={tab} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {tab === "history" ? (
            <>
              <section className="card p-5">
                <h2 className="text-sm font-semibold text-slate-900">Log activity</h2>
                <LogActivityForm leadId={lead.id} currentStatus={lead.status} contacts={lead.contacts} />
              </section>
              <section className="card p-5">
                <h2 className="text-sm font-semibold text-slate-900">Who did what</h2>
                <p className="mt-0.5 text-sm text-slate-500">Every touch, status change, and assignment on this client.</p>
                <ActivityTimeline items={activities} />
              </section>
            </>
          ) : (
            <>
          <section className="card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="text-xl font-semibold tracking-tight text-slate-900">
                  {lead.company_name}
                </h1>
                <p className="mt-1 text-sm text-slate-500">{address || "No address on file"}</p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {lead.client_type && (
                    <LabelChip name={lead.client_type.name} color={lead.client_type.color} />
                  )}
                  {lead.tags.map((tag) => (
                    <LabelChip key={tag} name={tag} />
                  ))}
                </div>
              </div>
              {lead.google_rating !== null && (
                <div className="text-right">
                  <p className="text-lg font-semibold tabular-nums text-slate-900">
                    {lead.google_rating}
                    <span className="text-amber-500">★</span>
                  </p>
                  <p className="text-xs text-slate-500">
                    {formatNumber(lead.google_reviews)} reviews
                    {lead.num_locations && lead.num_locations > 1
                      ? ` · ${lead.num_locations} locations`
                      : ""}
                  </p>
                </div>
              )}
            </div>

            <dl className="mt-5 grid gap-4 sm:grid-cols-2">
              <Field label="Front desk phone">
                {tel ? (
                  <a href={tel} className="hover:underline">
                    {lead.phone}
                  </a>
                ) : (
                  <Empty />
                )}
              </Field>

              <Field label="Email">
                {lead.email ? (
                  <a href={`mailto:${lead.email}`} className="break-all hover:underline">
                    {lead.email}
                  </a>
                ) : (
                  <Empty />
                )}
              </Field>

              <Field label="Website">
                {website ? (
                  <a href={website} target="_blank" rel="noreferrer noopener" className="hover:underline">
                    {prettyDomain(lead.website)}
                  </a>
                ) : (
                  <Empty />
                )}
              </Field>

              <Field label="Online booking">
                {lead.booking_url ? (
                  <a
                    href={lead.booking_url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="hover:underline"
                  >
                    {prettyDomain(lead.booking_url)}
                  </a>
                ) : (
                  <Empty />
                )}
              </Field>

              <Field label="Social">
                <span className="flex flex-wrap gap-3">
                  {insta && (
                    <a href={insta} target="_blank" rel="noreferrer noopener" className="hover:underline">
                      {instagramHandle(lead.instagram)}
                    </a>
                  )}
                  {lead.facebook && (
                    <a
                      href={toHref(lead.facebook) ?? "#"}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="hover:underline"
                    >
                      Facebook
                    </a>
                  )}
                  {lead.tiktok && <span className="text-slate-600">{lead.tiktok}</span>}
                  {!insta && !lead.facebook && !lead.tiktok && <Empty />}
                </span>
              </Field>

              <Field label="Google">
                {mapsHref ? (
                  <a href={mapsHref} target="_blank" rel="noreferrer noopener" className="hover:underline">
                    Open in Maps
                  </a>
                ) : (
                  <Empty />
                )}
              </Field>
              <Field label="Lead source">{lead.lead_source || <Empty />}</Field>
            </dl>

            {lead.categories.length > 0 && (
              <div className="mt-5 border-t border-slate-100 pt-4">
                <p className="label mb-2">Categories</p>
                <div className="flex flex-wrap gap-1.5">
                  {lead.categories.map((category) => (
                    <Link
                      key={category}
                      href={`/leads?category=${encodeURIComponent(category)}`}
                      className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-200"
                    >
                      {category}
                    </Link>
                  ))}
                </div>
              </div>
            )}

            <p className="mt-5 border-t border-slate-100 pt-3 text-xs text-slate-400">
              Added {formatDate(lead.created_at)} · source {lead.source}
            </p>
          </section>

          <PeopleList leadId={lead.id} contacts={lead.contacts} />

          <section className="card p-5">
            <h2 className="text-sm font-semibold text-slate-900">Custom data</h2>
            <p className="mt-0.5 text-sm text-slate-500">Fields configured in Settings for this desk.</p>
            <div className="mt-4">
              <CustomDataForm leadId={lead.id} fields={customFields} values={lead.custom_data ?? {}} />
            </div>
          </section>
            </>
          )}
        </div>

        <div className="lg:col-span-1">
          <PipelinePanel
            lead={lead}
            teammates={teammates}
            clientTypes={clientTypes}
            tags={tags}
          />
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="label">{label}</dt>
      <dd className="mt-1 text-sm text-slate-700">{children}</dd>
    </div>
  );
}

function Empty() {
  return <span className="text-slate-400">—</span>;
}
