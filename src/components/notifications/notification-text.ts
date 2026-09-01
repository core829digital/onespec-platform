/**
 * Render a localized notification title from the row's `type` + structured
 * `data`. Rows written before i18n (no `data`) fall back to the stored `title`.
 */

type Translate = (key: string, values?: Record<string, string | number>) => string;

interface NotifRow {
  type: string;
  title: string;
  data?: unknown;
}

const str = (v: unknown) => (typeof v === "string" ? v : "");
const eur = (v: unknown) =>
  typeof v === "number"
    ? `€${(v / 100).toLocaleString("it-IT", { minimumFractionDigits: 2 })}`
    : "";

export function notificationText(t: Translate, n: NotifRow): string {
  const d = (n.data ?? null) as Record<string, unknown> | null;
  if (!d) return n.title;

  try {
    switch (n.type) {
      case "quote_request_new":
        return t("types.quote_request_new", {
          leadName: str(d.leadName) || "—",
          price: eur(d.priceCents) || "—",
        });
      case "quote_status_changed": {
        const s = str(d.newStatus);
        const label = s ? t(`status.${s}`) : s;
        return t("types.quote_status_changed", { leadName: str(d.leadName) || "—", status: label });
      }
      case "member_joined":
        return t("types.member_joined", { userName: str(d.userName) || "—" });
      case "configurator_published":
        return t("types.configurator_published", {
          configuratorName: str(d.configuratorName) || "—",
          version: typeof d.version === "number" ? d.version : 0,
        });
      case "plan_limit":
        return t("types.plan_limit");
      case "system":
        return str(d.message) || t("types.system", { message: "" });
      default:
        return n.title;
    }
  } catch {
    return n.title;
  }
}
