import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export default defineSchema({
  ...authTables,

  users: defineTable({
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    image: v.optional(v.string()),
    isPlatformAdmin: v.optional(v.boolean()),
    locale: v.optional(v.string()),
    lastSeenAt: v.optional(v.number()),
  }).index("email", ["email"]),

  tenants: defineTable({
    name: v.string(),
    slug: v.string(),
    ownerUserId: v.id("users"),
    country: v.optional(v.string()),
    isAlpha: v.boolean(),
    alphaSeatNumber: v.optional(v.number()),
    plan: v.union(v.literal("alpha"), v.literal("starter"),
                  v.literal("business"), v.literal("enterprise"), v.literal("freemium")),
    planStatus: v.union(v.literal("active"), v.literal("trialing"),
                        v.literal("past_due"), v.literal("suspended")),
    alphaDiscountLocked: v.boolean(),
    suspendedAt: v.optional(v.number()),
    suspendedReason: v.optional(v.string()),
    createdVia: v.union(v.literal("alpha_signup"), v.literal("open_signup"),
                        v.literal("admin_created")),
    stripeCustomerId: v.optional(v.string()),
    email: v.optional(v.string()),
    createdAt: v.optional(v.number()),
    updatedAt: v.optional(v.number()),
    updatedByUserId: v.optional(v.id("users")),
  })
    .index("by_slug", ["slug"])
    .index("by_owner", ["ownerUserId"])
    .index("by_alphaSeatNumber", ["alphaSeatNumber"]),

  memberships: defineTable({
    tenantId: v.id("tenants"),
    userId: v.id("users"),
    role: v.union(v.literal("owner"), v.literal("admin"), v.literal("member")),
    invitedByUserId: v.optional(v.id("users")),
    acceptedAt: v.optional(v.number()),
    status: v.union(v.literal("active"), v.literal("invited"), v.literal("removed")),
  })
    .index("by_tenant", ["tenantId"])
    .index("by_user", ["userId"])
    .index("by_tenant_user", ["tenantId", "userId"]),

  invitations: defineTable({
    tenantId: v.id("tenants"),
    email: v.string(),
    role: v.union(v.literal("admin"), v.literal("member")),
    token: v.string(),
    invitedByUserId: v.id("users"),
    expiresAt: v.number(),
    acceptedAt: v.optional(v.number()),
  })
    .index("by_token", ["token"])
    .index("by_tenant", ["tenantId"])
    .index("by_email", ["email"]),

  alphaSeats: defineTable({
    seatNumber: v.number(),
    tenantId: v.id("tenants"),
    userId: v.id("users"),
    claimedAt: v.number(),
    email: v.string(),
  })
    .index("by_seatNumber", ["seatNumber"])
    .index("by_tenant", ["tenantId"]),

  appSettings: defineTable({
    key: v.literal("global"),
    registrationOpen: v.boolean(),
    alphaSeatCap: v.number(),
    alphaSeatsClaimed: v.number(),
    maintenanceBanner: v.optional(v.string()),
    resendMode: v.union(v.literal("live"), v.literal("noop")),
    updatedByUserId: v.optional(v.id("users")),
    updatedAt: v.number(),
  }).index("by_key", ["key"]),

  configurators: defineTable({
    tenantId: v.id("tenants"),
    publicId: v.string(),
    name: v.string(),
    status: v.union(v.literal("draft"), v.literal("published"), v.literal("archived")),
    allowedOrigins: v.array(v.string()),
    defaultLocale: v.string(),
    defaultTheme: v.union(v.literal("light"), v.literal("dark"), v.literal("auto")),
    vatRatePercent: v.number(),
    priceRoundingStep: v.number(),
    showPricesToEndUser: v.boolean(),
    currency: v.literal("EUR"),
    publishedAt: v.optional(v.number()),
    publishedCatalogVersion: v.optional(v.number()),
    createdAt: v.optional(v.number()),
    updatedAt: v.optional(v.number()),
    updatedByUserId: v.optional(v.id("users")),
  })
    .index("by_tenant", ["tenantId"])
    .index("by_publicId", ["publicId"])
    .index("by_tenant_status", ["tenantId", "status"]),

  branding: defineTable({
    tenantId: v.id("tenants"),
    configuratorId: v.id("configurators"),
    whiteLabel: v.boolean(),
    logoStorageId: v.optional(v.id("_storage")),
    logoLightStorageId: v.optional(v.id("_storage")),
    colorAccent: v.string(),
    colorAccentInk: v.string(),
    colorBg: v.optional(v.string()),
    colorBgDark: v.optional(v.string()),
    fontFamily: v.union(v.literal("space-grotesk"), v.literal("inter"),
                        v.literal("geist"), v.literal("system")),
    copy: v.any(),
    companyInfo: v.object({
      name: v.string(),
      vatId: v.optional(v.string()),
      address: v.optional(v.string()),
      phone: v.optional(v.string()),
      email: v.optional(v.string()),
    }),
  })
    .index("by_configurator", ["configuratorId"])
    .index("by_tenant", ["tenantId"]),

  catalogMaterials: defineTable({
    tenantId: v.id("tenants"),
    configuratorId: v.id("configurators"),
    key: v.string(),
    labels: v.any(),
    basePerM2Cents: v.number(),
    profilePerMlCents: v.number(),
    uFrameBase: v.optional(v.number()),
    sortOrder: v.number(),
    enabled: v.boolean(),
  })
    .index("by_configurator", ["configuratorId"])
    .index("by_configurator_key", ["configuratorId", "key"]),

  catalogQualityTiers: defineTable({
    tenantId: v.id("tenants"),
    configuratorId: v.id("configurators"),
    materialKey: v.string(),
    key: v.string(),
    labels: v.any(),
    multiplier: v.number(),
    uAdjust: v.optional(v.number()),
    sortOrder: v.number(),
    enabled: v.boolean(),
  })
    .index("by_configurator", ["configuratorId"])
    .index("by_configurator_material", ["configuratorId", "materialKey"]),

  catalogSizeConstraints: defineTable({
    tenantId: v.id("tenants"),
    configuratorId: v.id("configurators"),
    productType: v.union(v.literal("window"), v.literal("balconyDoor")),
    sashCount: v.number(),
    minWidthMm: v.number(),
    maxWidthMm: v.number(),
    minHeightMm: v.number(),
    maxHeightMm: v.number(),
  })
    .index("by_configurator", ["configuratorId"])
    .index("by_configurator_type", ["configuratorId", "productType"]),

  catalogGlazingOptions: defineTable({
    tenantId: v.id("tenants"),
    configuratorId: v.id("configurators"),
    key: v.string(),
    labels: v.any(),
    priceCents: v.number(),
    uGlass: v.optional(v.number()),
    sortOrder: v.number(),
    enabled: v.boolean(),
  }).index("by_configurator", ["configuratorId"]),

  catalogFinishOptions: defineTable({
    tenantId: v.id("tenants"),
    configuratorId: v.id("configurators"),
    key: v.string(),
    labels: v.any(),
    swatchHex: v.optional(v.string()),
    priceCents: v.number(),
    sortOrder: v.number(),
    enabled: v.boolean(),
  }).index("by_configurator", ["configuratorId"]),

  catalogHardwareOptions: defineTable({
    tenantId: v.id("tenants"),
    configuratorId: v.id("configurators"),
    kind: v.union(v.literal("hardware"), v.literal("hardwareColor"),
                  v.literal("sashType"), v.literal("screen"),
                  v.literal("threshold"), v.literal("misc")),
    key: v.string(),
    labels: v.any(),
    priceCents: v.number(),
    appliesToOperableOnly: v.boolean(),
    sortOrder: v.number(),
    enabled: v.boolean(),
  })
    .index("by_configurator", ["configuratorId"])
    .index("by_configurator_kind", ["configuratorId", "kind"]),

  catalogVersions: defineTable({
    tenantId: v.id("tenants"),
    configuratorId: v.id("configurators"),
    version: v.number(),
    publishedByUserId: v.id("users"),
    publishedAt: v.number(),
    payload: v.any(),
    changeNote: v.optional(v.string()),
  })
    .index("by_configurator", ["configuratorId"])
    .index("by_configurator_version", ["configuratorId", "version"]),

  quoteRequests: defineTable({
    tenantId: v.id("tenants"),
    configuratorId: v.id("configurators"),
    catalogVersion: v.number(),
    publicId: v.string(),
    leadName: v.string(),
    leadEmail: v.string(),
    leadPhone: v.optional(v.string()),
    leadCompany: v.optional(v.string()),
    leadMessage: v.optional(v.string()),
    leadLocale: v.string(),
    items: v.any(),
    priceCents: v.number(),
    priceExVatCents: v.number(),
    vatRatePercent: v.number(),
    currency: v.literal("EUR"),
    clientReportedPriceCents: v.optional(v.number()),
    status: v.union(v.literal("new"), v.literal("contacted"), v.literal("quoted"),
                    v.literal("won"), v.literal("lost"), v.literal("spam")),
    assignedToUserId: v.optional(v.id("users")),
    internalNotes: v.optional(v.string()),
    sourceOrigin: v.optional(v.string()),
    sourceIpHash: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    turnstileVerified: v.optional(v.boolean()),
    spamScore: v.optional(v.number()),
  })
    .index("by_tenant", ["tenantId"])
    .index("by_tenant_status", ["tenantId", "status"])
    .index("by_configurator", ["configuratorId"])
    .index("by_ipHash", ["sourceIpHash"]),

  notifications: defineTable({
    tenantId: v.id("tenants"),
    userId: v.id("users"),
    type: v.union(v.literal("quote_request_new"), v.literal("quote_status_changed"),
                  v.literal("member_joined"), v.literal("configurator_published"),
                  v.literal("system")),
    title: v.string(),
    body: v.optional(v.string()),
    href: v.optional(v.string()),
    entityTable: v.optional(v.string()),
    entityId: v.optional(v.string()),
    readAt: v.optional(v.number()),
    seenAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_user_unread", ["userId", "readAt"])
    .index("by_tenant", ["tenantId"]),

  emailLog: defineTable({
    tenantId: v.optional(v.id("tenants")),
    to: v.string(),
    template: v.union(v.literal("verify"), v.literal("reset"),
                      v.literal("welcome_alpha"), v.literal("welcome"),
                      v.literal("new_quote_request"), v.literal("admin_resend")),
    subject: v.string(),
    status: v.union(v.literal("queued"), v.literal("sent"),
                    v.literal("noop"), v.literal("failed")),
    resendId: v.optional(v.string()),
    error: v.optional(v.string()),
    bodyPreview: v.optional(v.string()),
    relatedEntityId: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_tenant", ["tenantId"])
    .index("by_to", ["to"]),

  auditLog: defineTable({
    tenantId: v.optional(v.id("tenants")),
    actorUserId: v.optional(v.id("users")),
    actorKind: v.union(v.literal("user"), v.literal("admin"),
                       v.literal("system"), v.literal("widget")),
    action: v.string(),
    targetTable: v.optional(v.string()),
    targetId: v.optional(v.string()),
    meta: v.optional(v.any()),
    ip: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_tenant", ["tenantId"])
    .index("by_action", ["action"])
    .index("by_target", ["targetTable", "targetId"]),

  usageCounters: defineTable({
    tenantId: v.id("tenants"),
    period: v.string(),
    quoteRequestsCount: v.number(),
    activeConfiguratorsCount: v.number(),
  }).index("by_tenant_period", ["tenantId", "period"]),

  rateLimits: defineTable({
    bucketKey: v.string(),
    tokens: v.number(),
    updatedAt: v.number(),
  }).index("by_key", ["bucketKey"]),

  // Subscription & Billing
  subscriptions: defineTable({
    tenantId: v.id("tenants"),
    stripeCustomerId: v.string(),
    stripeSubscriptionId: v.optional(v.string()),
    stripePriceId: v.optional(v.string()),
    plan: v.union(v.literal("freemium"), v.literal("starter"), v.literal("business"), v.literal("enterprise"), v.literal("alpha")),
    status: v.union(v.literal("trialing"), v.literal("active"), v.literal("past_due"), v.literal("canceled"), v.literal("incomplete"), v.literal("incomplete_expired"), v.literal("paused")),
    currentPeriodStart: v.number(),
    currentPeriodEnd: v.number(),
    cancelAtPeriodEnd: v.boolean(),
    canceledAt: v.optional(v.number()),
    trialStart: v.optional(v.number()),
    trialEnd: v.optional(v.number()),
    stripeCurrentPeriodStart: v.optional(v.number()),
    stripeCurrentPeriodEnd: v.optional(v.number()),
    metadata: v.optional(v.any()),
  })
    .index("by_tenant", ["tenantId"])
    .index("by_stripe_customer", ["stripeCustomerId"])
    .index("by_stripe_subscription", ["stripeSubscriptionId"]),

  invoices: defineTable({
    tenantId: v.id("tenants"),
    stripeInvoiceId: v.string(),
    stripeSubscriptionId: v.optional(v.string()),
    amountDue: v.number(),
    amountPaid: v.number(),
    amountRemaining: v.number(),
    currency: v.string(),
    status: v.union(v.literal("draft"), v.literal("open"), v.literal("paid"), v.literal("uncollectible"), v.literal("void")),
    invoiceUrl: v.optional(v.string()),
    invoicePdf: v.optional(v.string()),
    periodStart: v.number(),
    periodEnd: v.number(),
    dueDate: v.optional(v.number()),
    paidAt: v.optional(v.number()),
    metadata: v.optional(v.any()),
  })
    .index("by_tenant", ["tenantId"])
    .index("by_stripe_invoice", ["stripeInvoiceId"])
    .index("by_stripe_subscription", ["stripeSubscriptionId"]),

  paymentMethods: defineTable({
    tenantId: v.id("tenants"),
    stripePaymentMethodId: v.string(),
    type: v.string(),
    cardBrand: v.optional(v.string()),
    cardLast4: v.optional(v.string()),
    cardExpMonth: v.optional(v.number()),
    cardExpYear: v.optional(v.number()),
    isDefault: v.boolean(),
    metadata: v.optional(v.any()),
  })
    .index("by_tenant", ["tenantId"])
    .index("by_stripe_pm", ["stripePaymentMethodId"]),

  subscriptionPlans: defineTable({
    key: v.string(), // "freemium", "starter", "business", "enterprise", "alpha"
    name: v.string(),
    description: v.string(),
    stripePriceIdMonthly: v.optional(v.string()),
    stripePriceIdYearly: v.optional(v.string()),
    priceMonthlyCents: v.number(),
    priceYearlyCents: v.number(),
    currency: v.string(),
    trialDays: v.number(),
    features: v.array(v.string()),
    limits: v.object({
      maxConfigurators: v.number(),
      maxQuotesPerMonth: v.number(),
      maxTeamMembers: v.number(),
      whiteLabel: v.boolean(),
      customDomain: v.boolean(),
      apiAccess: v.boolean(),
      prioritySupport: v.boolean(),
    }),
    isActive: v.boolean(),
    sortOrder: v.number(),
  })
    .index("by_key", ["key"]),

  webhookEvents: defineTable({
    stripeEventId: v.string(),
    type: v.string(),
    processed: v.boolean(),
    error: v.optional(v.string()),
    payload: v.any(),
    receivedAt: v.number(),
    processedAt: v.optional(v.number()),
  })
    .index("by_stripe_event", ["stripeEventId"])
    .index("by_type", ["type"]),

  // PDF Quotes
  pdfQuotes: defineTable({
    tenantId: v.id("tenants"),
    quoteRequestId: v.id("quoteRequests"),
    configuratorId: v.id("configurators"),
    storageId: v.id("_storage"),
    fileName: v.string(),
    fileSize: v.number(),
    generatedAt: v.number(),
    metadata: v.optional(v.any()),
  })
    .index("by_tenant", ["tenantId"])
    .index("by_quote_request", ["quoteRequestId"])
    .index("by_configurator", ["configuratorId"]),

  // Cron Job Tracking
  cronJobs: defineTable({
    name: v.string(),
    status: v.union(v.literal("scheduled"), v.literal("running"), v.literal("completed"), v.literal("failed")),
    lastRunAt: v.optional(v.number()),
    nextRunAt: v.optional(v.number()),
    lastError: v.optional(v.string()),
    runCount: v.number(),
    metadata: v.optional(v.any()),
  })
    .index("by_name", ["name"])
    .index("by_status", ["status"]),

  // Import/Export Jobs
  importJobs: defineTable({
    tenantId: v.id("tenants"),
    userId: v.id("users"),
    type: v.union(v.literal("catalog_materials"), v.literal("catalog_quality"), v.literal("catalog_sizes"), v.literal("catalog_glazing"), v.literal("catalog_finish"), v.literal("catalog_hardware"), v.literal("full_catalog")),
    status: v.union(v.literal("pending"), v.literal("processing"), v.literal("completed"), v.literal("failed")),
    fileName: v.string(),
    fileSize: v.number(),
    totalRows: v.number(),
    processedRows: v.number(),
    failedRows: v.number(),
    errors: v.array(v.string()),
    mapping: v.optional(v.any()),
    storageId: v.optional(v.id("_storage")),
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("by_tenant", ["tenantId"])
    .index("by_user", ["userId"])
    .index("by_status", ["status"]),

  exportJobs: defineTable({
    tenantId: v.id("tenants"),
    userId: v.id("users"),
    type: v.union(v.literal("catalog_materials"), v.literal("catalog_quality"), v.literal("catalog_sizes"), v.literal("catalog_glazing"), v.literal("catalog_finish"), v.literal("catalog_hardware"), v.literal("full_catalog"), v.literal("quotes")),
    status: v.union(v.literal("pending"), v.literal("processing"), v.literal("completed"), v.literal("failed")),
    format: v.union(v.literal("csv"), v.literal("json"), v.literal("xlsx")),
    fileName: v.string(),
    storageId: v.optional(v.id("_storage")),
    totalRows: v.number(),
    filters: v.optional(v.any()),
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("by_tenant", ["tenantId"])
    .index("by_user", ["userId"])
    .index("by_status", ["status"]),
});