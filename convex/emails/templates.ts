/**
 * Email templates for transactional emails
 * All templates use dark theme with onespec mint accent
 */

type EmailData = Record<string, unknown>;

interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

function siteUrl(): string {
  return process.env.SITE_URL || "https://app.onespec.it";
}

function shell(inner: string): string {
  const logo = `${siteUrl()}/onespec-logo.png`;
  return `<div style="font-family:-apple-system,Segoe UI,system-ui,sans-serif;max-width:600px;margin:0 auto;padding:28px;background:#0a0b0d;color:#f5f5f7;border-radius:14px;border:1px solid #34383c">
  <img src="${logo}" alt="onespec" style="height:34px;margin-bottom:24px" />
  ${inner}
  <hr style="border:none;border-top:1px solid #34383c;margin:28px 0 14px" />
  <p style="color:#6e6e73;font-size:12px;margin:0">onespec — configuratore infissi</p>
</div>`;
}

function codeBox(code: string): string {
  return `<div style="font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:30px;font-weight:600;color:#16d19d;letter-spacing:6px;margin:20px 0;padding:16px;background:#141618;border-radius:10px;border:1px solid #16d19d;text-align:center">${code}</div>`;
}

function cta(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;margin-top:20px;padding:12px 22px;background:#16d19d;color:#04231a;font-weight:600;border-radius:9px;text-decoration:none">${label}</a>`;
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", minimumFractionDigits: 2 }).format(cents / 100);
}

export function renderEmail(template: string, locale: string, data: EmailData): RenderedEmail {
  const it = locale === "it";
  const base = siteUrl();

  switch (template) {
    case "verify":
      return {
        subject: it ? "Verifica la tua email — onespec" : "Verify your email — onespec",
        html: shell(
          `<h1 style="font-size:22px;font-weight:600;margin:0 0 12px">${it ? "Verifica la tua email" : "Verify your email"}</h1>
           <p style="color:#9a9aa0;line-height:1.6;margin:0">${it ? "Il tuo codice di verifica:" : "Your verification code:"}</p>
           ${codeBox(data.code as string)}
           <p style="color:#6e6e73;font-size:13px;margin:0">${it ? "Scade tra 15 minuti. Se non hai richiesto questo codice, ignora questa email." : "Expires in 15 minutes. If you didn't request this, ignore this email."}</p>`,
        ),
        text: `${it ? "Codice di verifica" : "Verification code"}: ${data.code}`,
      };

    case "reset":
      return {
        subject: it ? "Reimposta la password — onespec" : "Reset your password — onespec",
        html: shell(
          `<h1 style="font-size:22px;font-weight:600;margin:0 0 12px">${it ? "Reimposta la password" : "Reset your password"}</h1>
           <p style="color:#9a9aa0;line-height:1.6;margin:0">${it ? "Codice per reimpostare la password:" : "Password reset code:"}</p>
           ${codeBox(data.code as string)}
           <p style="color:#6e6e73;font-size:13px;margin:0">${it ? "Scade tra 15 minuti. Se non hai richiesto il reset, ignora questa email." : "Expires in 15 minutes. If you didn't request this, ignore this email."}</p>`,
        ),
        text: `${it ? "Codice reset password" : "Password reset code"}: ${data.code}`,
      };

    case "welcome_alpha":
      return {
        subject: it
          ? `Benvenuto in onespec Alpha — posto #${data.seatNumber}`
          : `Welcome to onespec Alpha — seat #${data.seatNumber}`,
        html: shell(
          `<div style="background:linear-gradient(135deg,#16d19d,#0fbf8f);color:#04231a;padding:14px;border-radius:9px;margin-bottom:20px;font-weight:700;text-align:center">Alpha Member — #${data.seatNumber}</div>
           <h1 style="font-size:22px;font-weight:600;margin:0 0 12px">${it ? "Benvenuto in onespec Alpha" : "Welcome to onespec Alpha"}</h1>
           <p style="color:#9a9aa0;line-height:1.6">${it ? `<strong>${data.companyName}</strong> è tra i primi 250 membri Alpha. Sconto 15% bloccato a vita su Starter e Business.` : `<strong>${data.companyName}</strong> is one of the first 250 Alpha members. 15% discount locked for life on Starter and Business.`}</p>
           ${cta(`${base}/app/dashboard`, it ? "Vai alla dashboard" : "Go to dashboard")}`,
        ),
        text: `${it ? "Benvenuto in onespec Alpha" : "Welcome to onespec Alpha"} — #${data.seatNumber}\n${base}/app/dashboard`,
      };

    case "welcome":
      return {
        subject: it ? "Benvenuto in onespec" : "Welcome to onespec",
        html: shell(
          `<h1 style="font-size:22px;font-weight:600;margin:0 0 12px">${it ? "Benvenuto in onespec" : "Welcome to onespec"}</h1>
           <p style="color:#9a9aa0;line-height:1.6">${it ? `<strong>${data.companyName}</strong> è registrata. Crea il tuo primo configuratore.` : `<strong>${data.companyName}</strong> is registered. Create your first configurator.`}</p>
           ${cta(`${base}/app/dashboard`, it ? "Vai alla dashboard" : "Go to dashboard")}`,
        ),
        text: `${it ? "Benvenuto in onespec" : "Welcome to onespec"}\n${base}/app/dashboard`,
      };

    case "new_quote_request":
      return {
        subject: it
          ? `Nuova richiesta preventivo: ${data.leadName}`
          : `New quote request: ${data.leadName}`,
        html: shell(
          `<h1 style="font-size:22px;font-weight:600;margin:0 0 12px">${it ? "Nuova richiesta preventivo" : "New quote request"}</h1>
           <div style="background:#141618;padding:16px;border-radius:9px;border:1px solid #34383c;margin-bottom:12px">
             <p style="margin:0 0 6px"><strong>${it ? "Cliente" : "Lead"}:</strong> ${data.leadName} (${data.leadEmail})</p>
             <p style="margin:0 0 6px"><strong>${it ? "Configuratore" : "Configurator"}:</strong> ${data.configuratorName ?? "—"}</p>
             <p style="margin:0"><strong>${it ? "Valore" : "Value"}:</strong> ${formatCurrency(data.priceCents as number)}</p>
           </div>
           ${cta(`${base}/app/requests/${data.quoteId}`, it ? "Apri in dashboard" : "Open in dashboard")}`,
        ),
        text: `${it ? "Nuova richiesta preventivo" : "New quote request"}: ${data.leadName} (${data.leadEmail}) — ${formatCurrency(data.priceCents as number)}\n${base}/app/requests/${data.quoteId}`,
      };

    case "trial_ending":
      return {
        subject: it
          ? `Il tuo trial onespec scade tra ${data.daysLeft} giorni`
          : `Your onespec trial ends in ${data.daysLeft} days`,
        html: shell(
          `<h1 style="font-size:22px;font-weight:600;margin:0 0 12px">${it ? "Il tuo periodo di prova sta per scadere" : "Your trial is ending soon"}</h1>
           <p style="color:#9a9aa0;line-height:1.6">${it ? `Ciao <strong>${data.companyName}</strong>,` : `Hi <strong>${data.companyName}</strong>,`}</p>
           <p style="color:#9a9aa0;line-height:1.6">${it ? `Il tuo periodo di prova gratuito di 14 giorni scade tra <strong>${data.daysLeft} giorni</strong>. Per continuare a usare onespec senza interruzioni, scegli un piano.` : `Your 14-day free trial ends in <strong>${data.daysLeft} days</strong>. To continue using onespec uninterrupted, choose a plan.`}</p>
           ${cta(`${base}/app/subscription`, it ? "Scegli un piano" : "Choose a plan")}`,
        ),
        text: `${it ? "Il tuo trial scade tra" : "Your trial ends in"} ${data.daysLeft} ${it ? "giorni" : "days"}.\n${base}/app/subscription`,
      };

    case "payment_failed":
      return {
        subject: it
          ? `Pagamento fallito — Fattura ${data.invoiceId}`
          : `Payment failed — Invoice ${data.invoiceId}`,
        html: shell(
          `<h1 style="font-size:22px;font-weight:600;margin:0 0 12px">${it ? "Impossibile processare il pagamento" : "Unable to process payment"}</h1>
           <p style="color:#9a9aa0;line-height:1.6">${it ? `Il pagamento per la fattura <strong>${data.invoiceId}</strong> (${formatCurrency(data.amount as number)}) non è andato a buon fine.` : `Payment for invoice <strong>${data.invoiceId}</strong> (${formatCurrency(data.amount as number)}) failed.`}</p>
           <p style="color:#9a9aa0;line-height:1.6">${it ? "Aggiorna il tuo metodo di pagamento per evitare l'interruzione del servizio." : "Update your payment method to avoid service interruption."}</p>
           ${cta(`${base}/app/subscription`, it ? "Aggiorna pagamento" : "Update payment")}`,
        ),
        text: `${it ? "Pagamento fallito per" : "Payment failed for"} ${data.invoiceId}.\n${base}/app/subscription`,
      };

    case "subscription_canceled":
      return {
        subject: it ? "Il tuo abbonamento onespec è stato annullato" : "Your onespec subscription has been canceled",
        html: shell(
          `<h1 style="font-size:22px;font-weight:600;margin:0 0 12px">${it ? "Abbonamento annullato" : "Subscription canceled"}</h1>
           <p style="color:#9a9aa0;line-height:1.6">${it ? `Il tuo abbonamento <strong>${data.planName}</strong> è stato annullato.` : `Your <strong>${data.planName}</strong> subscription has been canceled.`}</p>
           <p style="color:#9a9aa0;line-height:1.6">${it ? "Puoi riattivarlo in qualsiasi momento dalla dashboard." : "You can reactivate it anytime from the dashboard."}</p>
           ${cta(`${base}/app/subscription`, it ? "Riattiva abbonamento" : "Reactivate subscription")}`,
        ),
        text: `${it ? "Abbonamento annullato" : "Subscription canceled"}.\n${base}/app/subscription`,
      };

    case "admin_resend":
    default:
      return {
        subject: "onespec",
        html: shell(`<p style="color:#9a9aa0">${data?.message ?? "Notification"}</p>`),
        text: data?.message ?? "Notification",
      };
  }
}

function cta(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;margin-top:20px;padding:12px 22px;background:#16d19d;color:#04231a;font-weight:600;border-radius:9px;text-decoration:none">${label}</a>`;
}

function codeBox(code: string): string {
  return `<div style="font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:30px;font-weight:600;color:#16d19d;letter-spacing:6px;margin:20px 0;padding:16px;background:#141618;border-radius:10px;border:1px solid #16d19d;text-align:center">${code}</div>`;
}

function siteUrl(): string {
  return process.env.SITE_URL || "https://app.onespec.it";
}

function shell(inner: string): string {
  const logo = `${siteUrl()}/onespec-logo.png`;
  return `<div style="font-family:-apple-system,Segoe UI,system-ui,sans-serif;max-width:600px;margin:0 auto;padding:28px;background:#0a0b0d;color:#f5f5f7;border-radius:14px;border:1px solid #34383c">
  <img src="${logo}" alt="onespec" style="height:34px;margin-bottom:24px" />
  ${inner}
  <hr style="border:none;border-top:1px solid #34383c;margin:28px 0 14px" />
  <p style="color:#6e6e73;font-size:12px;margin:0">onespec — configuratore infissi</p>
</div>`;
}