import { dictFor, fill } from "./dictionary";
import type { ExportModel, ExportPiece } from "./model";

const eur = (cents: number, locale: string) =>
  (cents / 100).toLocaleString(locale, { style: "currency", currency: "EUR" });

const day = (ms: number, locale: string) => new Date(ms).toLocaleDateString(locale, { day: "2-digit", month: "2-digit", year: "numeric" });

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function leafLine(m: ExportModel, piece: ExportPiece): string[] {
  const d = dictFor(m.locale);
  return piece.leaves.map((l) => {
    const parts = [`${d.leaf} ${l.n}: ${l.hinge} ${l.type}${l.main ? ` (${d.principal})` : ""}`, `${l.widthMm} mm`];
    if (l.handleMm !== null) parts.push(`${d.handle} ${l.handleMm} mm`);
    return parts.join(" · ");
  });
}

/** Plain-text offer (fallback that works everywhere: file, clipboard, SMS). */
export function buildTxt(m: ExportModel): string {
  const d = dictFor(m.locale);
  const out: string[] = [];
  out.push(`${d.offer.toUpperCase()} ${m.company.name}`.trim());
  out.push(`${d.number} ${m.offerNumber ?? "—"} - ${d.date}: ${day(m.dateMs, m.locale)}`);
  out.push(`${d.client}: ${m.client.name || "-"} | ${d.phone}: ${m.client.phone || "-"} | ${d.city}: ${m.client.city || "-"}`);
  out.push("");
  for (const p of m.pieces) {
    out.push(`${p.index}. ${p.category} ${p.widthMm}x${p.heightMm} mm × ${p.quantity} — ${p.profile} — ${p.glazing} — ${p.finish}${p.frame ? ` — ${d.frame}: ${p.frame}` : ""}`);
    for (const l of leafLine(m, p)) out.push(`   ${l}`);
    if (p.accessories.length) out.push(`   ${d.accessories}: ${p.accessories.join(", ")}`);
    out.push(`   ${d.thermal}: ${p.uw.toFixed(3)} W/m²K — ${eur(p.totalCents, m.locale)}`);
    if (p.notes) out.push(`   ${d.notes}: ${p.notes}`);
    out.push("");
  }
  out.push(`${d.generalThermal.toUpperCase()}: ${m.overallUw.toFixed(3)} W/m²K`);
  out.push("");
  const t = m.money;
  out.push(`${d.supply}: ${eur(t.supplyExVatCents, m.locale)}`);
  out.push(`${d.installation}: ${eur(t.installCents, m.locale)}`);
  if (t.demolitionCents) out.push(`${d.disposal}: ${eur(t.demolitionCents, m.locale)}`);
  if (t.regionalCents) out.push(`${d.regional}: ${eur(t.regionalCents, m.locale)}`);
  if (t.discountPercent) out.push(`${d.discount}: ${t.discountPercent}%`);
  out.push(`${d.vat} ${t.vatPercent}%`);
  out.push(`${d.totalKey.toUpperCase()}: ${eur(t.grossCents, m.locale)}`);
  if (t.subsidyCents) {
    out.push(`${d.subsidy} ${t.subsidyPercent ?? ""}%: -${eur(t.subsidyCents, m.locale)}`);
    out.push(`${d.netAfter.toUpperCase()}: ${eur(t.grossCents - t.subsidyCents, m.locale)}`);
  }
  out.push("");
  out.push([m.validityDays ? fill(d.validity, { n: m.validityDays }) : "", ...(m.terms ?? [])].filter(Boolean).join(" - "));
  return out.join("\n").trimEnd() + "\n";
}

/** Short chat message: one line per piece, totals, no attachment promise the platform cannot keep. */
export function buildWhatsApp(m: ExportModel): string {
  const d = dictFor(m.locale);
  const t = m.money;
  const lines = [fill(d.waHello, { n: m.offerNumber ?? "—" })];
  if (m.client.name) lines.push(`${d.client}: ${m.client.name}${m.client.city ? ` - ${m.client.city}` : ""}`);
  lines.push("");
  for (const p of m.pieces) {
    lines.push(`${p.index}. ${p.category}: ${p.widthMm}x${p.heightMm} mm × ${p.quantity} — ${eur(p.totalCents, m.locale)}${p.notes ? ` | ${d.notes}: ${p.notes}` : ""}`);
  }
  lines.push("", `${d.generalThermal}: ${m.overallUw.toFixed(3)} W/m²K`, "");
  let total = `${d.totalKey}: ${eur(t.grossCents, m.locale)}`;
  if (t.subsidyCents) total += ` | ${d.subsidy} ${t.subsidyPercent ?? ""}%: -${eur(t.subsidyCents, m.locale)} | ${d.netAfter}: ${eur(t.grossCents - t.subsidyCents, m.locale)}`;
  lines.push(total, "");
  if (m.validityDays) lines.push(fill(d.validity, { n: m.validityDays }) + ".");
  lines.push(d.waPdf, d.waThanks);
  return lines.join("\n");
}

const COUNTRY_PREFIX: Record<string, string> = { IT: "39", FR: "33", BE: "32", NL: "31", DE: "49", LU: "352", RO: "40" };

/**
 * Digits for wa.me: keeps an international number as typed, and turns a national
 * one (leading 0, or bare) into the market's country code.
 */
export function whatsAppDigits(raw: string | undefined, region = "IT"): string {
  if (!raw) return "";
  const trimmed = raw.trim();
  const international = trimmed.startsWith("+") || trimmed.replace(/[^\d]/g, "").startsWith("00");
  let digits = trimmed.replace(/[^\d]/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (international) return digits.length >= 8 ? digits : "";
  const prefix = COUNTRY_PREFIX[region] ?? COUNTRY_PREFIX.IT;
  if (digits.startsWith(prefix) && digits.length >= prefix.length + 8) return digits; // already carries the code
  digits = digits.replace(/^0+/, "");
  return digits.length >= 6 ? prefix + digits : "";
}

export function whatsAppUrl(text: string, phone?: string, region = "IT"): string {
  const digits = whatsAppDigits(phone, region);
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

export function buildMailto(m: ExportModel, to?: string): { url: string; subject: string; body: string } {
  const d = dictFor(m.locale);
  const subject = fill(d.mailSubject, { n: m.offerNumber ?? "—", client: m.client.name || "" }).trim();
  const body = [fill(d.mailGreeting, { client: m.client.name || "" }), "", buildTxt(m), d.mailClosing, m.company.name].join("\n");
  return { url: `mailto:${to ?? m.client.email ?? ""}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, subject, body };
}

/** Standalone HTML offer (opens/prints anywhere, drawings embedded as inline SVG). */
export function buildHtml(m: ExportModel): string {
  const d = dictFor(m.locale);
  const t = m.money;
  const rows = m.pieces
    .map(
      (p) => `<section class="piece">
<h3>${p.index}. ${esc(p.category)}: ${p.widthMm} × ${p.heightMm} mm × ${p.quantity}</h3>
<div class="cols"><div class="draw">${p.drawingSvg ?? ""}</div><div class="info">
<p><b>${esc(d.profile)}:</b> ${esc(p.profile)} · <b>${esc(d.finish)}:</b> ${esc(p.finish)}${p.frame ? ` · <b>${esc(d.frame)}:</b> ${esc(p.frame)}` : ""}</p>
<p><b>${esc(d.glazing)}:</b> ${esc(p.glazing)}</p>
<ul>${leafLine(m, p).map((l) => `<li>${esc(l)}</li>`).join("")}</ul>
${p.accessories.length ? `<p><b>${esc(d.accessories)}:</b> ${esc(p.accessories.join(", "))}</p>` : ""}
<p class="uw">${esc(d.thermal)}: ${p.uw.toFixed(3)} W/m²K</p>
<p class="price">${eur(p.totalCents, m.locale)}</p>
${p.notes ? `<p class="notes"><b>${esc(d.notes)}:</b> ${esc(p.notes)}</p>` : ""}
</div></div></section>`,
    )
    .join("\n");
  const totals = [
    [d.supply, eur(t.supplyExVatCents, m.locale)],
    [d.installation, eur(t.installCents, m.locale)],
    ...(t.demolitionCents ? [[d.disposal, eur(t.demolitionCents, m.locale)]] : []),
    ...(t.regionalCents ? [[d.regional, eur(t.regionalCents, m.locale)]] : []),
    ...(t.discountPercent ? [[d.discount, `${t.discountPercent}%`]] : []),
    [`${d.vat} ${t.vatPercent}%`, ""],
  ]
    .map(([a, b]) => `<div class="row"><span>${esc(a)}</span><span>${esc(b)}</span></div>`)
    .join("");
  return `<!doctype html>
<html lang="${esc(m.locale)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(d.offer)} ${esc(m.offerNumber ?? "")}</title>
<style>
body{font-family:Arial,Helvetica,sans-serif;color:#111827;margin:24px;max-width:900px}
header{display:flex;justify-content:space-between;gap:16px;border-bottom:3px solid #111827;padding-bottom:12px;margin-bottom:16px}
h1{margin:0;font-size:22px}h3{margin:0 0 8px}
.piece{border:2px solid #111827;border-radius:10px;padding:12px;margin:12px 0;page-break-inside:avoid}
.cols{display:flex;gap:16px;flex-wrap:wrap}.draw{flex:0 0 300px}.info{flex:1;min-width:220px;font-size:13px}
.uw{color:#dc2626;font-family:monospace}.price{font-weight:bold;font-size:16px}.notes{border:1px solid #111;padding:6px;color:#b91c1c}
.total{border:2px solid #2d7d46;background:#e8f5e9;color:#2d7d46;border-radius:10px;padding:10px;text-align:center;font-weight:bold;margin:14px 0}
.sum{border:1px solid #e5e7eb;border-radius:10px;padding:12px;background:#f9fafb}.row{display:flex;justify-content:space-between;padding:3px 0}
.big{font-weight:bold;font-size:18px;border-top:1px solid #111;margin-top:6px;padding-top:6px}.foot{font-size:11px;color:#6b7280;margin-top:16px}
@media print{body{margin:0}}
</style></head><body>
<header><div><h1>${esc(m.company.name)}</h1><div>${esc(m.company.address ?? "")} ${m.company.vatId ? `· ${esc(m.company.vatId)}` : ""}</div><div>${esc([m.company.phone, m.company.email].filter(Boolean).join(" · "))}</div></div>
<div style="text-align:right"><b>${esc(d.offer)} ${esc(d.number)} ${esc(m.offerNumber ?? "—")}</b><br>${esc(d.date)}: ${day(m.dateMs, m.locale)}<br>${esc(d.client)}: ${esc(m.client.name || "—")}<br>${esc(d.phone)}: ${esc(m.client.phone || "—")} · ${esc(d.city)}: ${esc(m.client.city || "—")}</div></header>
${rows}
<div class="total">${esc(d.generalThermal.toUpperCase())}: ${m.overallUw.toFixed(3)} W/m²K</div>
<div class="sum">${totals}<div class="row big"><span>${esc(d.totalKey.toUpperCase())}</span><span>${eur(t.grossCents, m.locale)}</span></div>
${t.subsidyCents ? `<div class="row"><span>${esc(d.subsidy)} ${t.subsidyPercent ?? ""}%</span><span>-${eur(t.subsidyCents, m.locale)}</span></div><div class="row big"><span>${esc(d.netAfter.toUpperCase())}</span><span>${eur(t.grossCents - t.subsidyCents, m.locale)}</span></div>` : ""}</div>
<p class="foot">${esc([m.validityDays ? fill(d.validity, { n: m.validityDays }) : "", ...(m.terms ?? [])].filter(Boolean).join(" · "))}</p>
</body></html>`;
}
