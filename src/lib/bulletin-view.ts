import type { BulletinEntry } from "@/generated/prisma/client";
import type { ImpactLevel } from "./types";

export interface BulletinView {
  id: string;
  title: string;
  sourceName: string;
  sourceUrl: string;
  rawText: string;
  summary: string;
  impactLevel: ImpactLevel;
  topics: string[];
  regulatedActivities: string[];
  actionChecklist: string[];
  status: "DRAFT" | "PUBLISHED";
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

function splitCsv(value: string): string[] {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function toBulletinView(entry: BulletinEntry): BulletinView {
  let actionChecklist: string[] = [];
  try {
    const parsed = JSON.parse(entry.actionChecklist);
    if (Array.isArray(parsed)) actionChecklist = parsed;
  } catch {
    actionChecklist = [];
  }

  return {
    id: entry.id,
    title: entry.title,
    sourceName: entry.sourceName,
    sourceUrl: entry.sourceUrl,
    rawText: entry.rawText,
    summary: entry.summary,
    impactLevel: entry.impactLevel as ImpactLevel,
    topics: splitCsv(entry.topics),
    regulatedActivities: splitCsv(entry.regulatedActivities),
    actionChecklist,
    status: entry.status as "DRAFT" | "PUBLISHED",
    publishedAt: entry.publishedAt,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  };
}
