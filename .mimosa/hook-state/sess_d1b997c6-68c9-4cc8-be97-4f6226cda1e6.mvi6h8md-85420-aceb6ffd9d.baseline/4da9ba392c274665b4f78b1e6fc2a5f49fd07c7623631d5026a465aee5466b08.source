import { ConvexError } from "convex/values";
import type { Check } from "../../src/shared/validation";

/** The value of a passed check, or a ConvexError the UI translates (`VALIDATION_<CODE>`). */
export function must<T>(check: Check<T>): T {
  if (!check.ok) throw new ConvexError(`VALIDATION_${check.code}`);
  return check.value;
}
