/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as ResendOTP from "../ResendOTP.js";
import type * as ResendPasswordReset from "../ResendPasswordReset.js";
import type * as account from "../account.js";
import type * as admin from "../admin.js";
import type * as alpha from "../alpha.js";
import type * as analytics from "../analytics.js";
import type * as audit from "../audit.js";
import type * as auth from "../auth.js";
import type * as billing from "../billing.js";
import type * as branding from "../branding.js";
import type * as catalog from "../catalog.js";
import type * as catalogImport from "../catalogImport.js";
import type * as configurators from "../configurators.js";
import type * as crons from "../crons.js";
import type * as email from "../email.js";
import type * as emails_auth from "../emails/auth.js";
import type * as exports from "../exports.js";
import type * as http from "../http.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_billingPlans from "../lib/billingPlans.js";
import type * as lib_configResolution from "../lib/configResolution.js";
import type * as lib_csv from "../lib/csv.js";
import type * as lib_entitlements from "../lib/entitlements.js";
import type * as lib_enums from "../lib/enums.js";
import type * as lib_ids from "../lib/ids.js";
import type * as lib_plan from "../lib/plan.js";
import type * as lib_pricing from "../lib/pricing.js";
import type * as lib_ratelimit from "../lib/ratelimit.js";
import type * as lib_regions from "../lib/regions.js";
import type * as notifications from "../notifications.js";
import type * as onboarding from "../onboarding.js";
import type * as quotes from "../quotes.js";
import type * as seed from "../seed.js";
import type * as tenants from "../tenants.js";
import type * as users from "../users.js";
import type * as widget from "../widget.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  ResendOTP: typeof ResendOTP;
  ResendPasswordReset: typeof ResendPasswordReset;
  account: typeof account;
  admin: typeof admin;
  alpha: typeof alpha;
  analytics: typeof analytics;
  audit: typeof audit;
  auth: typeof auth;
  billing: typeof billing;
  branding: typeof branding;
  catalog: typeof catalog;
  catalogImport: typeof catalogImport;
  configurators: typeof configurators;
  crons: typeof crons;
  email: typeof email;
  "emails/auth": typeof emails_auth;
  exports: typeof exports;
  http: typeof http;
  "lib/auth": typeof lib_auth;
  "lib/billingPlans": typeof lib_billingPlans;
  "lib/configResolution": typeof lib_configResolution;
  "lib/csv": typeof lib_csv;
  "lib/entitlements": typeof lib_entitlements;
  "lib/enums": typeof lib_enums;
  "lib/ids": typeof lib_ids;
  "lib/plan": typeof lib_plan;
  "lib/pricing": typeof lib_pricing;
  "lib/ratelimit": typeof lib_ratelimit;
  "lib/regions": typeof lib_regions;
  notifications: typeof notifications;
  onboarding: typeof onboarding;
  quotes: typeof quotes;
  seed: typeof seed;
  tenants: typeof tenants;
  users: typeof users;
  widget: typeof widget;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
