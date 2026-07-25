export interface ChecklistTally {
  done: number;
  total: number;
}

export function parseCompletedIndices(json: string | null | undefined): number[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed.filter((n): n is number => typeof n === "number") : [];
  } catch {
    return [];
  }
}

export function tallyChecklist(total: number, completedIndices: number[]): ChecklistTally {
  const done = completedIndices.filter((i) => i >= 0 && i < total).length;
  return { done, total };
}
