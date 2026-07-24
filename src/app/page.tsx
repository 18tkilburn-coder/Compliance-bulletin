import Link from "next/link";
import { MarketingHeader } from "@/components/marketing-header";
import { MarketingFooter } from "@/components/marketing-footer";
import { ImpactBadge } from "@/components/impact-badge";
import { TIER_DETAILS, SUBSCRIPTION_TIERS } from "@/lib/types";

const STEPS = [
  {
    title: "We monitor the sources",
    body: "CQC guidance pages, provider handbooks, Skills for Care publications and relevant DHSC/UKHSA notices, checked daily.",
  },
  {
    title: "We score and translate",
    body: "Every update is scored High, Medium or Low impact and rewritten in plain English — what changed, and why it matters to a registered manager.",
  },
  {
    title: "You get an action checklist",
    body: "Each bulletin entry names the regulated activities it touches and gives a short, concrete checklist to work through before your next inspection.",
  },
];

const TOPICS = [
  "Safeguarding",
  "Staffing",
  "Medicines management",
  "Infection control",
  "Governance & notifications",
  "Environment & premises",
  "Nutrition & hydration",
  "Mental capacity & consent",
  "Training & competency",
];

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <MarketingHeader />

      <main className="flex-1">
        {/* Hero */}
        <section className="border-b border-border bg-surface">
          <div className="mx-auto grid max-w-6xl gap-12 px-6 py-20 lg:grid-cols-2 lg:items-center">
            <div>
              <p className="mb-4 inline-block rounded-full border border-border bg-background px-3 py-1 text-xs font-semibold uppercase tracking-wide text-muted">
                For registered managers &amp; providers
              </p>
              <h1 className="text-4xl font-semibold leading-tight tracking-tight text-foreground sm:text-5xl">
                Know what&apos;s changed — and what to do about it.
              </h1>
              <p className="mt-5 text-lg leading-relaxed text-muted">
                Regulatory feeds tell you something changed. We tell you what it means for
                your service, how urgent it is, and the checklist to work through before
                your next inspection. Interpretation, not just aggregation.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-4">
                <Link
                  href="/signup"
                  className="rounded-md bg-primary px-6 py-3 text-sm font-semibold text-white hover:bg-primary-hover"
                >
                  Start your free trial
                </Link>
                <Link
                  href="#how-it-works"
                  className="rounded-md border border-border bg-surface px-6 py-3 text-sm font-semibold text-foreground hover:bg-background"
                >
                  See how it works
                </Link>
              </div>
              <p className="mt-4 text-sm text-muted">
                No credit card required. Set up your first bulletin in minutes.
              </p>
            </div>

            <div className="rounded-xl border border-border bg-background p-5 shadow-sm">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
                Sample bulletin entry
              </p>
              <div className="rounded-lg border border-border bg-surface p-5">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <ImpactBadge level="HIGH" />
                  <span className="text-xs text-muted">CQC · 2 days ago</span>
                </div>
                <h3 className="font-semibold text-foreground">
                  CQC tightens expectations on safeguarding notifications after
                  regulation 13 review
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  CQC now expects safeguarding referrals notified within one working day,
                  and inspectors will cross-check your referral log against your CQC
                  notifications at the next inspection.
                </p>
                <div className="mt-4 rounded-md bg-background p-3">
                  <p className="text-xs font-semibold text-foreground">
                    Do before your next inspection
                  </p>
                  <ul className="mt-2 space-y-1 text-xs text-muted">
                    <li>&#8226; Audit the last 3 months of safeguarding referrals</li>
                    <li>&#8226; Update your safeguarding policy&apos;s notification timescale</li>
                    <li>&#8226; Brief all staff at the next team meeting</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Value prop */}
        <section className="border-b border-border">
          <div className="mx-auto max-w-6xl px-6 py-16">
            <h2 className="text-2xl font-semibold text-foreground">
              Aggregation isn&apos;t the hard part.
            </h2>
            <p className="mt-2 max-w-2xl text-muted">
              Anyone can forward you a link to a regulatory guidance page. The job is working out
              what it actually requires of your service — and that takes reading time most
              registered managers don&apos;t have.
            </p>
            <div className="mt-8 grid gap-6 sm:grid-cols-2">
              <div className="rounded-lg border border-border bg-surface p-6">
                <p className="text-sm font-semibold text-muted">A raw feed gives you</p>
                <ul className="mt-3 space-y-2 text-sm text-foreground">
                  <li>A list of links to guidance pages</li>
                  <li>No sense of urgency or priority</li>
                  <li>No connection to your regulated activities</li>
                  <li>Nothing to hand to your team</li>
                </ul>
              </div>
              <div className="rounded-lg border border-accent/30 bg-surface p-6">
                <p className="text-sm font-semibold text-accent">Compliance Bulletin gives you</p>
                <ul className="mt-3 space-y-2 text-sm text-foreground">
                  <li>A plain-English summary of what changed</li>
                  <li>An impact score, so you know what to act on first</li>
                  <li>The regulated activities and topics it affects</li>
                  <li>A short action checklist you can hand to your team today</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="border-b border-border bg-surface">
          <div className="mx-auto max-w-6xl px-6 py-16">
            <h2 className="text-2xl font-semibold text-foreground">How it works</h2>
            <div className="mt-8 grid gap-8 sm:grid-cols-3">
              {STEPS.map((step, i) => (
                <div key={step.title}>
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-white">
                    {i + 1}
                  </span>
                  <h3 className="mt-4 font-semibold text-foreground">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{step.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Topics */}
        <section className="border-b border-border">
          <div className="mx-auto max-w-6xl px-6 py-16">
            <h2 className="text-2xl font-semibold text-foreground">
              Coverage across the areas inspectors focus on
            </h2>
            <div className="mt-6 flex flex-wrap gap-3">
              {TOPICS.map((topic) => (
                <span
                  key={topic}
                  className="rounded-full border border-border bg-surface px-4 py-2 text-sm text-foreground"
                >
                  {topic}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="bg-surface">
          <div className="mx-auto max-w-6xl px-6 py-16">
            <h2 className="text-2xl font-semibold text-foreground">
              Straightforward pricing for care providers
            </h2>
            <p className="mt-2 max-w-2xl text-muted">
              Choose the tier that matches how many locations you register with CQC.
              Change or cancel any time.
            </p>
            <div className="mt-8 grid gap-6 lg:grid-cols-3">
              {SUBSCRIPTION_TIERS.map((tier) => {
                const details = TIER_DETAILS[tier];
                return (
                  <div
                    key={tier}
                    className="flex flex-col rounded-xl border border-border bg-background p-6"
                  >
                    <h3 className="text-lg font-semibold text-foreground">{details.label}</h3>
                    <p className="mt-1 text-sm text-muted">{details.blurb}</p>
                    <p className="mt-4 text-2xl font-semibold text-foreground">{details.price}</p>
                    <ul className="mt-5 flex-1 space-y-2 text-sm text-foreground">
                      {details.features.map((feature) => (
                        <li key={feature} className="flex gap-2">
                          <span className="text-accent">&#10003;</span>
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                    <Link
                      href={`/signup?tier=${tier}`}
                      className="mt-6 rounded-md border border-primary px-4 py-2 text-center text-sm font-semibold text-primary hover:bg-primary hover:text-white"
                    >
                      Choose {details.label}
                    </Link>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="border-t border-border">
          <div className="mx-auto max-w-6xl px-6 py-16 text-center">
            <h2 className="text-2xl font-semibold text-foreground">
              Stay ahead of the next inspection, not behind it.
            </h2>
            <div className="mt-6">
              <Link
                href="/signup"
                className="rounded-md bg-primary px-6 py-3 text-sm font-semibold text-white hover:bg-primary-hover"
              >
                Start your free trial
              </Link>
            </div>
          </div>
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
}
