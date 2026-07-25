import { requireUser } from "@/lib/dal";
import { updateAccountAction, updateBillingStatusAction } from "@/app/dashboard/actions";
import { SUBSCRIPTION_TIERS, TIER_DETAILS, BILLING_STATUSES, BILLING_STATUS_LABELS } from "@/lib/types";

export default async function AccountPage() {
  const user = await requireUser();
  const subscription = user.subscription;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Account</h1>
        <p className="mt-1 text-sm text-muted">
          Manage your care home details, plan and billing status.
        </p>
      </div>

      <section className="rounded-xl border border-border bg-surface p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Signed in as</h2>
        <p className="mt-2 text-sm text-foreground">{user.name}</p>
        <p className="text-sm text-muted">{user.email}</p>
      </section>

      {subscription && (
        <>
          <section className="rounded-xl border border-border bg-surface p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
              Care home &amp; plan
            </h2>
            <form action={updateAccountAction} className="mt-4 space-y-4">
              <div>
                <label htmlFor="careHomeName" className="block text-sm font-medium text-foreground">
                  Care home / organisation name
                </label>
                <input
                  id="careHomeName"
                  name="careHomeName"
                  required
                  defaultValue={subscription.careHomeName}
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                />
              </div>

              <div>
                <label htmlFor="tier" className="block text-sm font-medium text-foreground">
                  Plan
                </label>
                <select
                  id="tier"
                  name="tier"
                  defaultValue={subscription.tier}
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                >
                  {SUBSCRIPTION_TIERS.map((tier) => (
                    <option key={tier} value={tier}>
                      {TIER_DETAILS[tier].label} — {TIER_DETAILS[tier].price}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-hover"
              >
                Save changes
              </button>
            </form>
          </section>

          <section className="rounded-xl border border-border bg-surface p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
              Billing status
            </h2>
            <p className="mt-2 text-sm text-foreground">
              Current status:{" "}
              <span className="font-semibold">{BILLING_STATUS_LABELS[subscription.billingStatus as keyof typeof BILLING_STATUS_LABELS]}</span>
            </p>
            <p className="mt-1 text-xs text-muted">
              Billing is mocked for this MVP — no payment provider is connected. Use the
              buttons below to simulate billing states for a demo.
            </p>
            <form action={updateBillingStatusAction} className="mt-4 flex flex-wrap gap-2">
              {BILLING_STATUSES.map((status) => (
                <button
                  key={status}
                  type="submit"
                  name="billingStatus"
                  value={status}
                  className={`rounded-md border px-3 py-1.5 text-xs font-medium ${
                    subscription.billingStatus === status
                      ? "border-primary bg-primary text-white"
                      : "border-border bg-background text-muted hover:text-foreground"
                  }`}
                >
                  {BILLING_STATUS_LABELS[status]}
                </button>
              ))}
            </form>
          </section>
        </>
      )}
    </div>
  );
}
