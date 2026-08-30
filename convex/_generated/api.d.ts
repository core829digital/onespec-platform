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
import type * as admin from "../admin.js";
import type * as alpha from "../alpha.js";
import type * as audit from "../audit.js";
import type * as auth from "../auth.js";
import type * as branding from "../branding.js";
import type * as catalog from "../catalog.js";
import type * as configurators from "../configurators.js";
import type * as email from "../email.js";
import type * as emails_auth from "../emails/auth.js";
import type * as http from "../http.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_enums from "../lib/enums.js";
import type * as lib_ids from "../lib/ids.js";
import type * as lib_plan from "../lib/plan.js";
import type * as lib_pricing from "../lib/pricing.js";
import type * as lib_ratelimit from "../lib/ratelimit.js";
import type * as notifications from "../notifications.js";
import type * as quotes from "../quotes.js";
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
  admin: typeof admin;
  alpha: typeof alpha;
  audit: typeof audit;
  auth: typeof auth;
  branding: typeof branding;
  catalog: typeof catalog;
  configurators: typeof configurators;
  email: typeof email;
  "emails/auth": typeof emails_auth;
  http: typeof http;
  "lib/auth": typeof lib_auth;
  "lib/enums": typeof lib_enums;
  "lib/ids": typeof lib_ids;
  "lib/plan": typeof lib_plan;
  "lib/pricing": typeof lib_pricing;
  "lib/ratelimit": typeof lib_ratelimit;
  notifications: typeof notifications;
  quotes: typeof quotes;
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
