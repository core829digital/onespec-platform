/**
 * Email template renderer — shared by `convex/email.ts` (the internal action)
 * and the Convex Auth OTP providers (`ResendOTP` / `ResendPasswordReset`),
 * which cannot reach Convex functions.
 *
 * Dark-theme HTML, onespec mint accent. Absolute logo URL from SITE_URL.
 * Locales: it, en, fr, de, nl, ro (copy in ./strings.ts); unknown → it.
 *
 * SECURITY: every value that originates from a lead (public widget submission)
 * or a tenant (company name, inviter name, custom messages) MUST pass through
 * `esc()` before it lands in the HTML, and through `line()` before it lands in a
 * subject. Template literals below only ever interpolate `esc(...)`, `escUrl(...)`
 * or values built server-side from trusted sources (SITE_URL, Convex IDs).
 */
import { emailStrings, type QuoteStatus } from "./strings";
import { gradeLabel } from "../../src/shared/grade-labels";

type Rendered = { subject: string; html: string; text: string };

/** Data available to auth/notification email templates. */
export interface AuthEmailData {
  code?: string;
  companyName?: string;
  seatNumber?: number;
  leadName?: string;
  leadEmail?: string;
  /** Widget-first plan over its monthly cap: contact details withheld. */
  locked?: boolean;
  /** Why it is locked: monthly cap, or subscription suspended. */
  lockReason?: "quota" | "suspended";
  priceCents?: number;
  configuratorName?: string;
  quoteId?: string;
  newStatus?: string;
  userName?: string;
  version?: number;
  message?: string;
  href?: string;
  inviterName?: string;
  role?: string;
  acceptUrl?: string;
  /** team_access: "invite" (an admin invited this e-mail) or "login" (a member asked for a new way in). */
  kind?: "invite" | "login";
  teamName?: string;
  inviteeName?: string;
  /** team_access: key of the professional grade (named in the recipient's language). */
  grade?: string;
  joinUrl?: string;
  /** team_access: how long the link and code last — "7d" or "15m". */
  expiresText?: string;
  /** plan_limit: the monthly cap that was hit, rendered in the recipient's language. */
  limit?: number;
  /** Referral emails: a ready-to-print money amount (already formatted) and a discount percentage. */
  amount?: string;
  percent?: number;
  /** referral_rewarded: how the reward was paid ("credit" on the subscription, or "stripe" = money). */
  payout?: string;
}

/** HTML-entity-escape a string for safe interpolation into element text/attributes. */
function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Escape a URL for an `href="..."` attribute and neutralise dangerous schemes.
 * Only http(s) and mailto pass; anything else (javascript:, data:, …) is dropped
 * to "#".
 */
function escUrl(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (!/^(https?:|mailto:)/i.test(raw)) return "#";
  return esc(raw);
}

/** Collapse control chars / newlines — a subject line must stay one line. */
function line(value: unknown): string {
  return String(value ?? "").replace(/[\r\n\t\f\v]+/g, " ").trim();
}

function siteUrl() {
  return process.env.SITE_URL || "http://localhost:3000";
}

/**
 * The frame of every e-mail. A complete document (the old fragment had no viewport, so phones showed it at desktop width and zoomed out),
 * a 100%-wide table that caps at 600 px, the same dark background all the way to the edge so a light-mode client never shows a dark card
 * floating on white, and sizes that hold on a 320 px screen. Table layout because Outlook ignores most of the modern box model.
 */
function shell(inner: string, tagline: string, lang = "it") {
  const logo = `${siteUrl()}/onespec-logo.png`;
  const font = "-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
  return `<!doctype html>
<html lang="${esc(lang)}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="color-scheme" content="dark light" />
<meta name="supported-color-schemes" content="dark light" />
<title>onespec</title>
<style>
  @media only screen and (max-width:480px){
    .os-card{padding:20px 16px !important}
    .os-cta{display:block !important;text-align:center !important}
    .os-code{font-size:26px !important;letter-spacing:4px !important}
  }
</style>
</head>
<body style="margin:0;padding:0;background:#0a0b0d;-webkit-text-size-adjust:100%">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0a0b0d">
  <tr><td align="center" style="padding:16px 12px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%">
      <tr><td class="os-card" style="font-family:${font};padding:28px;background:#0a0b0d;color:#f5f5f7;border-radius:14px;border:1px solid #34383c;word-break:break-word">
  <img src="${escUrl(logo)}" alt="onespec" width="120" height="34" style="height:34px;width:auto;max-width:100%;margin-bottom:24px;border:0;display:block" />
  ${inner}
  <hr style="border:none;border-top:1px solid #34383c;margin:28px 0 14px" />
  <p style="color:#8b8b92;font-size:12px;line-height:1.5;margin:0">${esc(tagline)}</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

function codeBox(code: string) {
  return `<div class="os-code" style="font-family:'IBM Plex Mono',ui-monospace,Menlo,Consolas,monospace;font-size:30px;font-weight:600;color:#16d19d;letter-spacing:6px;margin:20px 0;padding:16px;background:#141618;border-radius:10px;border:1px solid #16d19d;text-align:center">${esc(code)}</div>`;
}

function cta(href: string, label: string) {
  return `<a class="os-cta" href="${escUrl(href)}" style="display:inline-block;margin-top:20px;padding:14px 24px;background:#16d19d;color:#04231a;font-size:16px;font-weight:600;line-height:1.2;border-radius:9px;text-decoration:none">${esc(label)}</a>`;
}

const H1 = `<h1 style="font-size:22px;font-weight:600;margin:0 0 12px">`;
const P = `<p style="color:#9a9aa0;line-height:1.6">`;
const QUOTE_STATUSES: QuoteStatus[] = ["new", "contacted", "quoted", "won", "lost", "spam"];

export function renderAuthEmail(template: string, locale: string, data: AuthEmailData): Rendered {
  const L = emailStrings(locale);
  const wrap = (inner: string) => shell(inner, L.tagline, locale);
  const base = siteUrl();

  const company = esc(data.companyName ?? "");
  const leadName = esc(data.leadName ?? "");
  const leadEmail = esc(data.leadEmail ?? "");
  const configuratorName = esc(data.configuratorName ?? "—");
  const inviter = esc(data.inviterName ?? "");
  const price = ((data.priceCents ?? 0) / 100).toFixed(2);
  const quoteId = encodeURIComponent(String(data.quoteId ?? ""));

  switch (template) {
    case "verify":
      return {
        subject: L.verify.subject,
        html: wrap(
          `${H1}${L.verify.title}</h1>
           <p style="color:#9a9aa0;line-height:1.6;margin:0">${L.verify.body}</p>
           ${codeBox(data.code ?? "")}
           <p style="color:#6e6e73;font-size:13px;margin:0">${L.verify.expires}</p>`,
        ),
        text: `${L.verify.textLabel}: ${line(data.code ?? "")}`,
      };

    case "reset":
      return {
        subject: L.reset.subject,
        html: wrap(
          `${H1}${L.reset.title}</h1>
           <p style="color:#9a9aa0;line-height:1.6;margin:0">${L.reset.body}</p>
           ${codeBox(data.code ?? "")}
           <p style="color:#6e6e73;font-size:13px;margin:0">${L.reset.expires}</p>`,
        ),
        text: `${L.reset.textLabel}: ${line(data.code ?? "")}`,
      };

    // Legacy template key: the Alpha programme is over, so it renders the
    // standard welcome (no seat badge, no discount promise).
    case "welcome_alpha":
    case "welcome":
      return {
        subject: L.welcome.subject,
        html: wrap(
          `${H1}${L.welcome.title}</h1>
           ${P}${L.welcome.body(company)}</p>
           ${cta(`${base}/app/dashboard`, L.welcome.cta)}`,
        ),
        text: `${L.welcome.title}\n${base}/app/dashboard`,
      };

    case "new_quote_request": {
      const lockedText = data.lockReason === "suspended" ? L.newQuote.lockedSuspended : L.newQuote.lockedQuota;
      return {
        subject: line(L.newQuote.subject(data.leadName ?? "")),
        html: wrap(
          `${H1}${L.newQuote.title}</h1>
           <div style="background:#141618;padding:16px;border-radius:9px;border:1px solid #34383c;margin-bottom:12px">
             <p style="margin:0 0 6px"><strong>${L.newQuote.lead}:</strong> ${data.locked ? lockedText : `${leadName} (${leadEmail})`}</p>
             <p style="margin:0 0 6px"><strong>${L.newQuote.configurator}:</strong> ${configuratorName}</p>
             <p style="margin:0"><strong>${L.newQuote.value}:</strong> €${price}</p>
           </div>
           ${cta(`${base}/app/requests/${quoteId}`, L.newQuote.cta)}`,
        ),
        text:
          line(
            data.locked
              ? `${L.newQuote.textLocked}: ${lockedText} — €${price}`
              : `${L.newQuote.title}: ${data.leadName ?? ""} (${data.leadEmail ?? ""}) — €${price}`,
          ) + `\n${base}/app/requests/${quoteId}`,
      };
    }

    case "quote_status_changed": {
      const rawStatus = data.newStatus ?? "";
      const statusLabel = (QUOTE_STATUSES as string[]).includes(rawStatus)
        ? L.statusChanged.statuses[rawStatus as QuoteStatus]
        : rawStatus;
      const href = data.href ? `${base}${data.href}` : `${base}/app/requests`;
      return {
        subject: line(L.statusChanged.subject(data.leadName ?? "", statusLabel)),
        html: wrap(
          `${H1}${L.statusChanged.title}</h1>
           ${P}${L.statusChanged.lead}: <strong>${leadName}</strong> → <strong>${esc(statusLabel)}</strong></p>
           ${cta(href, L.statusChanged.cta)}`,
        ),
        text: line(`${L.statusChanged.title}: ${data.leadName ?? ""} -> ${statusLabel}`) + `\n${href}`,
      };
    }

    case "member_joined": {
      const href = data.href ? `${base}${data.href}` : `${base}/app/account/team`;
      return {
        subject: line(L.memberJoined.subject(data.userName ?? "")),
        html: wrap(
          `${H1}${L.memberJoined.title}</h1>
           ${P}${L.memberJoined.body(esc(data.userName ?? ""))}</p>
           ${cta(href, L.memberJoined.cta)}`,
        ),
        text: line(`${L.memberJoined.title}: ${data.userName ?? ""}`) + `\n${href}`,
      };
    }

    case "configurator_published": {
      const href = data.href ? `${base}${data.href}` : `${base}/app/configurators`;
      return {
        subject: line(L.published.subject(data.configuratorName ?? "", String(data.version ?? ""))),
        html: wrap(
          `${H1}${L.published.title}</h1>
           ${P}${L.published.configurator}: <strong>${configuratorName}</strong> — ${L.published.version} ${esc(data.version ?? "")}</p>
           ${cta(href, L.published.cta)}`,
        ),
        text: line(`${L.published.title}: ${data.configuratorName ?? ""} v${data.version ?? ""}`) + `\n${href}`,
      };
    }

    case "plan_limit": {
      const href = data.href ? `${base}${data.href}` : `${base}/app/account/billing`;
      // Structured data renders in the recipient's language; `message` is the
      // legacy free-text fallback for rows scheduled before `limit` existed.
      const body =
        typeof data.limit === "number"
          ? (data.locked ? L.planLimit.locked : L.planLimit.unlocked)(String(data.limit))
          : String(data.message ?? "");
      return {
        subject: L.planLimit.subject,
        html: wrap(
          `${H1}${L.planLimit.title}</h1>
           ${P}${esc(body)}</p>
           ${cta(href, L.planLimit.cta)}`,
        ),
        text: line(body) + `\n${href}`,
      };
    }

    case "system": {
      const href = data.href ? `${base}${data.href}` : base;
      return {
        subject: L.system.subject,
        html: wrap(
          `${H1}${L.system.title}</h1>
           ${P}${esc(data.message ?? "")}</p>
           ${data.href ? cta(href, L.system.open) : ""}`,
        ),
        text: line(data.message ?? "onespec"),
      };
    }

    case "team_access": {
      const T = L.teamAccess;
      const team = esc(data.teamName ?? "");
      const firstLine = data.kind === "login"
        ? T.login.body(company || T.company, team)
        : T.invite.body(inviter || T.colleague, company || T.company, team, esc(data.grade ? gradeLabel(locale, data.grade) : "—"));
      const title = data.kind === "login" ? T.login.title : T.invite.title;
      const subject = data.kind === "login" ? T.login.subject(data.companyName ?? "") : T.invite.subject(data.companyName ?? "");
      const joinUrl = escUrl(data.joinUrl ?? base) === "#" ? base : String(data.joinUrl ?? base);
      const expires = data.expiresText === "15m" ? T.expires15 : T.expires7;
      return {
        subject: line(subject),
        html: wrap(
          `${H1}${title}</h1>
           ${P}${firstLine}</p>
           ${P}${T.codeLabel}</p>
           ${codeBox(data.code ?? "")}
           ${cta(joinUrl, T.cta)}
           ${P}${T.howTo}</p>
           <p style="color:#6e6e73;font-size:13px;margin-top:14px">${expires}<br />${T.neverShare}</p>`,
        ),
        text: `${T.text}: ${line(data.companyName ?? "")} / ${line(data.teamName ?? "")}\n${T.codeLabel}: ${line(data.code ?? "")}\n${joinUrl}\n\n${T.howTo}\n${expires}`,
      };
    }

    case "invitation": {
      // `role` is a key ("admin" | "member"); a legacy pre-translated label passes through.
      const roleLabel =
        data.role === "admin" || data.role === "member" ? L.invitation.roles[data.role] : data.role || L.invitation.roles.member;
      return {
        subject: line(L.invitation.subject(data.companyName ?? "")),
        html: wrap(
          `${H1}${L.invitation.title}</h1>
           ${P}${L.invitation.body(inviter || L.invitation.colleague, company || L.invitation.company, esc(roleLabel))}</p>
           ${cta(data.acceptUrl ?? base, L.invitation.cta)}
           <p style="color:#6e6e73;font-size:13px;margin-top:14px">${L.invitation.expires}</p>`,
        ),
        text: `${L.invitation.text}: ${line(data.companyName ?? "")}\n${escUrl(data.acceptUrl ?? base) === "#" ? base : data.acceptUrl ?? base}`,
      };
    }

    case "referral_invited": {
      const href = `${base}/app/account/billing?tab=plan`;
      return {
        subject: line(L.referral.invited.subject),
        html: wrap(
          `${H1}${L.referral.invited.title}</h1>
           ${P}${L.referral.invited.body(esc(String(Number(data.percent ?? 0))))}</p>
           ${cta(href, L.referral.invited.cta)}`,
        ),
        text: `${L.referral.invited.title}\n${href}`,
      };
    }

    case "referral_registered": {
      const href = `${base}/app/account/referral`;
      return {
        subject: line(L.referral.registered.subject),
        html: wrap(
          `${H1}${L.referral.registered.title}</h1>
           ${P}${L.referral.registered.body}</p>
           ${cta(href, L.referral.registered.cta)}`,
        ),
        text: `${L.referral.registered.title}\n${href}`,
      };
    }

    case "referral_rewarded": {
      const href = `${base}/app/account/referral`;
      const amount = String(data.amount ?? "");
      const T = data.payout === "stripe" ? L.referral.paid : L.referral.rewarded;
      return {
        subject: line(T.subject(amount)),
        html: wrap(
          `${H1}${T.title}</h1>
           ${P}${T.body(esc(amount))}</p>
           ${cta(href, T.cta)}`,
        ),
        text: `${line(T.subject(amount))}\n${href}`,
      };
    }

    case "admin_resend":
    default:
      return {
        subject: "onespec",
        html: wrap(`<p style="color:#9a9aa0">${esc(data?.message ?? L.notification)}</p>`),
        text: line(data?.message ?? L.notification),
      };
  }
}
