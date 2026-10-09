import type { TestConvex } from "convex-test";
import schema from "../../convex/schema";
import { api, internal } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { defaultItem } from "../shared/item-defaults";
import { CATEGORY_DEFS } from "../shared/configurator-model";
import type { CatalogPayload, ProjectItem } from "../shared/pricing";
import { signatureDataUrl } from "./png";
import { ProjectItemSchema } from "../shared/widget-types";

/**
 * The company the public demo opens on: "Serramenti Ferrari", a window installer in Lombardy, with a year of believable activity —
 * customers, building sites, quotes in every state, requests from the web widget, leads to work through, supply, logistics, surveys,
 * inspections, passports and notifications. Everything is created through the REAL Convex functions (so every figure is computed by
 * the platform, not typed in), with the clock set back while each record is made so the charts have a history.
 */

export interface DemoSeedInfo {
  ownerId: string;
  tenantId: string;
}

type T = TestConvex<typeof schema>;

const DAY = 86_400_000;

/** Small deterministic generator: the demo is the same every time it starts. */
function rng(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min: number, max: number) => Math.floor(next() * (max - min + 1)) + min,
    pick: <X,>(list: readonly X[]): X => list[Math.floor(next() * list.length)],
    chance: (p: number) => next() < p,
  };
}

/** Runs `fn` with the clock set to `ts`, so what it writes carries that date. */
async function at<R>(ts: number, fn: () => Promise<R>): Promise<R> {
  const real = Date.now;
  Date.now = () => ts;
  try {
    return await fn();
  } finally {
    Date.now = real;
  }
}

const FIRST_NAMES = ["Marco", "Luca", "Giulia", "Francesca", "Andrea", "Chiara", "Matteo", "Sara", "Davide", "Elena", "Paolo", "Valentina", "Simone", "Alessia", "Stefano", "Martina", "Roberto", "Federica", "Giorgio", "Silvia"];
const LAST_NAMES = ["Rossi", "Bianchi", "Conti", "Greco", "Ferri", "Colombo", "Ricci", "Marino", "Gallo", "Fontana", "Moretti", "Barbieri", "Lombardi", "Giordano", "Mancini", "Rinaldi", "Caruso", "Villa", "Cattaneo", "Brambilla"];
const CITIES: Array<[string, string, string]> = [
  ["Milano", "20121", "Via Torino"], ["Bergamo", "24122", "Via Pignolo"], ["Brescia", "25121", "Corso Zanardelli"], ["Monza", "20900", "Via Italia"],
  ["Como", "22100", "Via Milano"], ["Varese", "21100", "Via Veratti"], ["Lecco", "23900", "Corso Matteotti"], ["Pavia", "27100", "Corso Strada Nuova"],
  ["Cremona", "26100", "Via Mercatello"], ["Lodi", "26900", "Via Garibaldi"], ["Legnano", "20025", "Corso Magenta"], ["Busto Arsizio", "21052", "Via Mazzini"],
];
const COMPANY_NAMES = ["Edilizia Bianchi Srl", "Costruzioni Villa & Figli", "Immobiliare Duomo Srl", "Studio Tecnico Mancini", "Rinaldi Impianti Spa", "Cooperativa Edile Lombarda", "Studio Associato Fontana", "Residenze del Lago Srl", "Colombo Ristrutturazioni", "Gallo Costruzioni Srl", "Hotel Belvedere Spa", "Condominio Parco Verde"];


export async function seedDemo(t: T): Promise<DemoSeedInfo> {
  const r = rng(829);
  const now = Date.now();
  const startOfHistory = now - 330 * DAY;

  // ── company, team, settings ────────────────────────────────────────────────────────────────────────────────────────────────────
  const base = await t.run(async (ctx) => {
    await ctx.db.insert("appSettings", { key: "global", registrationOpen: true, resendMode: "noop", updatedAt: now });
    const mk = (name: string, email: string) => ctx.db.insert("users", { name, email, emailVerificationTime: now, locale: "it" });
    const ownerId = await mk("Giulia Ferrari", "giulia@serramenti-ferrari.it");
    const adminId = await mk("Marco Colombo", "marco@serramenti-ferrari.it");
    const salesId = await mk("Sara Bianchi", "sara@serramenti-ferrari.it");
    const fitterId = await mk("Davide Rinaldi", "davide@serramenti-ferrari.it");
    const tenantId = await ctx.db.insert("tenants", {
      name: "Serramenti Ferrari Srl",
      slug: "serramenti-ferrari",
      ownerUserId: ownerId,
      country: "IT",
      priceZone: "nord",
      plan: "enterprise",
      planStatus: "active",
      createdVia: "open_signup",
      createdAt: startOfHistory,
      unlimitedAccess: true,
      onboardingCompletedAt: startOfHistory + DAY,
      vatId: "IT00905811006",
      addressStreet: "Via dei Mille 12",
      addressPostalCode: "20900",
      addressCity: "Monza",
      address: "Via dei Mille 12, 20900 Monza",
      phone: "+39 039 1234567",
      companyEmail: "info@serramenti-ferrari.it",
      website: "https://www.serramenti-ferrari.it",
      viesAckAt: startOfHistory,
      defaultVatPercent: 22,
      defaultMarginPercent: 18,
      pricingSavedAt: startOfHistory,
    });
    for (const [userId, role] of [[ownerId, "owner"], [adminId, "admin"], [salesId, "member"], [fitterId, "member"]] as const) {
      await ctx.db.insert("memberships", { tenantId, userId, role, status: "active", acceptedAt: startOfHistory });
    }
    return { ownerId, adminId, salesId, fitterId, tenantId };
  });
  const { ownerId, adminId, salesId, fitterId, tenantId } = base;
  const as = t.withIdentity({ subject: ownerId, issuer: "demo", tokenIdentifier: `demo|${ownerId}` });

  // ── configurators: the web widget, the showroom tool and the simple wizard ─────────────────────────────────────────────────────
  const mkConfigurator = async (name: string, widgetStyle?: "standard" | "wizard") => {
    const created = await at(startOfHistory + 2 * DAY, () => as.mutation(api.configurators.createConfigurator, { tenantId, name }));
    if (widgetStyle) await as.mutation(api.configurators.updateConfigurator, { configuratorId: created.configuratorId, widgetStyle });
    await at(startOfHistory + 3 * DAY, () => as.mutation(api.configurators.publishConfigurator, { configuratorId: created.configuratorId }));
    return created;
  };
  const widgetCfg = await mkConfigurator("Preventivatore sito web");
  const showroomCfg = await mkConfigurator("Showroom e consulenza");
  const wizardCfg = await mkConfigurator("Wizard per i social", "wizard");
  await as.mutation(api.configurators.createConfigurator, { tenantId, name: "Linea alluminio (bozza)" });

  const catalog = await t.run(async (ctx) => {
    const c = await ctx.db.get(showroomCfg.configuratorId);
    const v = await ctx.db
      .query("catalogVersions")
      .withIndex("by_configurator_version", (q) => q.eq("configuratorId", showroomCfg.configuratorId).eq("version", c?.publishedCatalogVersion ?? 1))
      .first();
    return v!.payload as CatalogPayload;
  });
  const finishKeys = ((catalog as unknown as { finish: Array<{ key: string; enabled: boolean; sortOrder?: number }> }).finish ?? []).filter((f) => f.enabled).map((f) => f.key);
  const pickFinish = (...pref: string[]) => pref.find((k) => finishKeys.includes(k)) ?? finishKeys[0];

  // ── customers ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  const clientIds: Array<{ id: Id<"clients">; name: string; city: [string, string, string]; email: string; phone: string }> = [];
  const clientSpecs: Array<{ name: string; contact?: string; type: "private" | "company" | "developer" | "architect" | "contractor"; vat?: string }> = [
    ...Array.from({ length: 14 }, (_, i) => ({ name: `${FIRST_NAMES[i % FIRST_NAMES.length]} ${LAST_NAMES[(i * 3) % LAST_NAMES.length]}`, type: "private" as const })),
    ...COMPANY_NAMES.slice(0, 5).map((n, i) => ({ name: n, contact: `${FIRST_NAMES[(i * 4 + 1) % 20]} ${LAST_NAMES[(i * 5 + 2) % 20]}`, type: (i % 2 === 0 ? "company" : "contractor") as "company" | "contractor", vat: `IT0${(1234567890 + i * 17).toString().slice(0, 10)}` })),
    ...COMPANY_NAMES.slice(5, 8).map((n, i) => ({ name: n, contact: `${FIRST_NAMES[(i * 6 + 3) % 20]} ${LAST_NAMES[(i * 7 + 1) % 20]}`, type: "developer" as const, vat: `IT0${(2234567890 + i * 29).toString().slice(0, 10)}` })),
    ...COMPANY_NAMES.slice(8, 11).map((n, i) => ({ name: n, contact: `${FIRST_NAMES[(i * 2 + 9) % 20]} ${LAST_NAMES[(i * 3 + 5) % 20]}`, type: "architect" as const })),
  ];
  for (const [i, spec] of clientSpecs.entries()) {
    const city = CITIES[i % CITIES.length];
    const first = (spec.contact ?? spec.name).split(" ")[0];
    const email = `${first.toLowerCase()}.${(spec.contact ?? spec.name).split(" ").pop()!.toLowerCase().replace(/[^a-z]/g, "")}@${spec.type === "private" ? "gmail.com" : "studio-demo.it"}`;
    const phone = `+39 3${r.int(20, 49)} ${r.int(100, 999)} ${r.int(1000, 9999)}`;
    const when = startOfHistory + 5 * DAY + Math.floor((i / clientSpecs.length) * 280) * DAY;
    const res = await at(when, () =>
      as.mutation(api.clients.createClient, {
        tenantId,
        name: spec.name,
        contactName: spec.contact,
        email,
        phone,
        billingAddress: `${city[2]} ${r.int(1, 120)}`,
        billingCity: city[0],
        billingPostalCode: city[1],
        billingCountry: "IT",
        siteAddress: `${city[2]} ${r.int(1, 120)}`,
        siteCity: city[0],
        sitePostalCode: city[1],
        siteCountry: "IT",
        vatNumber: spec.vat,
        type: spec.type,
        tags: spec.type === "private" ? ["privato"] : spec.type === "architect" ? ["prescrittore"] : ["professionale"],
        source: r.pick(["widget", "passaparola", "showroom", "fiera", "sito web"]),
        status: i % 7 === 0 ? "prospect" : "active",
        assignedToUserId: r.pick([ownerId, salesId, adminId]),
      }),
    );
    const id = (res as { clientId?: Id<"clients"> }).clientId ?? (res as unknown as Id<"clients">);
    clientIds.push({ id, name: spec.name, city, email, phone });
  }
  for (const [i, c] of clientIds.slice(0, 8).entries()) {
    await at(now - (i + 2) * 6 * DAY, () => as.mutation(api.clients.addClientActivity, { clientId: c.id, type: i % 2 ? "call" : "note", title: i % 2 ? "Chiamata per confermare il sopralluogo" : "Preferenze colore", description: i % 2 ? undefined : "Preferisce antracite all'esterno e bianco all'interno (bicolore)." }));
  }

  // ── building sites ────────────────────────────────────────────────────────────────────────────────────────────────────────────
  const SITE_STATUS = ["preventivo", "confermato", "in_produzione", "pronto_consegna", "in_posa", "collaudo", "chiuso"] as const;
  const cantiereIds: Array<{ id: Id<"cantieri">; clientIdx: number; status: (typeof SITE_STATUS)[number] }> = [];
  for (let i = 0; i < 14; i++) {
    const c = clientIds[(i * 2) % clientIds.length];
    const city = c.city;
    const status = SITE_STATUS[i % SITE_STATUS.length];
    const start = now + (i - 7) * 9 * DAY;
    const res = await at(now - (60 - i * 4) * DAY, () =>
      as.mutation(api.cantieri.createCantiere, {
        tenantId,
        name: i % 3 === 0 ? `Sostituzione serramenti ${c.name.split(" ").pop()}` : i % 3 === 1 ? `Ristrutturazione ${city[0]} ${city[2].replace(/^Via |^Corso /, "")}` : `Nuova costruzione lotto ${i + 1}`,
        address: `${city[2]} ${r.int(2, 90)}`,
        city: city[0],
        postalCode: city[1],
        country: "IT",
        clientId: c.id,
        status,
        priority: r.pick(["low", "medium", "high", "urgent"] as const),
        assignedUserIds: [fitterId, salesId].slice(0, 1 + (i % 2)),
        estimatedStartAt: start,
        estimatedEndAt: start + r.int(3, 14) * DAY,
        valueCents: r.int(30, 180) * 10000,
        notes: "Verificare accessi per il ponteggio e la consegna del materiale.",
      }),
    );
    const id = (res as { cantiereId?: Id<"cantieri"> }).cantiereId ?? (res as unknown as Id<"cantieri">);
    cantiereIds.push({ id, clientIdx: (i * 2) % clientIds.length, status });
    for (const [k, title] of ["Sopralluogo e misure definitive", "Conferma colori e ferramenta", "Ordine in fabbrica", "Smontaggio vecchi infissi", "Posa e sigillatura"].slice(0, 2 + (i % 4)).entries()) {
      await as.mutation(api.cantieri.createCantiereTask, { tenantId, cantiereId: id, title, dueAt: start + k * 2 * DAY });
    }
  }

  // ── quotes (B2B) in every state, spread over the year ───────────────────────────────────────────────────────────────────────────
  const CATEGORIES = ["finestra1", "finestra2", "finestra2", "finestra3", "porta1", "porta2", "scorrevole", "finestra2"] as const;
  const makeItems = (count: number) =>
    Array.from({ length: count }, () => {
      const cat = r.pick(CATEGORIES);
      const leaves = CATEGORY_DEFS[cat].leaves;
      const width = leaves === 1 ? r.int(7, 11) * 100 : leaves === 2 ? r.int(11, 20) * 100 : r.int(18, 26) * 100;
      const item = defaultItem(catalog, cat, { width: cat === "scorrevole" ? r.int(20, 30) * 100 : width, height: cat.startsWith("finestra") ? r.int(11, 17) * 100 : 2100 });
      const exterior = r.pick([pickFinish("anthracite", "white"), pickFinish("white"), pickFinish("woodgrain", "white")]);
      const bicolor = r.chance(0.3);
      return { ...item, quantity: r.int(1, 6), color: exterior, ...(bicolor && exterior !== pickFinish("white") ? { colorInside: pickFinish("white") } : {}) } as ProjectItem;
    });

  {
    const probe = makeItems(1)[0];
    const parsed = ProjectItemSchema.safeParse(probe);
    if (!parsed.success) throw new Error("demo item invalid: " + JSON.stringify(parsed.error.issues.slice(0, 4)));
  }
  type Q = { id: Id<"quoteRequests">; clientIdx: number };
  const quotes: Q[] = [];
  const QUOTE_TOTAL = 36;
  for (let i = 0; i < QUOTE_TOTAL; i++) {
    const clientIdx = i % clientIds.length;
    const c = clientIds[clientIdx];
    const when = startOfHistory + 12 * DAY + Math.floor((i / QUOTE_TOTAL) * 300) * DAY + r.int(0, 20) * 3_600_000;
    const asDraft = i % 17 === 5;
    const res = await at(when, () =>
      as.mutation(api.quotes.createFieldQuote, {
        tenantId,
        configuratorId: showroomCfg.configuratorId,
        leadName: c.name,
        leadEmail: c.email,
        leadPhone: c.phone,
        customerAddress: `${c.city[2]} ${r.int(2, 90)}`,
        customerCity: c.city[0],
        customerPostalCode: c.city[1],
        leadLocale: "it",
        items: makeItems(r.int(1, 3)),
        installationType: "included",
        discountPercent: r.chance(0.3) ? r.pick([3, 5, 8]) : 0,
        ecobonusPercent: r.chance(0.25) ? 50 : 0,
        clientId: c.id,
        asDraft,
      } as never),
    );
    const quoteId = (res as { quoteId: Id<"quoteRequests"> }).quoteId;
    quotes.push({ id: quoteId, clientIdx });
    if (asDraft) continue;
    // Where the deal went: most are won or still open, some lost.
    const old = i < QUOTE_TOTAL - 8;
    const outcome = old ? r.pick(["won", "won", "won", "lost", "contacted", "won"] as const) : r.pick(["quoted", "quoted", "contacted", "quoted", "won"] as const);
    if (outcome !== "quoted") await at(when + 2 * DAY, () => as.mutation(api.quotes.updateStatus, { quoteId, status: outcome }));
    if (outcome === "won" && i % 2 === 0) {
      await at(when + 3 * DAY, () => as.mutation(api.quotes.signQuote, { quoteId, signatureDataUrl: signatureDataUrl(i), signedByName: c.name }));
    }
  }

  // ── requests from the public widget (they feed Richieste and the statistics) ───────────────────────────────────────────────────
  const WIDGET_TOTAL = 44;
  for (let i = 0; i < WIDGET_TOTAL; i++) {
    const first = r.pick(FIRST_NAMES);
    const last = r.pick(LAST_NAMES);
    const city = r.pick(CITIES);
    const when = startOfHistory + 15 * DAY + Math.floor((i / WIDGET_TOTAL) * 310) * DAY + r.int(0, 23) * 3_600_000;
    const recent = i >= WIDGET_TOTAL - 6;
    const res = await at(when, () =>
      as.mutation(api.quotes.createFieldQuote, {
        tenantId,
        configuratorId: widgetCfg.configuratorId,
        leadName: `${first} ${last}`,
        leadEmail: `${first.toLowerCase()}.${last.toLowerCase()}${r.int(1, 99)}@${r.pick(["gmail.com", "libero.it", "outlook.it", "icloud.com"])}`,
        leadPhone: `+39 3${r.int(20, 49)} ${r.int(100, 999)} ${r.int(1000, 9999)}`,
        customerCity: city[0],
        customerPostalCode: city[1],
        leadLocale: "it",
        leadMessage: r.pick(["Vorrei sostituire le finestre del soggiorno entro l'estate.", "Preventivo per 6 finestre, casa del 1985.", "Ristrutturazione completa: serve anche la posa?", "Mi interessano i serramenti con triplo vetro.", ""]),
        items: makeItems(r.int(1, 2)),
        installationType: "included",
        autoLink: false,
      } as never),
    );
    const quoteId = (res as { quoteId: Id<"quoteRequests"> }).quoteId;
    const status = recent ? r.pick(["new", "new", "contacted"] as const) : r.pick(["new", "contacted", "quoted", "won", "lost", "won", "spam"] as const);
    await t.run(async (ctx) => {
      await ctx.db.patch(quoteId, { channel: "widget", sourceOrigin: "https://www.serramenti-ferrari.it/preventivo", status });
    });
  }

  // ── leads: a list from a spreadsheet, a few already worked ──────────────────────────────────────────────────────────────────────
  const leadIds: Array<Id<"leads">> = [];
  for (let i = 0; i < 36; i++) {
    const first = FIRST_NAMES[i % FIRST_NAMES.length];
    const last = LAST_NAMES[(i * 7) % LAST_NAMES.length];
    const city = CITIES[(i * 5) % CITIES.length];
    const business = i % 4 === 0;
    try {
      const res = await at(now - (36 - i) * 3 * DAY, () =>
        as.mutation(api.leads.createLead, {
          tenantId,
          name: business ? `${last} Serramenti & Co` : `${first} ${last}`,
          firstName: first,
          lastName: last,
          company: business ? `${last} Immobiliare Srl` : undefined,
          email: `${first.toLowerCase()}.${last.toLowerCase()}${i}@${business ? "azienda-demo.it" : "gmail.com"}`,
          phone: `+39 3${r.int(20, 49)} ${r.int(100, 999)} ${r.int(1000, 9999)}`,
          city: city[0],
          postalCode: city[1],
          notes: r.pick(["Contatto da fiera", "Chiedere preventivo per 8 finestre", "Richiamare a settembre", "", "Referenziato da un cliente"]),
          tags: business ? "azienda" : "privato",
          source: r.pick(["Fiera casa 2026", "Lista contatti", "Campagna social"]),
        } as never),
      );
      leadIds.push((res as { leadId: Id<"leads"> }).leadId);
    } catch {
      /* a duplicate in the generated list is simply skipped */
    }
  }
  if (leadIds.length > 8) {
    await as.mutation(api.leads.convertLeadsToClients, { leadIds: leadIds.slice(0, 4) } as never).catch(() => undefined);
    await as.mutation(api.leads.linkLeadToCantiere, { leadId: leadIds[5], cantiereId: cantiereIds[2].id } as never).catch(() => undefined);
  }


  // ── suppliers, supply, logistics ───────────────────────────────────────────────────────────────────────────────────────────────
  const partnerSpecs: Array<[string, Array<"producer" | "deliverer">]> = [
    ["Finstral Lombardia (fabbrica)", ["producer", "deliverer"]],
    ["Oknoplast Italia", ["producer"]],
    ["Trasporti Rapidi Brianza", ["deliverer"]],
  ];
  const partnerIds: Array<Id<"supplyPartners">> = [];
  for (const [name, roles] of partnerSpecs) {
    const id = await at(startOfHistory + 20 * DAY, () =>
      as.mutation(api.supplies.createPartner, { tenantId, name, roles, contactName: "Ufficio commerciale", phone: "+39 02 1234567", email: `ordini@${name.split(" ")[0].toLowerCase()}.it` } as never),
    );
    partnerIds.push(id as Id<"supplyPartners">);
  }
  await as.mutation(api.suppliers.createSupplier, { tenantId, name: "Vetreria Lombarda", email: "info@vetreria-lombarda.it", leadTimeDays: 9 }).catch(() => undefined);

  const supplies = await t.run((ctx) => ctx.db.query("supplies").collect());
  for (const [i, sup] of supplies.entries()) {
    const steps = i % 5; // how far each supply got: from "ordine" to "consegnato"
    for (let k = 0; k < steps; k++) {
      await at(now - (steps - k) * 6 * DAY, () =>
        as.mutation(api.supplies.advance, { supplyId: sup._id, ...(k === 0 ? { producerId: partnerIds[i % 2], factoryCostCents: r.int(80, 420) * 1000 / 10 } : {}), ...(k === 2 ? { delivererId: partnerIds[2], transportCostCents: r.int(8, 24) * 1000 } : {}) } as never).catch(() => undefined),
      );
    }
  }

  const logSup = await as.mutation(api.logistics.createLogisticsSupplier, { tenantId, name: "Magazzino centrale Monza", contactName: "Paolo Villa", phone: "+39 039 7654321", address: "Via Industria 5, Monza" } as never);
  const logSupplierId = ((logSup as { supplierId?: Id<"logisticsSuppliers"> }).supplierId ?? (logSup as unknown as Id<"logisticsSuppliers">)) as Id<"logisticsSuppliers">;
  const carrier = await as.mutation(api.logistics.createCarrier, { tenantId, name: "Corriere Express Nord", contactName: "Luca Gallo", phone: "+39 331 2345678" } as never);
  const carrierId = ((carrier as { carrierId?: Id<"carriers"> }).carrierId ?? (carrier as unknown as Id<"carriers">)) as Id<"carriers">;
  for (let i = 0; i < 6; i++) {
    const site = cantiereIds[i];
    await as.mutation(api.logistics.createDelivery, { tenantId, supplierId: logSupplierId, carrierId, driverName: r.pick(["Mario", "Enzo", "Fabio"]) + " " + r.pick(LAST_NAMES), driverPhone: "+39 340 1112233", scheduledDate: now + (i - 2) * 3 * DAY, cantiereId: site.id, notes: "Consegna con sponda idraulica", expectedItems: ["Finestre 2 ante", "Portafinestra", "Controtelai"] } as never).catch(() => undefined);
  }
  await t.run(async (ctx) => {
    for (const [i, label] of ["Finestre PVC 2 ante", "Portafinestre scorrevoli", "Controtelai", "Zanzariere", "Guarnizioni e accessori", "Soglie in alluminio"].entries()) {
      await ctx.db.insert("inventoryItems", { tenantId, label, category: i < 2 ? "serramenti" : "accessori", quantity: r.int(4, 40), unit: "pz", status: i % 3 === 0 ? "in_stock" : i % 3 === 1 ? "assigned" : "in_transit", cantiereId: i % 3 ? cantiereIds[i].id : undefined, receivedAt: now - i * 5 * DAY, createdAt: now - i * 5 * DAY, updatedAt: now });
    }
  });

  // ── surveys, installation dossiers, inspections, passports ─────────────────────────────────────────────────────────────────────
  await t.run(async (ctx) => {
    const surveyIds: Array<Id<"siteSurveys">> = [];
    for (let i = 0; i < 9; i++) {
      const c = clientIds[(i * 3) % clientIds.length];
      const created = now - (50 - i * 5) * DAY;
      surveyIds.push(
        await ctx.db.insert("siteSurveys", {
          tenantId,
          regionCode: "IT",
          createdByUserId: i % 2 ? salesId : fitterId,
          customerName: c.name,
          customerAddress: `${c.city[2]} ${r.int(2, 90)}`,
          customerCity: c.city[0],
          customerPostalCode: c.city[1],
          clientId: c.id,
          cantiereId: cantiereIds[(i * 2) % cantiereIds.length].id,
          openings: Array.from({ length: r.int(2, 5) }, (_, k) => ({ label: `Apertura ${k + 1}`, widthMm: r.int(8, 18) * 100, heightMm: r.int(12, 22) * 100, room: r.pick(["Soggiorno", "Camera", "Cucina", "Bagno", "Studio"]), floor: r.pick(["PT", "1°", "2°"]) })),
          diagnostics: { wallType: r.pick(["Laterizio", "Cemento armato", "Pietra"]), counterFrame: r.pick(["Esistente in buono stato", "Da sostituire"]), mould: i % 6 === 0, floorAccess: r.pick(["Piano terra", "Scala", "Ascensore"]), craneRequired: i % 7 === 3, existingShutter: i % 2 === 0, notes: "Davanzali in marmo da proteggere." },
          status: i < 6 ? "completed" : "draft",
          completedAt: i < 6 ? created + DAY : undefined,
          createdAt: created,
          updatedAt: created + DAY,
        }),
      );
    }
    for (let i = 0; i < 5; i++) {
      await ctx.db.insert("installationDossiers", {
        tenantId,
        regionCode: "IT",
        surveyId: surveyIds[i],
        clientId: clientIds[(i * 3) % clientIds.length].id,
        cantiereId: cantiereIds[(i * 2) % cantiereIds.length].id,
        createdByUserId: fitterId,
        jobType: r.pick(["Sostituzione con controtelaio", "Nuova installazione", "Posa a filo muro"]),
        nodeType: r.pick(["standard", "insulated", "renovation"]),
        perimeterMm: r.int(40, 120) * 100,
        materials: [
          { key: "tape_internal", label: "Nastro interno (aria/vapore)", unit: "m", quantity: r.int(8, 30) },
          { key: "foam", label: "Schiuma poliuretanica a bassa espansione", unit: "bombola", quantity: r.int(1, 5) },
          { key: "tape_external", label: "Nastro esterno impermeabile", unit: "m", quantity: r.int(8, 30) },
        ],
        normRef: "UNI 11673-1",
        notes: "Posa qualificata con nastri e schiuma certificati.",
        createdAt: now - (35 - i * 6) * DAY,
        updatedAt: now - (34 - i * 6) * DAY,
      });
    }
    const inspectionIds: Array<Id<"inspectionReports">> = [];
    for (let i = 0; i < 7; i++) {
      const c = clientIds[(i * 2 + 1) % clientIds.length];
      const signed = i < 5;
      const created = now - (40 - i * 5) * DAY;
      inspectionIds.push(
        await ctx.db.insert("inspectionReports", {
          tenantId,
          regionCode: "IT",
          createdByUserId: fitterId,
          customerName: c.name,
          siteAddress: `${c.city[2]} ${r.int(2, 90)}, ${c.city[0]}`,
          clientId: c.id,
          cantiereId: cantiereIds[(i * 2) % cantiereIds.length].id,
          installerTeam: "Squadra A — Rinaldi",
          scheduledFor: created,
          photos: [{ key: "overall", label: "Vista complessiva" }, { key: "sealing", label: "Sigillatura perimetrale" }],
          checks: [
            { key: "level", label: "Messa in bolla e a piombo", passed: true },
            { key: "gaps", label: "Giochi e fughe uniformi", passed: true },
            { key: "sealing", label: "Nastri e sigillature", passed: i !== 6 },
            { key: "hardware", label: "Funzionamento ferramenta", passed: true },
          ],
          installerNotes: "Lavoro concluso senza criticità.",
          signatureDataUrl: signed ? signatureDataUrl(i + 3) : undefined,
          signedByName: signed ? c.name : undefined,
          signedAt: signed ? created + 3_600_000 : undefined,
          status: signed ? "signed" : "draft",
          createdAt: created,
          updatedAt: created + 3_600_000,
        }),
      );
    }
    for (let i = 0; i < 5; i++) {
      const c = clientIds[(i * 2 + 1) % clientIds.length];
      await ctx.db.insert("serramentoPassports", {
        tenantId,
        regionCode: "IT",
        inspectionId: inspectionIds[i],
        createdByUserId: ownerId,
        publicToken: `demo-passport-${i + 1}-${r.int(100000, 999999)}`,
        label: `Fascicolo del serramento — ${c.name}`,
        customerName: c.name,
        siteAddress: `${c.city[2]}, ${c.city[0]}`,
        productSummary: "Finestre PVC 5 camere, doppio vetro basso emissivo 24 mm, colore bicolore antracite/bianco",
        installedAt: now - (30 - i * 5) * DAY,
        documents: [
          { key: "dop", label: "Dichiarazione di prestazione (DoP)", required: true },
          { key: "ce", label: "Marcatura CE", required: true },
          { key: "warranty", label: "Garanzia del produttore", required: false },
        ],
        performanceDeclaration: "Uw 1,1 W/m²K — permeabilità all'aria classe 4 — tenuta all'acqua 7A",
        maintenanceLabel: "Manutenzione annuale ferramenta",
        maintenancePriceCents: 9000,
        maintenanceActive: i % 2 === 0,
        scanCount: r.int(0, 12),
        createdAt: now - (30 - i * 5) * DAY,
        updatedAt: now - (29 - i * 5) * DAY,
      });
    }
  });

  // ── the customer's folder: final quotes (PDF) ───────────────────────────────────────────────────────────────────────────────────
  await t.run(async (ctx) => {
    const wonQuotes = (await ctx.db.query("quoteRequests").withIndex("by_tenant_status", (q) => q.eq("tenantId", tenantId).eq("status", "won")).collect()).filter((q) => q.clientId).slice(0, 6);
    for (const [i, q] of wonQuotes.entries()) {
      const bytes = new TextEncoder().encode(`%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n`);
      const storageId = await ctx.storage.store(new Blob([bytes], { type: "application/pdf" }));
      await ctx.db.insert("clientDocuments", {
        tenantId,
        clientId: q.clientId!,
        cantiereId: q.cantiereId,
        quoteId: q._id,
        kind: "final_quote",
        title: `Offerta finale ${q.offerNumber ?? ""}`.trim(),
        fileName: `offerta-finale-${i + 1}.pdf`,
        storageId,
        sizeBytes: bytes.length,
        contentSha256: `demo${i}`,
        outcome: i % 3 === 2 ? "pending" : "accepted",
        amountCents: q.priceCents,
        uploadedBy: ownerId,
        createdAt: q._creationTime ?? now,
      } as never);
    }
    // ── notifications ───────────────────────────────────────────────────────────────────────────────────────────────────────────
    const notes: Array<[string, string, "quote_request_new" | "quote_status_changed" | "system" | "configurator_published" | "member_joined", string?]> = [
      ["Nuova richiesta dal sito", "Marco Rossi ha chiesto un preventivo per 4 finestre.", "quote_request_new", "/app/requests"],
      ["Preventivo vinto", "L'offerta per Edilizia Bianchi è stata accettata.", "quote_status_changed", "/app/quotes"],
      ["Nuova richiesta dal sito", "Laura Conti ha chiesto un preventivo per una portafinestra.", "quote_request_new", "/app/requests"],
      ["Configuratore pubblicato", "«Wizard per i social» è online.", "configurator_published", "/app/configurators"],
      ["Collega entrato nel team", "Davide Rinaldi si è unito alla squadra di posa.", "member_joined", "/app/account"],
      ["Consegna in arrivo", "Il corriere consegna domani al cantiere di Bergamo.", "system", "/app/logistics"],
    ];
    for (const [i, [title, body, type, href]] of notes.entries()) {
      await ctx.db.insert("notifications", { tenantId, userId: ownerId, type, title, body, href, readAt: i > 2 ? now - i * 3_600_000 : undefined });
    }
  });

  void internal;
  void adminId;
  void wizardCfg;
  return { ownerId: String(ownerId), tenantId: String(tenantId) };
}
