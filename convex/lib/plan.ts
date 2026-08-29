export const QUOTA_MATRIX: Record<
  string,
  { quoteRequests: number; activeConfigurators: number; whiteLabel: boolean }
> = {
  starter: { quoteRequests: 50, activeConfigurators: 1, whiteLabel: false },
  business: { quoteRequests: 300, activeConfigurators: 3, whiteLabel: true },
  enterprise: { quoteRequests: Infinity, activeConfigurators: Infinity, whiteLabel: true },
  alpha: { quoteRequests: 300, activeConfigurators: 3, whiteLabel: true },
};

export function planQuota(plan: string) {
  return QUOTA_MATRIX[plan] ?? QUOTA_MATRIX.starter;
}

export function hasWhiteLabel(plan: string, isAlpha = false): boolean {
  return isAlpha || planQuota(plan).whiteLabel;
}

/**
 * Soft quota check. For MVP callers treat `allowed:false` as advisory (audit +
 * warn), not a hard block.
 */
export function checkQuota(
  plan: string,
  feature: "quoteRequests" | "activeConfigurators",
  currentUsage: number,
): { allowed: boolean; limit: number; warning?: string } {
  const limit = planQuota(plan)[feature];
  if (limit === Infinity) return { allowed: true, limit: Infinity };
  const allowed = currentUsage < limit;
  return {
    allowed,
    limit,
    warning:
      currentUsage >= limit * 0.8
        ? `Approaching ${feature} limit (${currentUsage}/${limit})`
        : undefined,
  };
}
