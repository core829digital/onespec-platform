/**
 * Plan-recommendation quiz used in the onboarding wizard's "planQuiz" step.
 * Maps a few plain questions to a suggested tier — advisory only, the user
 * always picks the final plan themselves. Thresholds are chosen to match
 * the real per-tier limits in convex/lib/entitlements.ts (base: 1
 * configurator / 20 quotes/mo / 2 team members; pro: 3 / unlimited / 5 +
 * white-label + public widget; agency: 10 / 1000 / 15 + multi-supplier;
 * enterprise: unlimited + CRM integration, sales-led not self-serve).
 *
 * Widget-first ladder (sold first): a small installer who mainly wants quote
 * requests from their website is pointed at Essentials (1 configurator) or
 * Essentials+ (2-3 configurators, white-label) instead of a platform plan.
 */

export type TeamSize = "1-2" | "3-5" | "6-15" | "15+";
export type ConfiguratorCount = "1" | "2-3" | "4-10" | "10+";
export type QuoteVolume = "under20" | "unlimited-few" | "hundreds" | "1000+";
export type NeedFlag = "whiteLabel" | "publicWidget" | "multiSupplier" | "crm";

export interface PlanQuizAnswers {
  teamSize: TeamSize;
  configurators: ConfiguratorCount;
  quoteVolume: QuoteVolume;
  needs: NeedFlag[];
}

export type RecommendedPlan = "essentials" | "essentials_plus" | "base" | "pro" | "agency" | "enterprise";

export function recommendPlan(a: PlanQuizAnswers): RecommendedPlan {
  if (a.needs.includes("crm")) return "enterprise";
  if (a.teamSize === "15+" || a.configurators === "10+" || a.quoteVolume === "1000+") {
    return "enterprise";
  }
  if (a.needs.includes("multiSupplier") || a.teamSize === "6-15" || a.configurators === "4-10" || a.quoteVolume === "hundreds") {
    return "agency";
  }
  // Website quote requests only, small team, modest volume → widget-first plans.
  const widgetOnly =
    a.needs.includes("publicWidget") &&
    a.needs.every((n) => n === "publicWidget" || n === "whiteLabel") &&
    a.teamSize === "1-2" &&
    (a.quoteVolume === "under20" || a.quoteVolume === "unlimited-few");
  if (widgetOnly && a.configurators === "1" && !a.needs.includes("whiteLabel")) return "essentials";
  if (widgetOnly && (a.configurators === "1" || a.configurators === "2-3")) return "essentials_plus";
  if (
    a.needs.includes("whiteLabel") ||
    a.needs.includes("publicWidget") ||
    a.teamSize === "3-5" ||
    a.configurators === "2-3" ||
    a.quoteVolume === "unlimited-few"
  ) {
    return "pro";
  }
  return "base";
}
