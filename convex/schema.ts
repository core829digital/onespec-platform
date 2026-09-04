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
    /** Best-effort ISO-3166-1 alpha-2, captured at sign-up (geo header / Accept-Language). */
    country: v.optional(v.string()),
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
                  v.literal("business"), v.literal("enterprise")),
    planStatus: v.union(v.literal("active"), v.literal("trialing"),
                        v.literal("past_due"), v.literal("suspended")),
    alphaDiscountLocked: v.boolean(),
    suspendedAt: v.optional(v.number()),
    suspendedReason: v.optional(v.string()),
    createdVia: v.union(v.literal("alpha_signup"), v.literal("open_signup"),
                        v.literal("admin_created")),
    createdAt: v.optional(v.number()),
    updatedAt: v.optional(v.number()),
    updatedByUserId: v.optional(v.id("users")),
    /** Guided-onboarding progress. `onboardingCompletedAt` set when the user finishes the wizard. */
    onboardingStep: v.optional(v.string()),
    onboardingCompletedAt: v.optional(v.number()),
    // Billing — populated only once Stripe is configured and a subscription exists.
    stripeCustomerId: v.optional(v.string()),
    stripeSubscriptionId: v.optional(v.string()),
    subscriptionCurrentPeriodEnd: v.optional(v.number()),
    subscriptionCancelAtPeriodEnd: v.optional(v.boolean()),
  })
    .index("by_slug", ["slug"])
    .index("by_owner", ["ownerUserId"])
    .index("by_alphaSeatNumber", ["alphaSeatNumber"])
    .index("by_stripeCustomer", ["stripeCustomerId"]),

  /** Stripe webhook events — idempotency guard + billing audit trail. */
  billingEvents: defineTable({
    stripeEventId: v.string(),
    type: v.string(),
    tenantId: v.optional(v.id("tenants")),
    payloadSummary: v.optional(v.any()),
    receivedAt: v.number(),
  }).index("by_event", ["stripeEventId"]),

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
    /** Incentive policy shown in the widget — dealer-controlled, not end-user. */
    ecobonusEnabled: v.optional(v.boolean()),
    ecobonusMaxPercent: v.optional(v.number()),
    discountEnabled: v.optional(v.boolean()),
    discountMaxPercent: v.optional(v.number()),
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

  /** Profile systems / brands per material (Aluplast, Rehau, …) with a price multiplier. */
  catalogProfileSystems: defineTable({
    tenantId: v.id("tenants"),
    configuratorId: v.id("configurators"),
    materialKey: v.string(),
    key: v.string(),
    labels: v.any(),
    multiplier: v.number(),
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
                  v.literal("sashType"), v.literal("screen"), v.literal("screenColor"),
                  v.literal("installation"), v.literal("poseType"),
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
    customerAddress: v.optional(v.string()),
    customerCity: v.optional(v.string()),
    customerPostalCode: v.optional(v.string()),
    channel: v.optional(v.union(v.literal("widget"), v.literal("field_b2b"), v.literal("manual"), v.literal("api"))),
    installationType: v.optional(v.string()),
    installationPriceCents: v.optional(v.number()),
    demolitionPriceCents: v.optional(v.number()),
    discountPercent: v.optional(v.number()),
    ecobonusPercent: v.optional(v.number()),
    ecobonusDeductionCents: v.optional(v.number()),
    profitMarginPercent: v.optional(v.number()),
    depositTerms: v.optional(v.string()),
    signatureDataUrl: v.optional(v.string()),
    signedAt: v.optional(v.number()),
    signedByName: v.optional(v.string()),
    // Regional Country Phase fields (FR, BE, NL, DE, LU)
    regionCode: v.optional(v.string()),
    poseType: v.optional(v.string()), // FR DTU 36.5 (renovation, feuillure, applique, tunnel)
    rgeCertificate: v.optional(v.string()), // FR RGE Cert
    maPrimeRenovPercent: v.optional(v.number()), // FR Subsidies
    maPrimeRenovDeductionCents: v.optional(v.number()),
    decennaleInsurance: v.optional(v.string()), // FR Assurance Decennale
    rensonGrilleWidthMm: v.optional(v.number()), // BE Renson Invisivent ventilation grilles
    voletMonoblocHeightMm: v.optional(v.number()), // BE/DE Rolling shutter box
    hvlJointCount: v.optional(v.number()), // NL HVL 90 deg corner joints
    isostoneSill: v.optional(v.boolean()), // NL Synthetic stone sill
    ralMontage: v.optional(v.boolean()), // DE/LU RAL montage system
    rcSecurityLevel: v.optional(v.string()), // DE/LU RC2 / RC3 security grade
    klimabonusEligible: v.optional(v.boolean()), // LU Klimabonus
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
    /** Accepted while the tenant was over its monthly quota (lead never lost). */
    overQuota: v.optional(v.boolean()),
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
                  v.literal("plan_limit"), v.literal("system")),
    /** Pre-rendered Italian title — fallback for rows written before i18n. */
    title: v.string(),
    body: v.optional(v.string()),
    /** Structured payload so the client can render a localized title. */
    data: v.optional(v.any()),
    href: v.optional(v.string()),
    entityTable: v.optional(v.string()),
    entityId: v.optional(v.string()),
    readAt: v.optional(v.number()),
    seenAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_user_unread", ["userId", "readAt"])
    .index("by_tenant", ["tenantId"]),

  /** Catalog CSV imports — keeps a pre-import snapshot so an import can be undone. */
  catalogImports: defineTable({
    tenantId: v.id("tenants"),
    configuratorId: v.id("configurators"),
    target: v.union(
      v.literal("materials"),
      v.literal("glazing"),
      v.literal("finish"),
      v.literal("hardware"),
    ),
    importedByUserId: v.id("users"),
    importedAt: v.number(),
    summary: v.object({ created: v.number(), updated: v.number(), rejected: v.number() }),
    /** Full rows of the target table as they were immediately before the import. */
    snapshot: v.any(),
    undone: v.boolean(),
    undoneAt: v.optional(v.number()),
  })
    .index("by_configurator", ["configuratorId"]),

  /** GDPR — pending account-deletion requests (soft, with a grace window). */
  deletionRequests: defineTable({
    userId: v.id("users"),
    email: v.string(),
    reason: v.optional(v.string()),
    status: v.union(v.literal("pending"), v.literal("cancelled"), v.literal("completed")),
    requestedAt: v.number(),
    scheduledFor: v.number(),
    resolvedAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_status", ["status"]),

  /** Alpha-phase feedback + bug reports. */
  alphaFeedback: defineTable({
    tenantId: v.optional(v.id("tenants")),
    userId: v.id("users"),
    category: v.union(v.literal("bug"), v.literal("feature"), v.literal("general")),
    message: v.string(),
    pagePath: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    status: v.union(v.literal("new"), v.literal("triaged"), v.literal("closed")),
    createdAt: v.number(),
  })
    .index("by_status", ["status"])
    .index("by_user", ["userId"]),

  /** GDPR — explicit, revocable consents, kept separate from auth + prefs. */
  userConsents: defineTable({
    userId: v.id("users"),
    productUpdates: v.boolean(),
    marketing: v.boolean(),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),

  /** Per-user notification channel preferences. Absent row = everything on. */
  notificationPrefs: defineTable({
    userId: v.id("users"),
    /** notification `type` values the user has switched OFF for the in-app inbox. */
    mutedInApp: v.array(v.string()),
    /** notification `type` values the user has switched OFF for email. */
    mutedEmail: v.array(v.string()),
    timezone: v.optional(v.string()),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),

  emailLog: defineTable({
    tenantId: v.optional(v.id("tenants")),
    to: v.string(),
    template: v.union(v.literal("verify"), v.literal("reset"),
                      v.literal("welcome_alpha"), v.literal("welcome"),
                      v.literal("new_quote_request"), v.literal("invitation"),
                      v.literal("admin_resend")),
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
    /** De-duplicated widget opens for the period (per visitor session). */
    widgetViewsCount: v.optional(v.number()),
    /** Timestamp the tenant was last warned it crossed its monthly quota. */
    overQuotaNotifiedAt: v.optional(v.number()),
  }).index("by_tenant_period", ["tenantId", "period"]),

  rateLimits: defineTable({
    bucketKey: v.string(),
    tokens: v.number(),
    updatedAt: v.number(),
  }).index("by_key", ["bucketKey"]),
});