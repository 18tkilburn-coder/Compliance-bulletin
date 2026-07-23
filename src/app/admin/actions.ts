"use server";

import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/dal";
import { prisma } from "@/lib/db";
import { generateBulletin } from "@/lib/bulletin-generator";
import { IMPACT_LEVELS, type ImpactLevel } from "@/lib/types";
import type { TopicSlug } from "@/lib/taxonomy";

export interface GenerateDraftState {
  raw?: { title: string; sourceName: string; sourceUrl: string; rawText: string };
  draft?: {
    summary: string;
    impactLevel: ImpactLevel;
    topics: TopicSlug[];
    regulatedActivities: string[];
    actionChecklist: string[];
  };
  error?: string;
}

export async function generateDraftAction(
  _state: GenerateDraftState | undefined,
  formData: FormData
): Promise<GenerateDraftState> {
  await requireAdmin();

  const title = String(formData.get("title") ?? "").trim();
  const sourceName = String(formData.get("sourceName") ?? "").trim();
  const sourceUrl = String(formData.get("sourceUrl") ?? "").trim();
  const rawText = String(formData.get("rawText") ?? "").trim();

  if (!title || !sourceName || !sourceUrl || !rawText) {
    return { error: "Fill in the title, source and raw text before generating a structured entry." };
  }

  const draft = generateBulletin(title, sourceName, rawText);

  return {
    raw: { title, sourceName, sourceUrl, rawText },
    draft,
  };
}

function readEntryForm(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const sourceName = String(formData.get("sourceName") ?? "").trim();
  const sourceUrl = String(formData.get("sourceUrl") ?? "").trim();
  const rawText = String(formData.get("rawText") ?? "").trim();
  const summary = String(formData.get("summary") ?? "").trim();
  const impactLevelRaw = String(formData.get("impactLevel") ?? "MEDIUM");
  const impactLevel: ImpactLevel = IMPACT_LEVELS.includes(impactLevelRaw as ImpactLevel)
    ? (impactLevelRaw as ImpactLevel)
    : "MEDIUM";
  const topics = formData.getAll("topics").map(String);
  const regulatedActivities = formData.getAll("regulatedActivities").map(String);
  const actionChecklist = String(formData.get("actionChecklist") ?? "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

  return {
    title,
    sourceName,
    sourceUrl,
    rawText,
    summary,
    impactLevel,
    topics,
    regulatedActivities,
    actionChecklist,
  };
}

async function saveNewEntry(formData: FormData, status: "DRAFT" | "PUBLISHED") {
  await requireAdmin();
  const data = readEntryForm(formData);

  if (!data.title || !data.summary) {
    throw new Error("Title and summary are required.");
  }

  await prisma.bulletinEntry.create({
    data: {
      title: data.title,
      sourceName: data.sourceName,
      sourceUrl: data.sourceUrl,
      rawText: data.rawText,
      summary: data.summary,
      impactLevel: data.impactLevel,
      topics: data.topics.join(","),
      regulatedActivities: data.regulatedActivities.join(","),
      actionChecklist: JSON.stringify(data.actionChecklist),
      status,
      publishedAt: status === "PUBLISHED" ? new Date() : null,
    },
  });
}

export async function saveDraftAction(formData: FormData): Promise<void> {
  await saveNewEntry(formData, "DRAFT");
  redirect("/admin/entries");
}

export async function publishAction(formData: FormData): Promise<void> {
  await saveNewEntry(formData, "PUBLISHED");
  redirect("/admin/entries");
}

export async function updateEntryAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing entry id.");

  const data = readEntryForm(formData);
  const existing = await prisma.bulletinEntry.findUniqueOrThrow({ where: { id } });

  await prisma.bulletinEntry.update({
    where: { id },
    data: {
      title: data.title,
      sourceName: data.sourceName,
      sourceUrl: data.sourceUrl,
      rawText: data.rawText,
      summary: data.summary,
      impactLevel: data.impactLevel,
      topics: data.topics.join(","),
      regulatedActivities: data.regulatedActivities.join(","),
      actionChecklist: JSON.stringify(data.actionChecklist),
      publishedAt:
        existing.status !== "PUBLISHED" ? existing.publishedAt : existing.publishedAt,
    },
  });

  redirect("/admin/entries");
}

export async function togglePublishAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const entry = await prisma.bulletinEntry.findUniqueOrThrow({ where: { id } });

  const nextStatus = entry.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED";
  await prisma.bulletinEntry.update({
    where: { id },
    data: {
      status: nextStatus,
      publishedAt: nextStatus === "PUBLISHED" ? (entry.publishedAt ?? new Date()) : entry.publishedAt,
    },
  });

  redirect("/admin/entries");
}

export async function deleteEntryAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  await prisma.bulletinEntry.delete({ where: { id } });
  redirect("/admin/entries");
}
