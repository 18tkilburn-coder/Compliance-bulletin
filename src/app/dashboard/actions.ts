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

function revalidateEntryViews(entryId: string): void {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/favourites");
  revalidatePath(`/dashboard/${entryId}`);
}

export async function toggleFavouriteAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const entryId = String(formData.get("entryId") ?? "");
  if (!entryId) throw new Error("Missing entry id.");

  const existing = await prisma.favouriteEntry.findUnique({
    where: { userId_entryId: { userId: user.id, entryId } },
  });

  if (existing) {
    await prisma.favouriteEntry.delete({ where: { id: existing.id } });
  } else {
    await prisma.favouriteEntry.create({ data: { userId: user.id, entryId } });
  }

  revalidateEntryViews(entryId);
}

export async function toggleReviewedAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const entryId = String(formData.get("entryId") ?? "");
  if (!entryId) throw new Error("Missing entry id.");

  const existing = await prisma.reviewedEntry.findUnique({
    where: { userId_entryId: { userId: user.id, entryId } },
  });

  if (existing) {
    await prisma.reviewedEntry.delete({ where: { id: existing.id } });
  } else {
    await prisma.reviewedEntry.create({ data: { userId: user.id, entryId } });
  }

  revalidateEntryViews(entryId);
}

export async function toggleChecklistItemAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const entryId = String(formData.get("entryId") ?? "");
  const index = Number(formData.get("index"));
  const checked = formData.get("checked") === "true";

  if (!entryId || Number.isNaN(index)) throw new Error("Missing checklist item.");

  const existing = await prisma.checklistProgress.findUnique({
    where: { userId_entryId: { userId: user.id, entryId } },
  });

  const completed = new Set<number>(existing ? JSON.parse(existing.completedItems) : []);
  if (checked) {
    completed.add(index);
  } else {
    completed.delete(index);
  }
  const completedItems = JSON.stringify(Array.from(completed));

  await prisma.checklistProgress.upsert({
    where: { userId_entryId: { userId: user.id, entryId } },
    create: { userId: user.id, entryId, completedItems },
    update: { completedItems },
  });

  revalidateEntryViews(entryId);
}
