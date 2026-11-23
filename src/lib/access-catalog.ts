export const proposedPlans = [
  { code: "premium_30d", nameKey: "pricing.monthly", durationDays: 30 },
  { code: "premium_90d", nameKey: "pricing.quarterly", durationDays: 90 },
  { code: "premium_365d", nameKey: "pricing.annual", durationDays: 365 },
] as const;

export const proposedAccessRows = [
  { featureKey: "pricing.access.account", freeKey: "pricing.included", premiumKey: "pricing.included" },
  { featureKey: "pricing.access.levels", freeKey: "pricing.included", premiumKey: "pricing.included" },
  { featureKey: "pricing.access.sample", freeKey: "pricing.limitedSamples", premiumKey: "pricing.included" },
  { featureKey: "pricing.access.mocks", freeKey: "pricing.introMock", premiumKey: "pricing.allPublishedMocks" },
  { featureKey: "pricing.access.additional", freeKey: "pricing.curatedAllowance", premiumKey: "pricing.fullPractice" },
  { featureKey: "pricing.access.results", freeKey: "pricing.rawResults", premiumKey: "pricing.detailedResults" },
  { featureKey: "pricing.access.explanations", freeKey: "pricing.freeExplanations", premiumKey: "pricing.premiumExplanations" },
  { featureKey: "pricing.access.mistakes", freeKey: "pricing.recentMistakes", premiumKey: "pricing.fullNotebook" },
  { featureKey: "pricing.access.progress", freeKey: "pricing.basicProgress", premiumKey: "pricing.fullProgress" },
  { featureKey: "pricing.access.ads", freeKey: "pricing.noAdsScope", premiumKey: "pricing.noAds" },
] as const;
