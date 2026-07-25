export const IMPACT_LEVELS = ["HIGH", "MEDIUM", "LOW"] as const;
export type ImpactLevel = (typeof IMPACT_LEVELS)[number];

export const ENTRY_STATUSES = ["DRAFT", "PUBLISHED"] as const;
export type EntryStatus = (typeof ENTRY_STATUSES)[number];

export const SUBSCRIPTION_TIERS = ["SOLO", "SMALL_GROUP", "MULTI_SITE"] as const;
export type SubscriptionTier = (typeof SUBSCRIPTION_TIERS)[number];

export const BILLING_STATUSES = ["TRIALING", "ACTIVE", "PAST_DUE", "CANCELED"] as const;
export type BillingStatus = (typeof BILLING_STATUSES)[number];

export const USER_ROLES = ["CUSTOMER", "ADMIN"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const TIER_DETAILS: Record<
  SubscriptionTier,
  { label: string; blurb: string; price: string; features: string[] }
> = {
  SOLO: {
    label: "Solo Home",
    blurb: "For a single registered location.",
    price: "£49/month",
    features: [
      "Daily bulletin feed for one location",
      "Plain-English impact scoring",
      "Weekly email digest",
      "Action checklists per update",
    ],
  },
  SMALL_GROUP: {
    label: "Small Group",
    blurb: "For providers with 2–8 registered locations.",
    price: "£129/month",
    features: [
      "Everything in Solo Home",
      "Cover up to 8 locations",
      "Shared team access (up to 5 seats)",
      "Priority flagging for enforcement-risk updates",
    ],
  },
  MULTI_SITE: {
    label: "Multi-Site",
    blurb: "For groups and multi-site operators.",
    price: "Custom pricing",
    features: [
      "Everything in Small Group",
      "Unlimited locations and seats",
      "Quarterly compliance briefing pack",
      "Dedicated account contact",
    ],
  },
};

export const BILLING_STATUS_LABELS: Record<BillingStatus, string> = {
  TRIALING: "Trial",
  ACTIVE: "Active",
  PAST_DUE: "Payment overdue",
  CANCELED: "Cancelled",
};
