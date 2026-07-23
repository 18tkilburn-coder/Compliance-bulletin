"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/dal";
import { prisma } from "@/lib/db";
import { SUBSCRIPTION_TIERS, BILLING_STATUSES, type SubscriptionTier, type BillingStatus } from "@/lib/types";

export async function updateAccountAction(formData: FormData): Promise<void> {
  const user = await requireUser();

  const careHomeName = String(formData.get("careHomeName") ?? "").trim();
  const tierRaw = String(formData.get("tier") ?? "");
  const tier: SubscriptionTier = SUBSCRIPTION_TIERS.includes(tierRaw as SubscriptionTier)
    ? (tierRaw as SubscriptionTier)
    : "SOLO";

  if (!careHomeName) throw new Error("Care home name is required.");

  await prisma.subscription.update({
    where: { userId: user.id },
    data: { careHomeName, tier },
  });

  revalidatePath("/dashboard/account");
}

export async function updateBillingStatusAction(formData: FormData): Promise<void> {
  const user = await requireUser();

  const statusRaw = String(formData.get("billingStatus") ?? "");
  const billingStatus: BillingStatus = BILLING_STATUSES.includes(statusRaw as BillingStatus)
    ? (statusRaw as BillingStatus)
    : "ACTIVE";

  await prisma.subscription.update({
    where: { userId: user.id },
    data: { billingStatus },
  });

  revalidatePath("/dashboard/account");
}
