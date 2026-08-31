import { action } from "./_generated/server";
import { v } from "convex/values";

interface QuotePDFData {
  quoteId: string;
  tenantId: string;
  configuratorId: string;
  leadName: string;
  leadEmail: string;
  leadPhone?: string;
  leadCompany?: string;
  leadMessage?: string;
  items: QuoteItem[];
  priceCents: number;
  priceExVatCents: number;
  vatRatePercent: number;
  companyInfo: CompanyInfo;
  branding: BrandingData;
  catalogVersion: number;
  publicId: string;
}

interface QuoteItem {
  productType: "window" | "balconyDoor";
  material: string;
  quality: string;
  width: number;
  height: number;
  quantity: number;
  sashes: Sash[];
  glazing: string;
  color: string;
  insectScreen: boolean;
  unitPrice: number;
  totalPrice: number;
}

interface Sash {
  type: "fix" | "classic" | "tiltturn" | "sliding";
  direction: "left" | "right";
  active: boolean;
  hardware: string;
  hardwareColor: string;
}

interface CompanyInfo {
  name: string;
  vatId?: string;
  address?: string;
  phone?: string;
  email?: string;
}

interface BrandingData {
  whiteLabel?: boolean;
  colorAccent?: string;
  colorAccentInk?: string;
  colorBg?: string;
  colorBgDark?: string;
  fontFamily?: string;
  copy?: Record<string, unknown>;
  logoUrl?: string;
  logoLightUrl?: string;
}

async function fetchImageAsBase64(url: string): Promise<string> {
  try {
    const response = await fetch(url);
    if (!response.ok) return "";
    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    const contentType = response.headers.get("content-type") || "image/png";
    return `data:${contentType};base64,${base64}`;
  } catch {
    return "";
  }
}

function formatCurrency(cents: number, locale: string = "it-IT"): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency: "EUR", minimumFractionDigits: 2 }).format(cents / 100);
}

function formatNumber(num: number, locale: string = "it-IT"): string {
  return new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num);
}

interface PricingConfig {
  materials: Record<string, { basePerM2: number; profilePerMl: number; qualities: Record<string, number> }>;
  sashType: Record<string, number>;
  hardware: Record<string, number>;
  hardwareColor: Record<string, number>;
  glazing: Record<string, number>;
  color: Record<string, number>;
  insectScreenType: Record<string, number>;
  insectScreenColor: Record<string, number>;
  installation: Record<string, number>;
  balconyDoorThreshold: number;
  vatRate: number;
  ecobonusPercent: number;
  discountPercent: number;
  brandMultiplier: { pvc: Record<string, number>; aluminum: Record<string, number> };
}

function computeUw(item: QuoteItem, pricing: PricingConfig): number {
  const U_FRAME_BASE: Record<string, number> = { pvc: 1.3, wood: 1.2, aluminum: 1.6 };
  const U_FRAME_QUALITY: Record<string, Record<string, number>> = {
    pvc: { chamber5: 0, chamber7: -0.15 },
    wood: { pine: 0, oak: -0.05 },
    aluminum: { standard: 0, thermalbreak: -0.5 },
  };
  const U_GLASS: Record<string, number> = { double: 1.1, triple: 0.6, tripleLowE: 0.5 };
  const GLASS_TO_FRAME_RATIO = 0.7;

  const frameU = U_FRAME_BASE[item.material] + (U_FRAME_QUALITY[item.material]?.[item.quality] || 0);
  const glassU = U_GLASS[item.glazing] || 1.1;
  return GLASS_TO_FRAME_RATIO * glassU + (1 - GLASS_TO_FRAME_RATIO) * frameU;
}

function generateQuoteHTML(data: QuotePDFData): string {
  const locale = data.leadLocale || "it-IT";
  const company = data.companyInfo;
  const branding = data.branding;
  const accent = branding.colorAccent || "#16d19d";
  const accentInk = branding.colorAccentInk || "#04231a";
  const fontFamily = branding.fontFamily || "Space Grotesk, sans-serif";
  const whiteLabel = branding.whiteLabel === true;
  const logoUrl = branding.logoUrl;
  
  const isDark = false; // PDF is light theme

  const totalItems = data.items.reduce((sum, item) => sum + item.totalPrice, 0);
  const vatAmount = data.priceCents - data.priceExVatCents;

  const uwValues = data.items.map(item => computeUw(item, {}));
  const totalArea = data.items.reduce((sum, item) => sum + (item.width / 1000) * (item.height / 1000) * item.quantity, 0);
  const weightedUw = uwValues.reduce((sum, uw, i) => sum + uw * ((data.items[i].width / 1000) * (data.items[i].height / 1000) * data.items[i].quantity), 0);
  const overallUw = totalArea > 0 ? weightedUw / totalArea : 0;

  const dateStr = new Date().toLocaleDateString(locale);
  const quoteNumber = `Q-${data.publicId.slice(0, 8).toUpperCase()}`;

  return `
<!DOCTYPE html>
<html lang="${locale.split("-")[0]}">
<head>
  <meta charset="UTF-8">
  <title>Preventivo ${quoteNumber}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
    
    * { box-sizing: border-box; margin: 0; padding: 0; }
    
    body {
      font-family: '${fontFamily}', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      color: #1d1d1f;
      background: #ffffff;
      line-height: 1.6;
      padding: 40px;
      -webkit-font-smoothing: antialiased;
    }
    
    .page { max-width: 210mm; margin: 0 auto; }
    
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 40px;
      padding-bottom: 20px;
      border-bottom: 2px solid #e8e8ed;
    }
    
    .logo-section { display: flex; align-items: center; gap: 16px; }
    .logo-img { height: 60px; width: auto; max-width: 200px; }
    .logo-placeholder {
      width: 60px; height: 60px;
      background: ${accent};
      color: ${accentInk};
      display: flex; align-items: center; justify-content: center;
      border-radius: 12px;
      font-family: 'IBM Plex Mono', monospace;
      font-weight: 600; font-size: 14px;
    }
    
    .company-info h1 { font-size: 28px; font-weight: 700; color: #1d1d1f; margin: 0 0 8px; }
    .company-details { color: #6e6e73; font-size: 13px; line-height: 1.8; }
    
    .quote-meta {
      text-align: right;
      font-family: 'IBM Plex Mono', monospace;
    }
    .quote-number { font-size: 24px; font-weight: 700; color: ${accent}; margin-bottom: 8px; }
    .quote-date { color: #6e6e73; font-size: 14px; }
    
    .customer-section {
      margin-bottom: 32px;
      padding: 20px;
      background: #f5f5f7;
      border-radius: 12px;
    }
    .section-title { font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: #6e6e73; margin-bottom: 12px; }
    .customer-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
    .customer-field { font-size: 14px; }
    .customer-label { color: #6e6e73; font-weight: 500; }
    .customer-value { color: #1d1d1f; font-family: 'IBM Plex Mono', monospace; }
    
    .items-table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    .items-table th { text-align: left; padding: 12px 16px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: #6e6e73; border-bottom: 2px solid #e8e8ed; }
    .items-table td { padding: 16px; border-bottom: 1px solid #e8e8ed; font-size: 13px; }
    .items-table tr:last-child td { border-bottom: none; }
    .items-table tr:hover td { background: #f5f5f7; }
    .item-name { font-weight: 600; color: #1d1d1f; }
    .item-details { color: #6e6e73; font-size: 12px; font-family: 'IBM Plex Mono', monospace; margin-top: 4px; }
    .item-price { text-align: right; font-family: 'IBM Plex Mono', monospace; font-weight: 600; color: #1d1d1f; white-space: nowrap; }
    
    .totals { width: 300px; margin-left: auto; }
    .total-row { display: flex; justify-content: space-between; padding: 8px 0; font-size: 14px; }
    .total-label { color: #6e6e73; }
    .total-value { font-family: 'IBM Plex Mono', monospace; font-weight: 600; color: #1d1d1f; }
    .total-divider { border-top: 1px solid #e8e8ed; margin: 8px 0; }
    .grand-total { font-size: 18px; font-weight: 700; color: ${accent}; }
    .vat-row { color: #6e6e73; font-size: 13px; }
    
    .uw-section { margin-top: 32px; padding: 16px; background: #f5f5f7; border-radius: 12px; }
    .uw-value { font-family: 'IBM Plex Mono', monospace; font-size: 24px; font-weight: 700; color: ${accent}; }
    
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e8e8ed; text-align: center; color: #6e6e73; font-size: 12px; }
    .disclaimer { font-style: italic; margin-top: 8px; }
    
    @media print {
      body { padding: 0; }
      .page { max-width: none; }
    }
  </style>
</head>
<body>
  <div class="page">
    <header class="header">
      <div class="logo-section">
        ${logoUrl ? `<img src="${logoUrl}" alt="${company.name}" class="logo-img" />` : `<div class="logo-placeholder">O/D</div>`}
        <div class="company-info">
          <h1>${company.name}</h1>
          <div class="company-details">
            ${company.address ? `${company.address}<br>` : ""}
            ${company.vatId ? `P.IVA: ${company.vatId}<br>` : ""}
            ${company.phone ? `Tel: ${company.phone}<br>` : ""}
            ${company.email ? `Email: ${company.email}` : ""}
          </div>
        </div>
      </div>
      <div class="quote-meta">
        <div class="quote-number">Preventivo ${data.publicId.slice(0, 8).toUpperCase()}</div>
        <div class="quote-date">${new Date().toLocaleDateString(locale)}</div>
      </div>
    </header>

    <section class="customer-section">
      <div class="section-title">Cliente</div>
      <div class="customer-grid">
        <div class="customer-field"><span class="customer-label">Nome:</span> <span class="customer-value">${data.leadName}</span></div>
        <div class="customer-field"><span class="customer-label">Email:</span> <span class="customer-value">${data.leadEmail}</span></div>
        ${data.leadPhone ? `<div class="customer-field"><span class="customer-label">Telefono:</span> <span class="customer-value">${data.leadPhone}</span></div>` : ""}
        ${data.leadCompany ? `<div class="customer-field"><span class="customer-label">Azienda:</span> <span class="customer-value">${data.leadCompany}</span></div>` : ""}
      </div>
    </section>

    <table class="items-table">
      <thead>
        <tr>
          <th style="width: 40%">Prodotto</th>
          <th style="width: 20%">Dimensioni</th>
          <th style="width: 10%">Qtà</th>
          <th style="width: 15%">Prezzo unit.</th>
          <th style="width: 15%">Totale</th>
        </tr>
      </thead>
      <tbody>
        ${data.items.map((item, i) => `
          <tr>
            <td>
              <div class="item-name">${item.productType === "window" ? "Finestra" : "Portafinestra"} - ${materialLabel(item.material)} ${item.quality}</div>
              <div class="item-details">
                Vetro: ${glazingLabel(item.glazing)} | Colore: ${colorLabel(item.color)}
                ${item.sashes.map(s => ` | Anta ${s.type}/${s.direction}`).join("")}
                ${item.insectScreen ? " | Zanzariera" : ""}
              </div>
            </td>
            <td class="item-details">${item.width} × ${item.height} mm</td>
            <td class="item-details">${item.quantity}</td>
            <td class="item-price">${formatCurrency(item.unitPrice, locale)}</td>
            <td class="item-price">${formatCurrency(item.totalPrice, locale)}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>

    <div class="totals">
      <div class="total-row"><span class="total-label">Subtotale</span><span class="total-value">${formatCurrency(totalItems, locale)}</span></div>
      <div class="total-row vat-row"><span class="total-label">IVA (${data.vatRatePercent}%)</span><span class="total-value">${formatCurrency(vatAmount, locale)}</span></div>
      <div class="total-divider"></div>
      <div class="total-row grand-total"><span class="total-label">Totale</span><span class="total-value">${formatCurrency(data.priceCents, locale)}</span></div>
    </div>

    <section class="uw-section">
      <div class="section-title">Coefficiente Termico Uw (indicativo)</div>
      <div class="uw-value">${overallUw.toFixed(2)} W/m²K</div>
      <div style="margin-top: 8px; font-size: 12px; color: #6e6e73;">Valore medio ponderato per superficie. Stima indicativa, non certificata EN ISO 10077.</div>
    </section>

    ${data.leadMessage ? `
    <section style="margin-top: 32px; padding: 16px; background: #f5f5f7; border-radius: 12px;">
      <div class="section-title">Note del cliente</div>
      <p style="white-space: pre-wrap; color: #1d1d1f;">${data.leadMessage}</p>
    </section>
    ` : ""}

    <footer class="footer">
      <p>${whiteLabel ? "" : "Generato con onespec — "}Configuratore infissi professionale</p>
      <p class="disclaimer">Questo preventivo è indicativo. Il prezzo definitivo viene confermato dopo sopralluogo tecnico.</p>
      <p>Preventivo ${quoteNumber} · ${dateStr} · ${company.name}</p>
    </footer>
  </div>
</body>
</html>
`;
}

function materialLabel(key: string): string {
  const labels: Record<string, string> = { pvc: "PVC", wood: "Legno", aluminum: "Alluminio" };
  return labels[key] || key;
}

function glazingLabel(key: string): string {
  const labels: Record<string, string> = { double: "Doppio", triple: "Triplo", tripleLowE: "Triplo Low-E" };
  return labels[key] || key;
}

function colorLabel(key: string): string {
  const labels: Record<string, string> = { white: "Bianco", ral: "RAL", woodeffect: "Effetto legno" };
  return labels[key] || key;
}

export const generateQuotePDF = action({
  args: { 
    quoteId: v.id("quoteRequests"),
    tenantId: v.id("tenants"),
    configuratorId: v.id("configurators"),
  },
  handler: async (ctx, args) => {
    // Fetch all data
    const [quote, tenant, configurator, branding, catalogVersion] = await Promise.all([
      ctx.runQuery(internal.quotes.getRequest, { quoteId: args.quoteId }),
      ctx.runQuery(internal.tenants.getTenant, { tenantId: args.tenantId }),
      ctx.runQuery(internal.configurators.getConfigurator, { configuratorId: args.configuratorId }),
      ctx.runQuery(internal.branding.getBranding, { configuratorId: args.configuratorId }),
      ctx.runQuery(internal.configurators.getConfigurator, { configuratorId: args.configuratorId }).then(c => c?.publishedCatalogVersion),
    ]);

    if (!quote || !tenant || !configurator) {
      throw new Error("Missing data for PDF generation");
    }

    // Get logo as base64
    const [logoBase64, logoLightBase64] = await Promise.all([
      branding?.logoStorageId ? ctx.storage.getUrl(branding.logoStorageId).then(fetchImageAsBase64).catch(() => "") : Promise.resolve(""),
      branding?.logoLightStorageId ? ctx.storage.getUrl(branding.logoLightStorageId).then(fetchImageAsBase64).catch(() => "") : Promise.resolve(""),
    ]);

    const pdfData: QuotePDFData = {
      quoteId: args.quoteId,
      tenantId: args.tenantId,
      configuratorId: args.configuratorId,
      leadName: quote.leadName,
      leadEmail: quote.leadEmail,
      leadPhone: quote.leadPhone,
      leadCompany: quote.leadCompany,
      leadMessage: quote.leadMessage,
      items: quote.items,
      priceCents: quote.priceCents,
      priceExVatCents: quote.priceExVatCents,
      vatRatePercent: quote.vatRatePercent,
      companyInfo: tenant.companyInfo || { name: tenant.name },
      branding: {
        whiteLabel: branding?.whiteLabel,
        colorAccent: branding?.colorAccent,
        colorAccentInk: branding?.colorAccentInk,
        colorBg: branding?.colorBg,
        colorBgDark: branding?.colorBgDark,
        fontFamily: branding?.fontFamily,
        copy: branding?.copy,
        logoUrl: logoBase64 || branding?.logoUrl,
        logoLightUrl: logoLightBase64 || branding?.logoLightUrl,
      },
      catalogVersion: catalogVersion || 0,
      publicId: configurator.publicId,
      leadLocale: quote.leadLocale || "it",
    };

    const html = generateQuoteHTML(pdfData);
    
    // Use a headless browser approach or PDFKit
    // For now, return HTML that can be converted to PDF
    return { html, pdfData };
  },
});

// Helper to convert HTML to PDF using a simple approach
export const htmlToPDF = action({
  args: { html: v.string(), fileName: v.string() },
  handler: async (ctx, args) => {
    // In production, use a headless browser (Puppeteer) or PDFKit
    // For now, return the HTML that the frontend can print
    return { html: args.html };
  },
});