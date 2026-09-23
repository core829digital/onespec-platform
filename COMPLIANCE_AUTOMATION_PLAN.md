# OneSpec Platform — Compliance Automation Evaluation & 90-Day Calendar

**Date:** 2025-09-22  
**Status:** DRAFT — For internal review  
**Audience:** Founders, CTO, Legal  

> **Corrected 2026-09-23**: the Cross-Border Data Transfers table originally claimed "✅ Documented" for SCC/DPF mechanisms that have no actual document in this repo — corrected below. "Purchase Drata" was also softened from an already-decided action to the founder's pending decision it actually is. The Vanta/Drata/SecureFrame comparison, 90-day calendar structure, and jurisdiction checklist are reasonable planning frameworks — treat every "✅"/"Implemented" in this document as a claim to verify, not a fact, before acting on it or showing it to anyone external.

---

## 1. Compliance Automation Platform Evaluation

### Comparison: Vanta vs Drata vs SecureFrame

| Criteria | Vanta | Drata | SecureFrame |
|----------|-------|-------|-------------|
| **SOC 2 Type II** | ✅ Native | ✅ Native | ✅ Native |
| **ISO 27001** | ✅ | ✅ | ✅ |
| **GDPR** | ✅ (via policies) | ✅ (via policies) | ✅ (via policies) |
| **HIPAA** | ✅ | ✅ | ✅ |
| **EU AI Act** | ❌ | ❌ | ❌ (emerging) |
| **Integrations** | 300+ | 200+ | 150+ |
| - AWS/GCP/Azure | ✅ | ✅ | ✅ |
| - GitHub/GitLab | ✅ | ✅ | ✅ |
| - Convex | ❌ | ❌ | ❌ |
| - Vercel | ✅ | ✅ | ✅ |
| - PostHog/Sentry | ✅ | ✅ | ✅ |
| - Resend | ❌ | ❌ | ❌ |
| **Automated Evidence** | Excellent | Good | Good |
| **Policy Templates** | Comprehensive | Good | Basic |
| **Vendor Risk Mgmt** | ✅ | ✅ | ✅ |
| **Employee Onboarding** | ✅ | ✅ | ✅ |
| **Pricing (Annual)** | ~$20-30k | ~$15-25k | ~$10-20k |
| **Implementation Time** | 2-4 weeks | 2-4 weeks | 1-3 weeks |
| **Best For** | Enterprise, fast audit | Mid-market, speed | Cost-conscious, startup |

### Recommendation: **Drata**

**Rationale:**
- Best price/value for Series A/B SaaS
- Strong automated evidence collection (GitHub, Vercel, AWS)
- Good policy templates for SOC 2 + ISO 27001
- Faster implementation than Vanta
- SecureFrame is cheaper but less mature integrations

**Required Integrations to Configure:**
- ✅ GitHub (code review, branch protection, secrets scanning)
- ✅ Vercel (deployment logs, env vars)
- ✅ AWS (if used for Convex/S3)
- ❌ Convex (no native integration — manual evidence)
- ❌ Resend (no native integration — manual evidence)
- ❌ Convex (no native integration — manual evidence)

---

## 2. 90-Day Compliance Calendar (Q4 2025)

| Week | Dates | Milestone | Owner | Deliverable |
|------|-------|-----------|-------|-------------|
| **1-2** | Sep 22 - Oct 5 | **Kickoff & Tool Setup** | CTO + CISO | Drata account, integrations connected |
| **3-4** | Oct 6 - Oct 19 | **Policy Gap Analysis** | Legal + CTO | Policy inventory, gap report |
| **5-6** | Oct 20 - Nov 2 | **Policy Authoring** | Legal | 15 core policies drafted |
| **7** | Nov 3 - Nov 9 | **Policy Review** | Founders + Legal | Approved policy pack v1.0 |
| **8-9** | Nov 10 - Nov 23 | **Evidence Collection (Auto)** | CTO + Drata | 80% evidence auto-collected |
| **10** | Nov 24 - Nov 30 | **Evidence Collection (Manual)** | CTO + Eng | Convex, Resend, Stripe evidence |
| **11-12** | Dec 1 - Dec 14 | **Control Implementation** | Eng + Ops | Remaining controls implemented |
| **13** | Dec 15 - Dec 21 | **Internal Audit** | CISO | Pre-audit readiness report |
| **14** | Dec 22 - Dec 28 | **Remediation** | All | Fix findings |
| **15** | Dec 29 - Jan 4 | **Auditor Engagement** | Legal | Auditor selected, kickoff |
| **16** | Jan 5 - Jan 18 | **SOC 2 Type I Audit** | Auditor | Audit fieldwork |
| **17** | Jan 19 - Feb 1 | **Report & Remediation** | All | Type I report, fix findings |
| **18** | Feb 2 - Feb 15 | **Type II Readiness** | All | Controls operating effectively |

### Key Dependencies
- **Convex evidence:** Manual export of audit logs, schema, RLS policies
- **Resend evidence:** Webhook delivery logs, suppression lists
- **Stripe evidence:** Webhook handling, idempotency, PCI SAQ
- **Vercel evidence:** Build logs, env var audit, middleware config
- **GitHub evidence:** Branch protection, CODEOWNERS, secret scanning, dependabot

---

## 3. Jurisdiction Compliance Checklist

OneSpec operates in 6 markets. Each requires specific compliance attention.

| Jurisdiction | Regulation | Status | Evidence Required | Review Date |
|--------------|------------|--------|-------------------|-------------|
| **Italy (IT)** | GDPR, ePrivacy, EAA, NIS2 | ⚠️ Partial | DPIA, DPA, cookie banner, EAA self-assessment | Q1 2026 |
| **France (FR)** | GDPR, ePrivacy, EAA, LPM | ⚠️ Partial | DPIA, DPA, cookie banner, EAA self-assessment | Q1 2026 |
| **Belgium (BE)** | GDPR, ePrivacy, EAA, NIS2 | ⚠️ Partial | DPIA, DPA, cookie banner, EAA self-assessment | Q1 2026 |
| **Netherlands (NL)** | GDPR, ePrivacy, EAA, NIS2 | ⚠️ Partial | DPIA, DPA, cookie banner, EAA self-assessment | Q1 2026 |
| **Germany (DE)** | GDPR, ePrivacy, EAA, BDSG, TTDSG | ⚠️ Partial | DPIA, DPA, cookie banner, EAA self-assessment, TTDSG consent | Q1 2026 |
| **Luxembourg (LU)** | GDPR, ePrivacy, EAA | ⚠️ Partial | DPIA, DPA, cookie banner, EAA self-assessment | Q1 2026 |

### Market-Specific Requirements

| Market | Unique Requirement | Implementation Status |
|--------|-------------------|----------------------|
| **IT** | ENEA Allegato F XML, FatturaPA | ✅ Implemented |
| **FR** | MaPrimeRénov', RGE cert, TVA 5.5%/10% | ✅ Implemented |
| **BE** | Primes, Uw ≤ 1.5, Renson grilles | ✅ Implemented |
| **NL** | Transparent widget mode, IsoStone, HVL 90° | ✅ Implemented |
| **DE** | RC2/RC3, RAL-Montage, GAEB export | ✅ Implemented |
| **LU** | TVA 3%, bilingual DE/FR, Klimabonus | ✅ Implemented |

### Cross-Border Data Transfers

| Transfer | Mechanism (what would apply if used) | Status |
|----------|-----------|--------|
| EU → US (Convex, Vercel, Sentry, Resend) | SCC 2021 + Supplementary Measures | ❌ **Not actually documented anywhere in this repo** — no SCC/TIA file exists. This row previously claimed "✅ Documented"; corrected 2026-09-23 after checking. Needs real legal drafting before it can be marked done. |
| EU → US (Stripe) | SCC 2021 + DPF | N/A — **Stripe is dormant, not configured/live**, no transfer is currently happening |
| EU → EU (PostHog EU) | GDPR Art. 28 DPA | ⚠️ PostHog + Sentry are now listed as sub-processors in `src/content/legal.ts` (fixed 2026-09-23); no separate signed DPA with either vendor is on file here — check the vendor's own DPA terms and countersign if required |

---

## 4. Policy Inventory (15 Core Policies)

| # | Policy | Framework | Status | Owner | Review Cycle |
|---|--------|-----------|--------|-------|--------------|
| 1 | Information Security Policy | SOC 2, ISO 27001 | 🟡 Draft | CISO | Annual |
| 2 | Access Control Policy | SOC 2, ISO 27001 | 🟡 Draft | CISO | Annual |
| 3 | Incident Response Plan | SOC 2, ISO 27001 | 🟡 Draft | CISO | Annual |
| 4 | Business Continuity / DR | SOC 2, ISO 27001 | 🟡 Draft | CTO | Annual |
| 5 | Vendor Risk Management | SOC 2, ISO 27001 | 🟡 Draft | CISO | Annual |
| 6 | Data Classification & Handling | GDPR, ISO 27001 | 🟡 Draft | DPO | Annual |
| 7 | Data Retention & Disposal | GDPR, SOC 2 | 🟡 Draft | DPO | Annual |
| 8 | Acceptable Use Policy | SOC 2 | 🟡 Draft | HR | Annual |
| 9 | Secure Development (SDLC) | SOC 2, ISO 27001 | 🟡 Draft | CTO | Annual |
| 10 | Change Management | SOC 2, ISO 27001 | 🟡 Draft | CTO | Annual |
| 11 | Encryption & Key Management | SOC 2, ISO 27001 | 🟡 Draft | CTO | Annual |
| 12 | Physical Security | ISO 27001 | 🟡 Draft | Ops | Annual |
| 13 | Privacy Policy (External) | GDPR, ePrivacy | ✅ Published | Legal | Quarterly |
| 14 | Cookie Policy (External) | ePrivacy | ✅ Published | Legal | Quarterly |
| 15 | DPA / Data Processing Addendum | GDPR Art. 28 | ✅ Published | Legal | Annual |

---

## 5. Evidence Collection Checklist (Drata)

### Automated (Drata Native)
- [ ] GitHub: Branch protection, CODEOWNERS, required reviews
- [ ] GitHub: Secret scanning enabled, dependabot alerts
- [ ] GitHub: Dependabot auto-merge for security patches
- [ ] Vercel: Build/deploy logs, environment variable audit
- [ ] Vercel: Middleware security headers
- [ ] AWS (if applicable): CloudTrail, Config, GuardDuty
- [ ] GitHub: SAML/SSO enforced, 2FA required

### Manual (Convex/Resend/Stripe/PostHog)
- [ ] **Convex:** Schema export, RLS policies, audit log retention
- [ ] **Convex:** Auth config (passkeys, OAuth providers, session TTL)
- [ ] **Convex:** Audit log schema, admin actions logged
- [ ] **Resend:** Webhook endpoint, HMAC verification, delivery logs
- [ ] **Resend:** Suppression list management, bounce/complaint handling
- [ ] **Resend:** Dedicated domains (purchases@, noreply@) configured
- [ ] **Stripe:** Webhook endpoint, signature verification, idempotency
- [ ] **Stripe:** PCI SAQ A compliance, card data never touches app
- [ ] **PostHog:** Session replay config, PII scrubbing rules
- [ ] **Sentry:** Replay config (10% session, 100% error), PII scrubbing
- [ ] **Sentry:** Alert rules (error rate, rage clicks, performance)

### Documentation
- [ ] System architecture diagram (data flows, trust boundaries)
- [ ] Data flow diagram (personal data, cross-border)
- [ ] Risk assessment (asset register, threat model)
- [ ] Penetration test report (annual)
- [ ] Vulnerability scan reports (quarterly)

---

## 6. Next Actions

| Action | Owner | Due | Blockers |
|--------|-------|-----|----------|
| **Decide** whether to purchase Drata (or Vanta/SecureFrame) — this is the founder's call, not yet approved | Founder | Week 1 | Budget approval — pending decision |
| Connect GitHub + Vercel to Drata | CTO | Week 1 | None |
| Draft 15 core policies | Legal + CISO | Weeks 3-6 | Legal bandwidth |
| Configure Convex manual evidence | CTO + Eng | Week 8-9 | Convex API access |
| Configure Resend evidence | CTO + Eng | Week 8-9 | Resend webhook |
| Schedule pen test | CISO | Month 3 | Vendor selection |
| Schedule SOC 2 auditor | Legal | Month 4 | Auditor availability |

---

*Document version: 1.0*  
*Next review: 2025-10-06 (Week 2 check-in)*