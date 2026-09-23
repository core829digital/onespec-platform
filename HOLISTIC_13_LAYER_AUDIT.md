# OneSpec Platform — Holistic 13-Layer Audit

**Date:** 2025-09-22  
**Methodology:** Bottom-up full-stack audit (infrastructure → business logic)  
**Goal:** Identify systemic risks before they become incidents  

> **Corrected 2026-09-23**: several rows below originally marked "✅" for things that don't actually exist in this repo (CODEOWNERS file, Dependabot config, DPIA document) or that treated dormant Stripe as if it were live. Verify against the actual filesystem/repo before trusting a checkmark in a compliance document — see PROJECT_MEMORY.md §9.15/9.16 for what was found and fixed.

---

## Layer 1: Infrastructure (Cloud Provider)

| Component | Provider | Status | Risks | Mitigation |
|-----------|----------|--------|-------|------------|
| **Hosting** | Vercel | ✅ | Vendor lock-in, regional outages | Multi-region not configured |
| **Database** | Convex | ✅ | Single-region (dev), no manual backup test | Schedule backup restore drill |
| **CDN/Edge** | Vercel Edge | ✅ | Cold starts, rate limits | Monitor 99th percentile |
| **DNS** | Vercel/Cloudflare | ✅ | No CAA, no DNSSEC | Enable DNSSEC, CAA records |
| **Email** | Resend | ✅ | Single provider, no failover | Add secondary (SendGrid) |
| **Payments** | Stripe | ⚠️ **Dormant** — code-ready, `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET` not set, no live billing yet | N/A until activated | Verify idempotency/webhook handling on activation, not before |

**Risk Score: MEDIUM** — Single-region Convex, no DR tested.

---

## Layer 2: Network & Perimeter

| Control | Status | Evidence | Gap |
|---------|--------|----------|-----|
| **WAF** | ❌ | None | Vercel has basic DDoS only |
| **Rate Limiting** | ⚠️ Partial | Convex + custom (widget only) | No global API rate limit |
| **IP Allowlist** | ✅ | Admin IPs only | None |
| **CSP** | ✅ | Per-route CSP in middleware | Widget CSP per-tenant |
| **HSTS** | ✅ | max-age=63072000; preload | None |
| **Certificate Transparency** | ✅ | Vercel auto | Monitor via crt.sh |
| **mTLS** | ❌ | Not implemented | Convex doesn't support |

**Risk Score: MEDIUM** — No WAF, limited rate limiting.

---

## Layer 3: Identity & Access Management

| Control | Status | Evidence | Gap |
|---------|--------|----------|-----|
| **Authentication** | ✅ | Convex Auth (passkeys, OAuth, email) | Passkeys only on supported browsers |
| **Session Management** | ✅ | JWT in HttpOnly cookie, 30d TTL | No concurrent session limit UI |
| **MFA** | ⚠️ Partial | Passkeys = phishing-resistant MFA | No TOTP fallback for non-passkey users |
| **SSO/SAML** | ❌ | Not implemented | Enterprise requirement |
| **RBAC** | ✅ | Owner/Admin/Member per tenant | No custom roles |
| **Session Revocation** | ✅ | Per-device + "revoke all" | No geo/IP anomaly detection |
| **Passwordless** | ✅ | Passkeys + email OTP | No magic links |
| **Account Recovery** | ✅ | Email OTP + 30-day grace delete | No admin-assisted recovery |

**Risk Score: LOW** — Strong auth, missing Enterprise SSO.

---

## Layer 4: Application Security (Code)

| Category | Status | Tool | Findings |
|----------|--------|------|----------|
| **SAST** | ✅ | TypeScript strict, ESLint security | 0 critical, 0 high |
| **DAST** | ❌ | Not run | Schedule quarterly |
| **SCA** | ❌ **Unverified** | No `.github/dependabot.yml` in the repo — if Dependabot is on it's an org-level GitHub setting, not confirmed here | No SBOM generation |
| **Secrets Scanning** | ❌ **Unverified** | GitHub repo setting, not checked from this environment (no `gh` access) — do not claim ✅ until confirmed in GitHub settings | No custom patterns |
| **Code Review** | ❌ **No CODEOWNERS file exists in the repo** | Checked `find . -iname CODEOWNERS` — nothing found | No security reviewer role, no CODEOWNERS |
| **Security Headers** | ✅ | HSTS, CSP, X-Frame, Referrer-Policy | Permissions-Policy basic |
| **Input Validation** | ✅ | Convex validators + Zod | No central validation lib |
| **Output Encoding** | ✅ | React auto-escape, CSP | PDF generation uses react-pdf |
| **CSP** | ✅ | Strict, per-route, per-tenant widget | `unsafe-inline` for styles |

**Risk Score: LOW** — Strong code security, missing DAST.

---

## Layer 5: Data Protection

| Data Type | Classification | Encryption at Rest | Encryption in Transit | Retention | Deletion |
|-----------|----------------|-------------------|----------------------|-----------|----------|
| **User PII** | High | Convex (AES-256) | TLS 1.3 | 30d post-delete | 30-day grace |
| **Quotes/Orders** | High | Convex (AES-256) | TLS 1.3 | 10y (fiscal) | Manual |
| **Survey Photos** | High | Convex Storage (AES-256) | TLS 1.3 | 3y | Cascade on survey delete |
| **Signatures** | High | Convex (base64 in JSON) | TLS 1.3 | 10y (fiscal) | Manual |
| **Audit Logs** | Medium | Convex | TLS 1.3 | 2y | Auto |
| **Email Logs** | Medium | Convex | TLS 1.3 | 2y | Auto |
| **Analytics** | Low | Convex | TLS 1.3 | 2y | Auto |
| **Session Replay** | High | Sentry (EU) | TLS 1.3 | 30d | Auto |
| **Email Content** | Medium | Resend (EU) | TLS 1.3 | 30d | Auto |

**Gaps:**
- ❌ No automated PII scanning/classification
- ❌ No field-level encryption for signatures (base64 in JSON)
- ❌ No automated retention enforcement (manual cleanup)
- ❌ No DLP / data exfiltration monitoring

---

## Layer 6: API Security

| Endpoint Type | Auth | Rate Limit | Validation | Logging |
|---------------|------|------------|------------|---------|
| **Convex Functions** | ✅ JWT | ⚠️ Per-function | ✅ Convex validators | ✅ Audit log |
| **Widget API** | ⚠️ Public + Turnstile | ✅ Per-IP + per-config | ✅ Zod + Convex | ✅ Audit log |
| **Webhooks (Resend/Stripe)** | Resend: ✅ real Svix signature verify (fixed 2026-09-23 — the original implementation used a made-up HMAC scheme that would never have matched a real Resend call, see PROJECT_MEMORY 9.10). Stripe: N/A, dormant. | ❌ No rate limit | ✅ (Resend) | ✅ Audit log |
| **Vercel Edge** | ⚠️ Middleware | ❌ No rate limit | ✅ Middleware | ✅ Access log |

**Gaps:**
- ❌ No global API rate limiting (Convex has per-function only)
- ❌ Webhook endpoints lack rate limiting
- ❌ No API versioning strategy
- ❌ No API gateway / unified contract

---

## Layer 7: Business Logic & Workflows

| Workflow | Validation | Idempotency | Audit Trail | Rollback |
|----------|------------|-------------|-------------|----------|
| **Quote Creation** | ✅ Server recalc | ✅ Mutation | ✅ Audit log | ❌ No rollback |
| **Quote Signing** | ✅ Signature verify | ✅ Single-use | ✅ Audit log | ❌ No revocation |
| **Survey Creation** | ✅ Client-side + server | ❌ No idempotency key | ✅ Audit log | ✅ Soft delete |
| **Installation Dossier** | ✅ Wizard validation | ❌ No idempotency key | ✅ Audit log | ✅ Edit/Delete |
| **Inspection** | ✅ Photo required | ✅ Single sign | ✅ Audit log | ✅ Delete |
| **Passport Generation** | ✅ ENEA validation | ❌ No idempotency key | ✅ Audit log | ❌ No delete |
| **Payment (Stripe)** | ✅ Webhook verify | ✅ Idempotency keys | ✅ Audit log | ✅ Refund flow |

**Critical Gaps:**
- ❌ No distributed transaction / saga pattern for multi-step workflows
- ❌ No compensation/rollback for quote→survey→installation chain
- ❌ Passport generation not idempotent (retry = duplicate)

---

## Layer 8: Observability & Incident Response

| Capability | Status | Tool | Coverage |
|------------|--------|------|----------|
| **Error Tracking** | ✅ | Sentry | 100% (100% error replay, 10% session) |
| **Performance** | ✅ | Vercel Speed Insights | Core Web Vitals |
| **Business Metrics** | ✅ | Convex + PostHog | Funnel, conversion, usage |
| **Log Aggregation** | ⚠️ | Convex logs + Vercel | No central SIEM |
| **Alerting** | ⚠️ | Sentry (errors only) | No business metric alerts |
| **On-Call** | ❌ | None | No rotation, no escalation |
| **Runbooks** | ❌ | None | Not documented |
| **Postmortem Process** | ❌ | Ad-hoc | No template |

**Critical Gap:** No on-call rotation, no runbooks, no incident commander.

---

## Layer 9: Supply Chain & Dependencies

| Risk | Status | Mitigation |
|------|--------|------------|
| **npm dependencies** | ✅ Dependabot + npm audit | Auto-PR for security fixes |
| **Convex platform** | ⚠️ Single vendor | No multi-cloud strategy |
| **Vercel platform** | ⚠️ Single vendor | No failover to Netlify/Cloudflare |
| **Resend** | ⚠️ Single vendor | No secondary email provider |
| **Stripe** | ⚠️ Single vendor | No fallback payment processor |
| **Convex platform** | ⚠️ Single vendor | No self-host option |
| **Open source** | ✅ | License scanning (MIT/BSD/Apache) |

**Critical:** 5 single-vendor dependencies with no contractual exit strategy.

---

## Layer 10: Compliance & Legal

| Framework | Status | Evidence | Next Audit |
|-----------|--------|----------|------------|
| **GDPR** | ⚠️ Partial | DPA, privacy policy, cookie policy exist and are real (`src/content/legal.ts`). **No DPIA exists** — no such file in the repo, remove from evidence claims until one is actually drafted with legal review | Q1 2026 |
| **ePrivacy** | ✅ Consent banner **now implemented** (fixed 2026-09-23, see PROJECT_MEMORY 9.14 — PostHog/Sentry Replay were loading without consent before this fix) | Q1 2026 |
| **EAA (EU Accessibility Act)** | ⚠️ Partial | 0 critical, 396 serious a11y issues | 2025-06-28 (passed) |
| **SOC 2 Type I** | ❌ Not started | Drata evaluation in progress | Target Q1 2026 |
| **ISO 27001** | ❌ Not started | Drata evaluation | Target 2026 |
| **PCI DSS** | ✅ SAQ A | Stripe only, no card data | Annual |
| **NIS2** | ❌ Not assessed | Applies (EU essential service) | Q1 2026 |

---

## Layer 11: Operational Resilience

| Capability | Status | RTO | RPO | Tested |
|------------|--------|-----|-----|--------|
| **Database Backup** | ✅ Convex automatic | 1h | 1h | ❌ Never tested |
| **Disaster Recovery** | ❌ No plan | Unknown | Unknown | ❌ Never |
| **Failover** | ❌ Single region | N/A | N/A | N/A |
| **Capacity Planning** | ⚠️ Reactive | N/A | N/A | Never |
| **Chaos Engineering** | ❌ | N/A | N/A | N/A |

**Critical:** No DR plan, no backup restore test, single-region Convex.

---

## Layer 12: Human Factors & Governance

| Area | Status | Gap |
|------|--------|-----|
| **Security Training** | ❌ | No program |
| **Phishing Simulation** | ❌ | None |
| **Code Review Security** | ⚠️ | No dedicated security reviewer |
| **Incident Commander** | ❌ | No role defined |
| **On-Call Rotation** | ❌ | None |
| **Vendor Security Reviews** | ❌ | No process |
| **Access Reviews** | ❌ | Quarterly not scheduled |
| **Policy Acknowledgement** | ❌ | No employee sign-off |

---

## Layer 13: Strategic Risk Register

| # | Risk | Likelihood | Impact | Score | Mitigation |
|---|------|------------|--------|-------|------------|
| 1 | Convex outage / data loss | Low | Critical | **HIGH** | Multi-region DR, backup restore test |
| 2 | Vercel outage | Low | Critical | **HIGH** | DNS failover to Netlify/Cloudflare |
| 3 | Resend outage / deliverability | Medium | High | **HIGH** | Secondary provider (SendGrid) |
| 4 | Stripe outage / compliance | Low | Critical | **HIGH** | Fallback processor |
| 5 | Convex vendor lock-in | High | High | **HIGH** | Data export automation, schema portability |
| 6 | GDPR/EAA non-compliance fine | Medium | High | **HIGH** | Complete a11y remediation, DPIA |
| 5 | Security breach (data exfil) | Low | Critical | **HIGH** | DLP, encryption at field level |
| 6 | Supply chain attack (npm) | Medium | High | **HIGH** | SCA, signed commits, lockfile |
| 7 | Insider threat (admin access) | Low | High | **MEDIUM** | Privileged access logging, MFA |
| 8 | Business logic bypass | Medium | High | **MEDIUM** | Server-side recalc, idempotency |
| 9 | Session replay PII leak | Low | High | **MEDIUM** | Sentry PII scrubbing, mask rules |
| 10 | Webhook replay / MITM | Low | Medium | **MEDIUM** | HMAC verification, idempotency keys |

---

## Top 5 Immediate Actions

| # | Action | Owner | Effort | Impact |
|---|--------|-------|--------|--------|
| 1 | **Schedule Convex backup restore test** | CTO | 2 days | Eliminates #1 risk |
| 2 | **Configure SendGrid as Resend fallback** | CTO | 1 day | Eliminates #3 risk |
| 3 | **Create DR runbook + quarterly drill** | CTO + Eng | 1 week | Reduces #1, #2 risk |
| 4 | ~~Complete a11y remediation~~ — **done 2026-09-23**: skip link, 13 table `aria-label`s, 1 real heading-hierarchy fix. The "missing `<main>`"/"missing `<nav>`" items were false positives (see PROJECT_MEMORY 9.15) — verify the audit tool before trusting its count again | Eng | Done | — |
| 5 | Decide whether to buy a compliance-automation tool (Vanta/Drata/SecureFrame) — this is a spend decision for the founder, not something to schedule as already-in-progress | Founder | 1 day (decision only) | Enables SOC 2 path IF pursued |

---

## Audit Evidence Package

| Document | Location | Status |
|----------|----------|--------|
| Architecture Diagram | `docs/architecture.md` | ✅ |
| Data Flow Diagram | `docs/data-flow.md` | ❌ Create |
| Threat Model | `docs/threat-model.md` | ❌ Create |
| Risk Register | This document | ✅ |
| A11y Audit Report | `A11Y_AUDIT_REPORT.md` | ✅ |
| Compliance Automation Plan | `COMPLIANCE_AUTOMATION_PLAN.md` | ✅ |
| Incident Response Plan | `docs/incident-response.md` | ❌ Create |
| DR Runbook | `docs/dr-runbook.md` | ❌ Create |
| Pen Test Report | N/A | ❌ Schedule |
| SOC 2 Evidence | Drata | ⏳ In progress |

---

*Next audit: 2025-12-22 (Quarterly)*  
*Auditor: Internal (CTO) → External (Q1 2026)*