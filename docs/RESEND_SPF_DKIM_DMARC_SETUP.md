# Resend SPF/DKIM/DMARC Setup for `onespec.eu`

**Goal:** Configure authenticated email for `purchases@onespec.eu` and `noreply@onespec.eu`  
**Provider:** Resend  
**Domain:** `onespec.eu`  

> **Security note (2026-09-28):** this doc originally contained a real, live
> `RESEND_API_KEY` value in plaintext (3 places below). It has been redacted
> to `re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` before this file was moved into
> `docs/`. **That key should be rotated in the Resend Dashboard** (Settings →
> API Keys) if it wasn't already, since it lived unredacted in this file at
> the repo root for a while before this move.

---

## Required DNS Records

Add these records in your DNS provider (Cloudflare, Vercel DNS, Route53, etc.)

---

### 1. SPF Record (TXT)

**Type:** TXT  
**Name/Host:** `@` (or `onespec.eu`)  
**Value:**
```
v=spf1 include:_spf.resend.com ~all
```

**If you already have SPF:** Merge with existing:
```
v=spf1 include:_spf.google.com include:_spf.resend.com ~all
```

**TTL:** 3600 (1 hour) or provider default

---

### 2. DKIM Records (CNAME) — Two Records

Resend provides two DKIM keys. Add both as CNAME records.

**Record 1:**
- **Type:** CNAME
- **Name/Host:** `resend._domainkey`
- **Value/Target:** `resend._domainkey.resend.com`
- **TTL:** 3600

**Record 2:**
- **Type:** CNAME
- **Name/Host:** `resend2._domainkey`
- **Value/Target:** `resend2._domainkey.resend.com`
- **TTL:** 3600

> **Note:** In Resend Dashboard → Domains → `onespec.eu` → DKIM, you'll see the exact CNAME values. Copy exactly.

---

### 3. DMARC Record (TXT)

**Type:** TXT  
**Name/Host:** `_dmarc`  
**Value:**
```
v=DMARC1; p=quarantine; rua=mailto:dmarc@onespec.eu; ruf=mailto:dmarc@onespec.eu; fo=1; adkim=r; aspf=r; pct=100
```

**Breakdown:**
- `p=quarantine` — Failures go to spam (start here, move to `p=reject` after monitoring)
- `rua=mailto:dmarc@onespec.eu` — Aggregate reports to this address
- `ruf=mailto:dmarc@onespec.eu` — Forensic reports
- `fo=1` — Generate forensic report on any failure
- `adkim=r` / `aspf=r` — Relaxed alignment (allows subdomains)
- `pct=100` — Apply to 100% of mail

**TTL:** 3600

---

## Verification Steps

### 1. In Resend Dashboard
1. Go to **Domains** → `onespec.eu`
2. Click **Verify DNS**
3. Wait for green checkmarks on SPF, DKIM, DMARC

### 2. Command Line Verification

```bash
# SPF
dig TXT onespec.eu +short

# DKIM
dig CNAME resend._domainkey.onespec.eu +short
dig CNAME resend2._domainkey.onespec.eu +short

# DMARC
dig TXT _dmarc.onespec.eu +short
```

### 3. Test Email Authentication

```bash
# Send test email via Resend API
curl -X POST 'https://api.resend.com/emails' \
  -H 'Authorization: Bearer re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' \
  -H 'Content-Type: application/json' \
  -d '{
    "from": "purchases@onespec.eu",
    "to": "your-email@domain.com",
    "subject": "SPF/DKIM/DMARC Test",
    "html": "<p>Test email for authentication verification</p>"
  }'
```

Check received email headers for:
- `SPF: pass`
- `DKIM: pass`
- `DMARC: pass`

---

## Dedicated Sending Addresses Configuration

### In Resend Dashboard → Domains → `onespec.eu`

1. **Create sending identities:**
   - `purchases@onespec.eu` — For purchase receipts, subscription confirmations
   - `noreply@onespec.eu` — For verification emails, password resets, notifications

2. **Verify each identity:**
   - Resend sends verification email to each address
   - Click link in email to verify

---

## Convex Environment Variables (`.env.local`)

```bash
# Resend
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
RESEND_FROM_PURCHASES=purchases@onespec.eu
RESEND_FROM_NOREPLY=noreply@onespec.eu
RESEND_WEBHOOK_SECRET=whsec_<generate-with-openssl-rand-hex-32>

# Convex Auth
AUTH_RESEND_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
RESEND_MODE=live
```

**Generate webhook secret:**
```bash
openssl rand -hex 32
```

---

## Monitoring & Alerts

### Resend Dashboard → Analytics
- **Delivery rate** — Target > 98%
- **Bounce rate** — Target < 2%
- **Complaint rate** — Target < 0.1%
- **Open rate** — Track engagement

### DMARC Reports
- **Aggregate (rua):** Daily XML to `dmarc@onespec.eu`
- **Forensic (ruf):** Per-failure to `dmarc@onespec.eu`
- **Parser:** Use `dmarcian`, `Postmark DMARC`, or `MXToolbox` to parse

### Convex Monitoring
```bash
# Check webhook delivery
npx convex run emailDeliveryLog:list --filter 'event="bounced"' --limit 10
```

---

## Rollout Plan

| Phase | Action | Risk |
|-------|--------|------|
| **1. Add DNS records** | Add SPF, DKIM, DMARC | Low — additive only |
| **2. Verify in Resend** | Click "Verify DNS" | None |
| **3. Test send** | Send test to self | Low |
| **4. Switch `RESEND_MODE=live`** | Update `.env.local` + Convex env | Medium — emails now send for real |
| **5. Monitor 48h** | Check delivery, bounces, DMARC reports | Medium |
| **6. Enforce `p=reject`** | Update DMARC to `p=reject` | Low — after clean period |

---

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| SPF fail | Multiple SPF records | Merge into single TXT |
| DKIM fail | CNAME not propagated | Wait 24h, check DNS |
| DMARC fail | Alignment issue | Check `adkim=r`, `aspf=r` |
| Emails to spam | Reputation | Warm up domain, check content |
| Webhook not firing | Signature mismatch | Check `RESEND_WEBHOOK_SECRET` |

---

## Maintenance

| Task | Frequency |
|------|-----------|
| Review DMARC reports | Weekly |
| Check bounce/complaint rates | Daily (alert if > threshold) |
| Rotate DKIM keys | Annually (Resend handles) |
| Review suppression list | Monthly |
| Update SPF if adding senders | As needed |

---

*Last updated: 2025-09-22*  
*Owner: CTO / Platform Team*