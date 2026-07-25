import { prisma } from "./db";
import { parseCompletedIndices } from "./progress";

export async function getFavouriteEntryIds(userId: string): Promise<Set<string>> {
  const rows = await prisma.favouriteEntry.findMany({
    where: { userId },
    select: { entryId: true },
  });
  return new Set(rows.map((r) => r.entryId));
}

export async function getChecklistProgressMap(userId: string): Promise<Map<string, number[]>> {
  const rows = await prisma.checklistProgress.findMany({ where: { userId } });
  const map = new Map<string, number[]>();
  for (const row of rows) map.set(row.entryId, parseCompletedIndices(row.completedItems));
  return map;
}

export async function getReviewedEntryIds(userId: string): Promise<Set<string>> {
  const rows = await prisma.reviewedEntry.findMany({
    where: { userId },
    select: { entryId: true },
  });
  return new Set(rows.map((r) => r.entryId));
}
