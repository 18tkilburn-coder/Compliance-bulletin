import type { ImpactLevel } from "./types";
import { REGULATED_ACTIVITIES, type TopicSlug } from "./taxonomy";

/**
 * Deterministic stand-in for the AI curation step. It reads like a first
 * draft an editor would then check by eye — which is the point for an MVP
 * content pipeline: the shape of the output (summary, impact, activities,
 * checklist) is what needs validating with real users, not the model
 * behind it. Swap this module out for a real LLM call later without
 * touching the admin form or the data it writes.
 */

const TOPIC_KEYWORDS: Record<TopicSlug, string[]> = {
  safeguarding: [
    "safeguard",
    "abuse",
    "neglect",
    "whistleblow",
    "restraint",
    "allegation",
    "deprivation of liberty",
    "dols",
  ],
  staffing: [
    "staffing",
    "rota",
    "recruitment",
    "dbs",
    "agency worker",
    "supervision",
    "retention",
    "vacancy",
    "workforce",
    "staffing level",
    "skills for care",
  ],
  medicines: [
    "medicine",
    "medication",
    "controlled drug",
    "mar chart",
    "prescri",
    "dosage",
    "prn",
    "administer",
  ],
  "infection-control": [
    "infection",
    "ipc ",
    "outbreak",
    "hygiene",
    "ppe",
    "hand hygiene",
    "cleaning",
    "norovirus",
    "influenza",
    "covid",
  ],
  governance: [
    "notification",
    "notify",
    "statutory notification",
    "governance",
    "registration",
    "rating",
    "assessment framework",
    "fundamental standard",
    "duty of candour",
    "complaint",
    "incident report",
    "regulation 1",
  ],
  "environment-premises": [
    "premises",
    "building",
    "fire safety",
    "environment",
    "maintenance",
    "ligature",
    "accessib",
    "equipment",
    "estate",
    "water safety",
    "legionella",
  ],
  "nutrition-hydration": [
    "nutrition",
    "hydration",
    "food",
    "meal",
    "dietician",
    "dietitian",
    "malnutrition",
    "weight loss",
    "catering",
  ],
  "mental-capacity": [
    "mental capacity",
    " mca ",
    "consent",
    "best interest",
    "liberty protection safeguard",
    " lps ",
  ],
  training: [
    "training",
    "competency",
    "induction",
    "e-learning",
    "elearning",
    "cpd",
    "qualification",
    "certificate",
  ],
};

const TOPIC_TO_ACTIVITIES: Record<TopicSlug, (typeof REGULATED_ACTIVITIES)[number][]> = {
  safeguarding: ["Personal care", "Accommodation for persons who require nursing or personal care"],
  staffing: ["Personal care", "Accommodation for persons who require nursing or personal care"],
  medicines: ["Treatment of disease, disorder or injury", "Nursing care"],
  "infection-control": [
    "Personal care",
    "Accommodation for persons who require nursing or personal care",
    "Nursing care",
  ],
  governance: ["Accommodation for persons who require nursing or personal care"],
  "environment-premises": ["Accommodation for persons who require nursing or personal care"],
  "nutrition-hydration": ["Personal care", "Accommodation for persons who require nursing or personal care"],
  "mental-capacity": ["Personal care", "Treatment of disease, disorder or injury"],
  training: ["Personal care", "Accommodation for persons who require nursing or personal care"],
};

const HIGH_SIGNALS = [
  "immediate",
  "immediately",
  "mandatory",
  "must",
  "statutory",
  "urgent",
  "enforcement",
  "warning notice",
  "requirement notice",
  "prosecut",
  "closure",
  "suspend",
  "breach",
  "non-compliance",
  "duty of candour",
  "serious incident",
  " death",
  "notifiable",
  "regulation 12",
  "regulation 13",
  "regulation 17",
  "inadequate",
  "requires improvement",
  "deadline",
];

const MEDIUM_SIGNALS = [
  "should",
  "recommended",
  "best practice",
  "review",
  "revised",
  "update to",
  "updated guidance",
  "consultation",
  "expectation",
  "new framework",
  "changes to",
];

const LOW_SIGNALS = [
  "minor",
  "clarification",
  "no change",
  "administrative",
  "for information",
  "correction",
  "typo",
];

function normalize(text: string): string {
  return ` ${text.toLowerCase()} `;
}

export function detectTopics(title: string, rawText: string): TopicSlug[] {
  const haystack = normalize(`${title} ${rawText}`);
  const matches = (Object.keys(TOPIC_KEYWORDS) as TopicSlug[]).filter((topic) =>
    TOPIC_KEYWORDS[topic].some((kw) => haystack.includes(kw))
  );
  return matches.length > 0 ? matches : ["governance"];
}

export function scoreImpact(title: string, rawText: string): ImpactLevel {
  const haystack = normalize(`${title} ${rawText}`);
  let score = 0;
  for (const signal of HIGH_SIGNALS) if (haystack.includes(signal)) score += 3;
  for (const signal of MEDIUM_SIGNALS) if (haystack.includes(signal)) score += 1;
  for (const signal of LOW_SIGNALS) if (haystack.includes(signal)) score -= 2;

  if (score >= 6) return "HIGH";
  if (score >= 2) return "MEDIUM";
  if (score <= -2) return "LOW";
  return rawText.length > 600 ? "MEDIUM" : "LOW";
}

export function mapRegulatedActivities(topics: TopicSlug[]): string[] {
  const set = new Set<string>();
  for (const topic of topics) {
    for (const activity of TOPIC_TO_ACTIVITIES[topic]) set.add(activity);
  }
  if (set.size === 0) set.add("Personal care");
  return Array.from(set);
}

function firstSentences(text: string, count: number): string {
  const cleaned = text.replace(/\s+/g, " ").trim();
  const sentences = cleaned.split(/(?<=[.!?])\s+/).filter(Boolean);
  return sentences.slice(0, count).join(" ");
}

export function buildSummary(title: string, sourceName: string, rawText: string): string {
  const extract = firstSentences(rawText, 2) || title;
  return `${sourceName} update — ${title}. ${extract} In plain terms: this changes what inspectors will expect to see in place, so it's worth reviewing before your next assessment.`;
}

const CHECKLIST_TEMPLATES: Record<TopicSlug, string[]> = {
  safeguarding: [
    "Review your safeguarding policy against this update and note the date of review.",
    "Brief all staff on the change at the next handover or team meeting.",
    "Check that safeguarding referral routes and contact details are current on notice boards.",
  ],
  staffing: [
    "Check current rotas and staffing levels against the new expectation.",
    "Update recruitment and induction checklists to reflect the change.",
    "Confirm supervision records are up to date for all care staff.",
  ],
  medicines: [
    "Review medicines administration records (MAR charts) for compliance with the update.",
    "Brief the medicines lead and refresh staff competency checks if needed.",
    "Update the medicines management policy and record the review date.",
  ],
  "infection-control": [
    "Review the infection prevention and control (IPC) policy against this update.",
    "Check PPE stock levels and hand hygiene audit schedules.",
    "Brief staff on any changed cleaning or outbreak procedures.",
  ],
  governance: [
    "Check whether this update introduces a new statutory notification requirement.",
    "Update your governance and quality assurance framework documentation.",
    "Add this update to your evidence folder ahead of the next inspection or PIR.",
  ],
  "environment-premises": [
    "Walk the building against the updated requirement and log any gaps.",
    "Raise a maintenance or estates ticket for anything that falls short.",
    "Update your premises risk assessment to reflect the change.",
  ],
  "nutrition-hydration": [
    "Review menus and hydration monitoring against the update.",
    "Brief catering and care staff on any changed expectations.",
    "Update nutrition and hydration care plan templates if affected.",
  ],
  "mental-capacity": [
    "Review consent and mental capacity assessment templates against this update.",
    "Check DoLS/Liberty Protection Safeguards records are current for affected residents.",
    "Brief staff on any change to best-interest decision-making process.",
  ],
  training: [
    "Check which staff need refresher training in light of this update.",
    "Update the training matrix and set completion deadlines.",
    "Record evidence of completed training for inspection readiness.",
  ],
};

const IMPACT_PREFIX: Record<ImpactLevel, string> = {
  HIGH: "Escalate to the registered manager and nominated individual today —",
  MEDIUM: "Schedule this into the next management or team meeting —",
  LOW: "Note for the next routine policy review —",
};

export function buildActionChecklist(topics: TopicSlug[], impact: ImpactLevel): string[] {
  const items: string[] = [];
  const seen = new Set<string>();
  const push = (item: string) => {
    if (!seen.has(item)) {
      seen.add(item);
      items.push(item);
    }
  };

  push(`${IMPACT_PREFIX[impact]} confirm who owns this update and by when it will be actioned.`);
  for (const topic of topics) {
    for (const template of CHECKLIST_TEMPLATES[topic] ?? []) {
      push(template);
      if (items.length >= 6) break;
    }
    if (items.length >= 6) break;
  }
  push("Record the action taken in your evidence folder in case CQC ask about it at inspection.");

  return items.slice(0, 6);
}

export interface GeneratedBulletin {
  summary: string;
  impactLevel: ImpactLevel;
  topics: TopicSlug[];
  regulatedActivities: string[];
  actionChecklist: string[];
}

export function generateBulletin(
  title: string,
  sourceName: string,
  rawText: string
): GeneratedBulletin {
  const topics = detectTopics(title, rawText);
  const impactLevel = scoreImpact(title, rawText);
  const regulatedActivities = mapRegulatedActivities(topics);
  const actionChecklist = buildActionChecklist(topics, impactLevel);

  return {
    summary: buildSummary(title, sourceName, rawText),
    impactLevel,
    topics,
    regulatedActivities,
    actionChecklist,
  };
}
