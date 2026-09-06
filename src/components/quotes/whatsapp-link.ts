// Builds a wa.me deep link with a short quote summary for the installer to send
// to the customer from the field. Pure client-side — no backend, nothing stored.

interface QuoteSummaryItem {
  productType: string;
  width: number;
  height: number;
  quantity?: number;
  material?: string;
  sashes?: unknown[];
}

interface WaOpts {
  companyName: string;
  leadName?: string;
  leadPhone?: string | null;
  items: QuoteSummaryItem[];
  totalCents: number;
  uwAverage?: number | null;
  currency?: string;
  validityDays?: number;
}

/** Digits only, dropping a leading "00" international prefix. */
function normalizePhone(raw: string | null | undefined): string {
  if (!raw) return "";
  const digits = raw.replace(/[^\d]/g, "");
  return digits.startsWith("00") ? digits.slice(2) : digits;
}

function fmtEuro(cents: number, currency = "EUR"): string {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency }).format(cents / 100);
}

export function waSummaryText(opts: WaOpts): string {
  const lines: string[] = [];
  lines.push(`Preventivo ${opts.companyName}`);
  if (opts.leadName) lines.push(`Cliente: ${opts.leadName}`);
  lines.push("");
  opts.items.forEach((it, i) => {
    const kind = it.productType === "balconyDoor" ? "Portafinestra" : "Finestra";
    const qty = it.quantity && it.quantity > 1 ? `${it.quantity}× ` : "";
    lines.push(`${i + 1}. ${qty}${kind} ${it.width}×${it.height} mm`);
  });
  lines.push("");
  lines.push(`Totale: ${fmtEuro(opts.totalCents, opts.currency)}`);
  if (typeof opts.uwAverage === "number") {
    lines.push(`Uw medio indicativo: ${opts.uwAverage.toFixed(1)} W/m²K (non certificato)`);
  }
  lines.push(`Preventivo valido ${opts.validityDays ?? 30} giorni.`);
  return lines.join("\n");
}

export function waHref(opts: WaOpts): string {
  const phone = normalizePhone(opts.leadPhone);
  const text = encodeURIComponent(waSummaryText(opts));
  return phone ? `https://wa.me/${phone}?text=${text}` : `https://wa.me/?text=${text}`;
}
