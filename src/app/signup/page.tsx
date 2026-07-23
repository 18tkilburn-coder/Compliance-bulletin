import { AuthShell } from "@/components/auth-shell";
import { SignupForm } from "@/components/signup-form";
import { SUBSCRIPTION_TIERS, type SubscriptionTier } from "@/lib/types";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ tier?: string }>;
}) {
  const { tier } = await searchParams;
  const defaultTier: SubscriptionTier = SUBSCRIPTION_TIERS.includes(tier as SubscriptionTier)
    ? (tier as SubscriptionTier)
    : "SOLO";

  return (
    <AuthShell
      title="Start your free trial"
      subtitle="Set up your bulletin in a couple of minutes — no credit card required."
    >
      <SignupForm defaultTier={defaultTier} />
    </AuthShell>
  );
}
