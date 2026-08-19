/**
 * Presenter-only configuration view (L158-166).
 *
 * A static screen — L166 explicitly forbids a live editor. Every section is
 * rendered from the same config modules the agent consumes, so what the client
 * sees here is provably the live configuration rather than a mock-up of one.
 */

import Link from "next/link";
import { asset, escalationTiers, referenceFormats, teams } from "@/config/asset";
import { seededCases } from "@/config/cases";
import { recommendationCategoryLabels, recommendations } from "@/config/knowledge";
import { categoryLabels, services, type ServiceCategory } from "@/config/services";
import { spaces } from "@/config/spaces";

const label = "font-mono text-[0.62rem] uppercase tracking-[0.13em] text-[var(--faint)]";
const panel = "rounded-[3px] border border-[var(--hairline)] bg-[var(--surface)] overflow-hidden";

function Section({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-10">
      <div className="mb-3 border-b border-[var(--rule)] pb-2">
        <h2 className="font-display text-[1.3rem] font-semibold">{title}</h2>
        {note && <p className="mt-0.5 text-[0.82rem] text-[var(--muted)]">{note}</p>}
      </div>
      {children}
    </section>
  );
}

function Table({
  head,
  rows,
}: {
  head: string[];
  rows: (React.ReactNode[])[];
}) {
  return (
    <div className={`${panel} scroll-thin overflow-x-auto`}>
      <table className="w-full min-w-[36rem] border-collapse text-[0.84rem]">
        <thead>
          <tr className="bg-[var(--sunk)]">
            {head.map((h) => (
              <th
                key={h}
                className={`${label} whitespace-nowrap border-b border-[var(--hairline)] px-3.5 py-2 text-left font-medium`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-[var(--hairline)] last:border-0">
              {row.map((cell, j) => (
                <td key={j} className="px-3.5 py-2 align-top">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const schemaExample = (id: string) => {
  const s = services.find((x) => x.service_id === id);
  if (!s) return "";
  return JSON.stringify(
    {
      service_id: s.service_id,
      service_name: s.service_name,
      asset: s.asset,
      required_fields: s.required_fields,
      routing_team: s.routing_team,
      reference_format: s.reference_format,
    },
    null,
    2,
  );
};

export default function ConfigurationView() {
  return (
    <div className="min-h-dvh bg-[var(--ground)] px-5 py-10 sm:px-8">
      <div className="mx-auto max-w-[58rem]">
        <header className="mb-10 border-b border-[var(--rule)] pb-6">
          <p className="font-mono text-[0.64rem] uppercase tracking-[0.14em] text-[var(--brass)]">
            Presenter view · static
          </p>
          <h1 className="mt-2 font-display text-[2.2rem] font-semibold leading-tight">
            Configuration
          </h1>
          <p className="mt-2 max-w-[52ch] text-[0.94rem] leading-relaxed text-[var(--muted)]">
            Everything below drives the agent directly — the same modules the
            conversation reads at runtime. Configuring another asset means
            replacing these values, not rebuilding.
          </p>
          <Link
            href="/"
            className="mt-4 inline-block font-mono text-[0.64rem] uppercase tracking-[0.12em] text-[var(--brass)] hover:underline"
          >
            ← Back to Charli
          </Link>
        </header>

        <Section title="Asset and operating model">
          <div className={`${panel} divide-y divide-[var(--hairline)]`}>
            {[
              ["Asset", asset.name],
              ["Location", asset.city],
              ["Operating model", asset.operatingModel],
              ["Agent", asset.agentName],
              ["Interface state", asset.modeLabel],
              ["Footer", asset.footer],
            ].map(([k, v]) => (
              <div key={k} className="flex gap-4 px-3.5 py-2">
                <span className={`${label} w-36 shrink-0 pt-0.5`}>{k}</span>
                <span className="text-[0.88rem]">{v}</span>
              </div>
            ))}
          </div>
        </Section>

        <Section
          title="Enabled services"
          note="One generic service-request handler serves every non-booking request. Services marked display-only appear as interface chips and create no request."
        >
          {(Object.keys(categoryLabels) as ServiceCategory[]).map((cat) => (
            <div key={cat} className="mb-4">
              <h3 className={`${label} mb-1.5`}>{categoryLabels[cat]}</h3>
              <Table
                head={["Service", "Required fields", "Routing team", "Reference", "State"]}
                rows={services
                  .filter((s) => s.meta.category === cat)
                  .map((s) => [
                    <span key="n" className="font-medium">
                      {s.service_name}
                    </span>,
                    <span key="f" className="font-mono text-[0.74rem] text-[var(--muted)]">
                      {s.required_fields.join(", ") || "—"}
                    </span>,
                    s.routing_team,
                    <span key="r" className="font-mono text-[0.76rem] text-[var(--brass)]">
                      {s.reference_format}
                    </span>,
                    s.meta.active ? (
                      <span key="s" className="font-mono text-[0.7rem] text-[var(--ok)]">
                        Active
                      </span>
                    ) : (
                      <span key="s" className="font-mono text-[0.7rem] text-[var(--faint)]">
                        Display only
                      </span>
                    ),
                  ])}
              />
            </div>
          ))}

          <div className="mt-5">
            <h3 className={`${label} mb-1.5`}>Generic service schema</h3>
            <pre className={`${panel} scroll-thin overflow-x-auto px-4 py-3 font-mono text-[0.76rem] leading-relaxed text-[var(--ink)]`}>
              {schemaExample("taxi")}
            </pre>
          </div>
        </Section>

        <Section
          title="Room catalogue and booking rules"
          note="Capacity, equipment, rules and demo availability. The availability engine filters against these values at request time."
        >
          <Table
            head={["Space", "Capacity", "Equipment", "Booking rule", "Demo availability"]}
            rows={spaces.map((s) => [
              <span key="n" className="font-medium">
                {s.name}
              </span>,
              <span key="c" className="font-mono tabular">
                {s.capacity}
              </span>,
              s.equipment.join(", ") || "—",
              s.bookingRule,
              <span key="a" className="text-[var(--muted)]">
                {s.availabilityLabel}
              </span>,
            ])}
          />
        </Section>

        <Section
          title="Escalation teams and priority rules"
          note="Safety copy is fixed configuration, substituted at run time rather than generated."
        >
          <div className="mb-4">
            <h3 className={`${label} mb-1.5`}>Simulated support teams</h3>
            <div className="flex flex-wrap gap-1.5">
              {teams.map((t) => (
                <span
                  key={t}
                  className="rounded-full border border-[var(--rule)] px-3 py-1 text-[0.8rem] text-[var(--muted)]"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
          <Table
            head={["Tier", "Urgency", "Destination", "Priority rule", "Copy"]}
            rows={Object.entries(escalationTiers).map(([key, tier]) => [
              <span key="k" className="font-mono text-[0.76rem]">
                {key}
              </span>,
              <span
                key="u"
                className="font-mono text-[0.72rem] uppercase tracking-[0.08em]"
                style={{
                  color: tier.urgency === "Critical" ? "var(--crit)" : tier.urgency === "High" ? "var(--warn)" : "var(--muted)",
                }}
              >
                {tier.urgency}
              </span>,
              tier.team,
              <span key="p" className="text-[var(--muted)]">
                {tier.priorityRule}
              </span>,
              <span key="c" className="text-[0.8rem] italic text-[var(--ink)]">
                &ldquo;{tier.template}&rdquo;
              </span>,
            ])}
          />
        </Section>

        <Section title="Reference formats">
          <Table
            head={["Action", "Format", "Example"]}
            rows={Object.values(referenceFormats).map((r) => [
              r.label,
              <span key="f" className="font-mono text-[0.78rem]">
                {r.format}
              </span>,
              <span key="e" className="font-mono text-[0.78rem] text-[var(--brass)]">
                {r.example}
              </span>,
            ])}
          />
        </Section>

        <Section
          title="Local recommendation set"
          note="Capped at three options per category."
        >
          {(Object.keys(recommendations) as (keyof typeof recommendations)[]).map((cat) => (
            <div key={cat} className="mb-4">
              <h3 className={`${label} mb-1.5`}>{recommendationCategoryLabels[cat]}</h3>
              <Table
                head={["Venue", "Description", "Distance", "Best for"]}
                rows={recommendations[cat].map((r) => [
                  <span key="n" className="font-medium">
                    {r.name}
                  </span>,
                  <span key="d" className="text-[var(--muted)]">
                    {r.descriptor}
                  </span>,
                  <span key="w" className="whitespace-nowrap font-mono text-[0.74rem]">
                    {r.walk}
                  </span>,
                  <span key="b" className="text-[var(--muted)]">
                    {r.bestFor}
                  </span>,
                ])}
              />
            </div>
          ))}
        </Section>

        <Section
          title="Pre-seeded request history"
          note="Exists before the demo starts, so a status follow-up is answerable from a cold session."
        >
          <Table
            head={["Reference", "Request", "Status", "Owner", "Raised"]}
            rows={seededCases.map((c) => [
              <span key="r" className="font-mono text-[0.78rem] text-[var(--brass)]">
                {c.reference}
              </span>,
              c.service,
              <span key="s" className="text-[var(--muted)]">
                {c.status}
              </span>,
              c.team,
              <span key="d" className="whitespace-nowrap text-[var(--muted)]">
                {c.raised}
              </span>,
            ])}
          />
        </Section>

        <footer className="mt-12 border-t border-[var(--rule)] pt-4">
          <p className="font-mono text-[0.62rem] uppercase tracking-[0.1em] text-[var(--faint)]">
            {asset.footer}
          </p>
        </footer>
      </div>
    </div>
  );
}
