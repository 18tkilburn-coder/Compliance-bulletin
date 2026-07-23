export type TopicSlug =
  | "safeguarding"
  | "staffing"
  | "medicines"
  | "infection-control"
  | "governance"
  | "environment-premises"
  | "nutrition-hydration"
  | "mental-capacity"
  | "training";

export const TOPICS: { slug: TopicSlug; label: string }[] = [
  { slug: "safeguarding", label: "Safeguarding" },
  { slug: "staffing", label: "Staffing" },
  { slug: "medicines", label: "Medicines management" },
  { slug: "infection-control", label: "Infection control" },
  { slug: "governance", label: "Governance & notifications" },
  { slug: "environment-premises", label: "Environment & premises" },
  { slug: "nutrition-hydration", label: "Nutrition & hydration" },
  { slug: "mental-capacity", label: "Mental capacity & consent" },
  { slug: "training", label: "Training & competency" },
];

export const REGULATED_ACTIVITIES = [
  "Personal care",
  "Accommodation for persons who require nursing or personal care",
  "Treatment of disease, disorder or injury",
  "Diagnostic and screening procedures",
  "Nursing care",
] as const;

export type RegulatedActivity = (typeof REGULATED_ACTIVITIES)[number];

export function topicLabel(slug: string): string {
  return TOPICS.find((t) => t.slug === slug)?.label ?? slug;
}
