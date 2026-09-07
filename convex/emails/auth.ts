/**
 * Email template renderer — shared by `convex/email.ts` (the internal action)
 * and the Convex Auth OTP providers (`ResendOTP` / `ResendPasswordReset`),
 * which cannot reach Convex functions.
 *
 * Dark-theme HTML, onespec mint accent. Absolute logo URL from SITE_URL.
 * Locales: it + en real; fr/de/nl/ro fall back to en.
 *
 * SECURITY: every value that originates from a lead (public widget submission)
 * or a tenant (company name, inviter name, custom messages) MUST pass through
 * `esc()` before it lands in the HTML, and through `line()` before it lands in a
 * subject. Template literals below only ever interpolate `esc(...)`, `escUrl(...)`
 * or values built server-side from trusted sources (SITE_URL, Convex IDs).
 */
type Rendered = { subject: string; html: string; text: string };

/** Data available to auth/notification email templates. */
export interface AuthEmailData {
  code?: string;
  companyName?: string;
  seatNumber?: number;
  leadName?: string;
  leadEmail?: string;
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

function shell(inner: string) {
  const logo = `${siteUrl()}/onespec-logo.png`;
  return `<div style="font-family:-apple-system,Segoe UI,system-ui,sans-serif;max-width:600px;margin:0 auto;padding:28px;background:#0a0b0d;color:#f5f5f7;border-radius:14px;border:1px solid #34383c">
  <img src="${escUrl(logo)}" alt="onespec" style="height:34px;margin-bottom:24px" />
  ${inner}
  <hr style="border:none;border-top:1px solid #34383c;margin:28px 0 14px" />
  <p style="color:#6e6e73;font-size:12px;margin:0">onespec — configuratore infissi</p>
</div>`;
}

function codeBox(code: string) {
  return `<div style="font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:30px;font-weight:600;color:#16d19d;letter-spacing:6px;margin:20px 0;padding:16px;background:#141618;border-radius:10px;border:1px solid #16d19d;text-align:center">${esc(code)}</div>`;
}

function cta(href: string, label: string) {
  return `<a href="${escUrl(href)}" style="display:inline-block;margin-top:20px;padding:12px 22px;background:#16d19d;color:#04231a;font-weight:600;border-radius:9px;text-decoration:none">${esc(label)}</a>`;
}

export function renderAuthEmail(template: string, locale: string, data: AuthEmailData): Rendered {
  const it = locale === "it";
  const base = siteUrl();

  const company = esc(data.companyName ?? "");
  const leadName = esc(data.leadName ?? "");
  const leadEmail = esc(data.leadEmail ?? "");
  const configuratorName = esc(data.configuratorName ?? "—");
  const inviter = esc(data.inviterName ?? "");
  const role = esc(data.role ?? "");
  const seat = Number.isFinite(data.seatNumber) ? Number(data.seatNumber) : "";
  const price = ((data.priceCents ?? 0) / 100).toFixed(2);
  const quoteId = encodeURIComponent(String(data.quoteId ?? ""));

  switch (template) {
    case "verify":
      return {
        subject: it ? "Verifica la tua email — onespec" : "Verify your email — onespec",
        html: shell(
          `<h1 style="font-size:22px;font-weight:600;margin:0 0 12px">${it ? "Verifica la tua email" : "Verify your email"}</h1>
           <p style="color:#9a9aa0;line-height:1.6;margin:0">${it ? "Il tuo codice di verifica:" : "Your verification code:"}</p>
           ${codeBox(data.code ?? "")}
           <p style="color:#6e6e73;font-size:13px;margin:0">${it ? "Scade tra 15 minuti. Se non hai richiesto questo codice, ignora questa email." : "Expires in 15 minutes. If you didn't request this, ignore this email."}</p>`,
        ),
        text: `${it ? "Codice di verifica" : "Verification code"}: ${line(data.code ?? "")}`,
      };

    case "reset":
      return {
        subject: it ? "Reimposta la password — onespec" : "Reset your password — onespec",
        html: shell(
          `<h1 style="font-size:22px;font-weight:600;margin:0 0 12px">${it ? "Reimposta la password" : "Reset your password"}</h1>
           <p style="color:#9a9aa0;line-height:1.6;margin:0">${it ? "Codice per reimpostare la password:" : "Password reset code:"}</p>
           ${codeBox(data.code ?? "")}
           <p style="color:#6e6e73;font-size:13px;margin:0">${it ? "Scade tra 15 minuti. Se non hai richiesto il reset, ignora questa email." : "Expires in 15 minutes. If you didn't request this, ignore this email."}</p>`,
        ),
        text: `${it ? "Codice reset password" : "Password reset code"}: ${line(data.code ?? "")}`,
      };

    case "welcome_alpha":
      return {
        subject: it
          ? `Benvenuto in onespec Alpha — posto #${seat}`
          : `Welcome to onespec Alpha — seat #${seat}`,
        html: shell(
          `<div style="background:linear-gradient(135deg,#16d19d,#0fbf8f);color:#04231a;padding:14px;border-radius:9px;margin-bottom:20px;font-weight:700;text-align:center">Alpha Member — #${seat}</div>
           <h1 style="font-size:22px;font-weight:600;margin:0 0 12px">${it ? "Benvenuto in onespec Alpha" : "Welcome to onespec Alpha"}</h1>
           <p style="color:#9a9aa0;line-height:1.6">${it ? `<strong>${company}</strong> è tra i primi 250 membri Alpha. Sconto 15% bloccato a vita su Starter e Business.` : `<strong>${company}</strong> is one of the first 250 Alpha members. 15% discount locked for life on Starter and Business.`}</p>
           ${cta(`${base}/app/dashboard`, it ? "Vai alla dashboard" : "Go to dashboard")}`,
        ),
        text: `${it ? "Benvenuto in onespec Alpha" : "Welcome to onespec Alpha"} — #${seat}\n${base}/app/dashboard`,
      };

    case "welcome":
      return {
        subject: it ? "Benvenuto in onespec" : "Welcome to onespec",
        html: shell(
          `<h1 style="font-size:22px;font-weight:600;margin:0 0 12px">${it ? "Benvenuto in onespec" : "Welcome to onespec"}</h1>
           <p style="color:#9a9aa0;line-height:1.6">${it ? `<strong>${company}</strong> è registrata. Crea il tuo primo configuratore.` : `<strong>${company}</strong> is registered. Create your first configurator.`}</p>
           ${cta(`${base}/app/dashboard`, it ? "Vai alla dashboard" : "Go to dashboard")}`,
        ),
        text: `${it ? "Benvenuto in onespec" : "Welcome to onespec"}\n${base}/app/dashboard`,
      };

    case "new_quote_request":
      return {
        subject: line(
          it ? `Nuova richiesta preventivo: ${data.leadName ?? ""}` : `New quote request: ${data.leadName ?? ""}`,
        ),
        html: shell(
          `<h1 style="font-size:22px;font-weight:600;margin:0 0 12px">${it ? "Nuova richiesta preventivo" : "New quote request"}</h1>
           <div style="background:#141618;padding:16px;border-radius:9px;border:1px solid #34383c;margin-bottom:12px">
             <p style="margin:0 0 6px"><strong>${it ? "Cliente" : "Lead"}:</strong> ${leadName} (${leadEmail})</p>
             <p style="margin:0 0 6px"><strong>${it ? "Configuratore" : "Configurator"}:</strong> ${configuratorName}</p>
             <p style="margin:0"><strong>${it ? "Valore" : "Value"}:</strong> €${price}</p>
           </div>
           ${cta(`${base}/app/requests/${quoteId}`, it ? "Apri in dashboard" : "Open in dashboard")}`,
        ),
        text: line(
          `${it ? "Nuova richiesta preventivo" : "New quote request"}: ${data.leadName ?? ""} (${data.leadEmail ?? ""}) — €${price}`,
        ) + `\n${base}/app/requests/${quoteId}`,
      };

    case "invitation":
      return {
        subject: line(
          it
            ? `Invito a collaborare su onespec — ${data.companyName ?? ""}`
            : `You've been invited to onespec — ${data.companyName ?? ""}`,
        ),
        html: shell(
          `<h1 style="font-size:22px;font-weight:600;margin:0 0 12px">${it ? "Invito a collaborare" : "Team invitation"}</h1>
           <p style="color:#9a9aa0;line-height:1.6">${
             it
               ? `${inviter || "Un collega"} ti ha invitato a lavorare su <strong>${company || "un'azienda"}</strong> in onespec come <strong>${role || "membro"}</strong>.`
               : `${inviter || "A colleague"} invited you to work on <strong>${company || "a company"}</strong> in onespec as <strong>${role || "member"}</strong>.`
           }</p>
           ${cta(data.acceptUrl ?? base, it ? "Accetta l'invito" : "Accept invitation")}
           <p style="color:#6e6e73;font-size:13px;margin-top:14px">${it ? "L'invito scade tra 7 giorni." : "This invitation expires in 7 days."}</p>`,
        ),
        text: `${it ? "Sei stato invitato a onespec" : "You've been invited to onespec"}: ${line(data.companyName ?? "")}\n${escUrl(data.acceptUrl ?? base) === "#" ? base : data.acceptUrl ?? base}`,
      };

    case "admin_resend":
    default:
      return {
        subject: "onespec",
        html: shell(`<p style="color:#9a9aa0">${esc(data?.message ?? "Notification")}</p>`),
        text: line(data?.message ?? "Notification"),
      };
  }
}
