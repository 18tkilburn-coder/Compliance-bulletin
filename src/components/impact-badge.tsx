import type { ImpactLevel } from "@/lib/types";

const LABELS: Record<ImpactLevel, string> = {
  HIGH: "High impact",
  MEDIUM: "Medium impact",
  LOW: "Low impact",
};

export function ImpactBadge({ level }: { level: ImpactLevel }) {
  return <span className={`impact-badge impact-${level}`}>{LABELS[level]}</span>;
}
