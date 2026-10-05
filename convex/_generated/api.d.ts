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
import type * as adminCleanup from "../adminCleanup.js";
import type * as adminPurge from "../adminPurge.js";
import type * as analytics from "../analytics.js";
import type * as audit from "../audit.js";
import type * as auth from "../auth.js";
import type * as billing from "../billing.js";
import type * as branding from "../branding.js";
import type * as calculations from "../calculations.js";
import type * as cantieri from "../cantieri.js";
import type * as catalog from "../catalog.js";
import type * as catalogImport from "../catalogImport.js";
import type * as clients from "../clients.js";
import type * as configurators from "../configurators.js";
import type * as crons from "../crons.js";
import type * as dpa from "../dpa.js";
import type * as email from "../email.js";
import type * as emails_auth from "../emails/auth.js";
import type * as exports from "../exports.js";
import type * as feedback from "../feedback.js";
import type * as http from "../http.js";
import type * as http_resend_webhook from "../http/resend_webhook.js";
import type * as inspections from "../inspections.js";
import type * as installations from "../installations.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_authGuard from "../lib/authGuard.js";
import type * as lib_billingPlans from "../lib/billingPlans.js";
import type * as lib_calcPreview from "../lib/calcPreview.js";
import type * as lib_catalogExtras from "../lib/catalogExtras.js";
import type * as lib_compliance from "../lib/compliance.js";
import type * as lib_configResolution from "../lib/configResolution.js";
import type * as lib_csv from "../lib/csv.js";
import type * as lib_emailFrom from "../lib/emailFrom.js";
import type * as lib_enea from "../lib/enea.js";
import type * as lib_enforcement from "../lib/enforcement.js";
import type * as lib_entitlements from "../lib/entitlements.js";
import type * as lib_enums from "../lib/enums.js";
import type * as lib_fieldModules from "../lib/fieldModules.js";
import type * as lib_founding from "../lib/founding.js";
import type * as lib_ids from "../lib/ids.js";
import type * as lib_ipHash from "../lib/ipHash.js";
import type * as lib_links from "../lib/links.js";
import type * as lib_payload from "../lib/payload.js";
import type * as lib_plan from "../lib/plan.js";
import type * as lib_posthog from "../lib/posthog.js";
import type * as lib_pricing from "../lib/pricing.js";
import type * as lib_quoteItems from "../lib/quoteItems.js";
import type * as lib_ratelimit from "../lib/ratelimit.js";
import type * as lib_rbac from "../lib/rbac.js";
import type * as lib_referral from "../lib/referral.js";
import type * as lib_referralCoupon from "../lib/referralCoupon.js";
import type * as lib_referralRewards from "../lib/referralRewards.js";
import type * as lib_regions from "../lib/regions.js";
import type * as lib_standardCatalog from "../lib/standardCatalog.js";
import type * as lib_standardPricing from "../lib/standardPricing.js";
import type * as lib_stripeRest from "../lib/stripeRest.js";
import type * as lib_triggers from "../lib/triggers.js";
import type * as lib_turnstile from "../lib/turnstile.js";
import type * as lib_webhookIp from "../lib/webhookIp.js";
import type * as logistics from "../logistics.js";
import type * as migrations from "../migrations.js";
import type * as notifications from "../notifications.js";
import type * as ops from "../ops.js";
import type * as onboarding from "../onboarding.js";
import type * as passports from "../passports.js";
import type * as pricing from "../pricing.js";
import type * as quotes from "../quotes.js";
import type * as referralPayoutAccount from "../referralPayoutAccount.js";
import type * as referralPayouts from "../referralPayouts.js";
import type * as referrals from "../referrals.js";
import type * as registration from "../registration.js";
import type * as seed from "../seed.js";
import type * as setupGuide from "../setupGuide.js";
import type * as siteDeliveries from "../siteDeliveries.js";
import type * as suppliers from "../suppliers.js";
import type * as surveys from "../surveys.js";
import type * as tenants from "../tenants.js";
import type * as usage from "../usage.js";
import type * as users from "../users.js";
import type * as widget from "../widget.js";
import type * as lib_validate from "../lib/validate.js";
import type * as lib_vat from "../lib/vat.js";
import type * as vies from "../vies.js";

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
  adminCleanup: typeof adminCleanup;
  adminPurge: typeof adminPurge;
  analytics: typeof analytics;
  audit: typeof audit;
  auth: typeof auth;
  billing: typeof billing;
  branding: typeof branding;
  calculations: typeof calculations;
  cantieri: typeof cantieri;
  catalog: typeof catalog;
  catalogImport: typeof catalogImport;
  clients: typeof clients;
  configurators: typeof configurators;
  crons: typeof crons;
  dpa: typeof dpa;
  email: typeof email;
  "emails/auth": typeof emails_auth;
  exports: typeof exports;
  feedback: typeof feedback;
  http: typeof http;
  "http/resend_webhook": typeof http_resend_webhook;
  inspections: typeof inspections;
  installations: typeof installations;
  "lib/auth": typeof lib_auth;
  "lib/authGuard": typeof lib_authGuard;
  "lib/billingPlans": typeof lib_billingPlans;
  "lib/calcPreview": typeof lib_calcPreview;
  "lib/catalogExtras": typeof lib_catalogExtras;
  "lib/compliance": typeof lib_compliance;
  "lib/configResolution": typeof lib_configResolution;
  "lib/csv": typeof lib_csv;
  "lib/emailFrom": typeof lib_emailFrom;
  "lib/enea": typeof lib_enea;
  "lib/enforcement": typeof lib_enforcement;
  "lib/entitlements": typeof lib_entitlements;
  "lib/enums": typeof lib_enums;
  "lib/fieldModules": typeof lib_fieldModules;
  "lib/founding": typeof lib_founding;
  "lib/ids": typeof lib_ids;
  "lib/ipHash": typeof lib_ipHash;
  "lib/links": typeof lib_links;
  "lib/payload": typeof lib_payload;
  "lib/plan": typeof lib_plan;
  "lib/posthog": typeof lib_posthog;
  "lib/pricing": typeof lib_pricing;
  "lib/quoteItems": typeof lib_quoteItems;
  "lib/ratelimit": typeof lib_ratelimit;
  "lib/rbac": typeof lib_rbac;
  "lib/referral": typeof lib_referral;
  "lib/referralCoupon": typeof lib_referralCoupon;
  "lib/referralRewards": typeof lib_referralRewards;
  "lib/regions": typeof lib_regions;
  "lib/standardCatalog": typeof lib_standardCatalog;
  "lib/standardPricing": typeof lib_standardPricing;
  "lib/stripeRest": typeof lib_stripeRest;
  "lib/triggers": typeof lib_triggers;
  "lib/turnstile": typeof lib_turnstile;
  "lib/webhookIp": typeof lib_webhookIp;
  logistics: typeof logistics;
  migrations: typeof migrations;
  notifications: typeof notifications;
  ops: typeof ops;
  onboarding: typeof onboarding;
  passports: typeof passports;
  pricing: typeof pricing;
  quotes: typeof quotes;
  referralPayoutAccount: typeof referralPayoutAccount;
  referralPayouts: typeof referralPayouts;
  referrals: typeof referrals;
  registration: typeof registration;
  seed: typeof seed;
  setupGuide: typeof setupGuide;
  siteDeliveries: typeof siteDeliveries;
  suppliers: typeof suppliers;
  surveys: typeof surveys;
  tenants: typeof tenants;
  usage: typeof usage;
  users: typeof users;
  widget: typeof widget;
  "lib/validate": typeof lib_validate;
  "lib/vat": typeof lib_vat;
  vies: typeof vies;
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
