import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

const DEFAULT_PLANS = [
  {
    key: "freemium",
    name: "Freemium",
    description: "Perfect for testing the platform",
    stripePriceIdMonthly: undefined,
    stripePriceIdYearly: undefined,
    priceMonthlyCents: 0,
    priceYearlyCents: 0,
    currency: "EUR",
    trialDays: 14,
    features: [
      "1 configurator",
      "10 quotes/month",
      "Basic catalog",
      "Standard support",
      "PDF quotes with watermark",
    ],
    limits: {
      maxConfigurators: 1,
      maxQuotesPerMonth: 10,
      maxTeamMembers: 1,
      whiteLabel: false,
      customDomain: false,
      apiAccess: false,
      prioritySupport: false,
    },
    isActive: true,
    sortOrder: 0,
  },
  {
    key: "starter",
    name: "Starter",
    description: "For small businesses getting started",
    stripePriceIdMonthly: process.env.STRIPE_PRICE_STARTER_MONTHLY || "price_starter_monthly",
    stripePriceIdYearly: process.env.STRIPE_PRICE_STARTER_YEARLY || "price_starter_yearly",
    priceMonthlyCents: 2900, // €29/month
    priceYearlyCents: 29000, // €290/year (save 2 months)
    currency: "EUR",
    trialDays: 14,
    features: [
      "3 configurators",
      "100 quotes/month",
      "Full catalog management",
      "Email support",
      "PDF quotes",
      "Basic analytics",
    ],
    limits: {
      maxConfigurators: 3,
      maxQuotesPerMonth: 100,
      maxTeamMembers: 3,
      whiteLabel: false,
      customDomain: false,
      apiAccess: false,
      prioritySupport: false,
    },
    isActive: true,
    sortOrder: 1,
  },
  {
    key: "business",
    name: "Business",
    description: "For growing companies",
    stripePriceIdMonthly: process.env.STRIPE_PRICE_BUSINESS_MONTHLY || "price_business_monthly",
    stripePriceIdYearly: process.env.STRIPE_PRICE_BUSINESS_YEARLY || "price_business_yearly",
    priceMonthlyCents: 7900, // €79/month
    priceYearlyCents: 79000, // €790/year (save 2 months)
    currency: "EUR",
    trialDays: 14,
    features: [
      "10 configurators",
      "500 quotes/month",
      "Advanced catalog & pricing rules",
      "Priority email support",
      "White-label PDF quotes",
      "Advanced analytics",
      "Webhooks",
    ],
    limits: {
      maxConfigurators: 10,
      maxQuotesPerMonth: 500,
      maxTeamMembers: 10,
      whiteLabel: true,
      customDomain: false,
      apiAccess: true,
      prioritySupport: true,
    },
    isActive: true,
    sortOrder: 2,
  },
  {
    key: "enterprise",
    name: "Enterprise",
    description: "For large organizations",
    stripePriceIdMonthly: process.env.STRIPE_PRICE_ENTERPRISE_MONTHLY || "price_enterprise_monthly",
    stripePriceIdYearly: process.env.STRIPE_PRICE_ENTERPRISE_YEARLY || "price_enterprise_yearly",
    priceMonthlyCents: 24900, // €249/month
    priceYearlyCents: 249000, // €2490/year (save 2 months)
    currency: "EUR",
    trialDays: 14,
    features: [
      "Unlimited configurators",
      "Unlimited quotes",
      "Custom pricing rules",
      "24/7 priority support",
      "Custom domain",
      "Full API access",
      "SSO/SAML",
      "Dedicated account manager",
      "SLA guarantee",
    ],
    limits: {
      maxConfigurators: -1, // unlimited
      maxQuotesPerMonth: -1,
      maxTeamMembers: -1,
      whiteLabel: true,
      customDomain: true,
      apiAccess: true,
      prioritySupport: true,
    },
    isActive: true,
    sortOrder: 3,
  },
  {
    key: "alpha",
    name: "Alpha",
    description: "Early adopter program - lifetime discount",
    stripePriceIdMonthly: process.env.STRIPE_PRICE_ALPHA_MONTHLY || "price_alpha_monthly",
    stripePriceIdYearly: process.env.STRIPE_PRICE_ALPHA_YEARLY || "price_alpha_yearly",
    priceMonthlyCents: 1900, // €19/month (50% off Business)
    priceYearlyCents: 19000, // €190/year
    currency: "EUR",
    trialDays: 30,
    features: [
      "10 configurators",
      "500 quotes/month",
      "Advanced catalog & pricing rules",
      "Priority email support",
      "White-label PDF quotes",
      "Advanced analytics",
      "Webhooks",
      "Early access to new features",
      "Lifetime 50% discount on Business plan",
    ],
    limits: {
      maxConfigurators: 10,
      maxQuotesPerMonth: 500,
      maxTeamMembers: 10,
      whiteLabel: true,
      customDomain: false,
      apiAccess: true,
      prioritySupport: true,
    },
    isActive: true,
    sortOrder: -1,
  },
];

export const seedSubscriptionPlans = internalMutation({
  args: {},
  handler: async (ctx) => {
    for (const plan of DEFAULT_PLANS) {
      const existing = await ctx.db
        .query("subscriptionPlans")
        .withIndex("by_key", (q) => q.eq("key", plan.key))
        .unique();
      
      if (existing) {
        await ctx.db.patch(existing._id, plan);
      } else {
        await ctx.db.insert("subscriptionPlans", plan);
      }
    }
  },
});

export const seedCronJobs = internalMutation({
  args: {},
  handler: async (ctx) => {
    const defaultCrons = [
      {
        name: "sync_stripe_subscriptions",
        status: "scheduled" as const,
        lastRunAt: undefined,
        nextRunAt: Date.now() + 5 * 60 * 1000, // 5 minutes
        lastError: undefined,
        runCount: 0,
        metadata: { schedule: "*/5 * * * *" }, // Every 5 minutes
      },
      {
        name: "process_failed_payments",
        status: "scheduled" as const,
        lastRunAt: undefined,
        nextRunAt: Date.now() + 60 * 60 * 1000, // 1 hour
        lastError: undefined,
        runCount: 0,
        metadata: { schedule: "0 * * * *" }, // Hourly
      },
      {
        name: "sync_stripe_invoices",
        status: "scheduled" as const,
        lastRunAt: undefined,
        nextRunAt: Date.now() + 15 * 60 * 1000, // 15 minutes
        lastError: undefined,
        runCount: 0,
        metadata: { schedule: "*/15 * * * *" }, // Every 15 minutes
      },
      {
        name: "cleanup_expired_preview_tokens",
        status: "scheduled" as const,
        lastRunAt: undefined,
        nextRunAt: Date.now() + 60 * 60 * 1000, // 1 hour
        lastError: undefined,
        runCount: 0,
        metadata: { schedule: "0 * * * *" }, // Hourly
      },
      {
        name: "send_trial_ending_reminders",
        status: "scheduled" as const,
        lastRunAt: undefined,
        nextRunAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
        lastError: undefined,
        runCount: 0,
        metadata: { schedule: "0 9 * * *" }, // Daily at 9 AM
      },
      {
        name: "update_usage_counters",
        status: "scheduled" as const,
        lastRunAt: undefined,
        nextRunAt: Date.now() + 60 * 60 * 1000, // 1 hour
        lastError: undefined,
        runCount: 0,
        metadata: { schedule: "0 * * * *" }, // Hourly
      },
    ];

    for (const cron of defaultCrons) {
      const existing = await ctx.db
        .query("cronJobs")
        .withIndex("by_name", (q) => q.eq("name", cron.name))
        .unique();
      
      if (existing) {
        await ctx.db.patch(existing._id, cron);
      } else {
        await ctx.db.insert("cronJobs", cron);
      }
    }
  },
});