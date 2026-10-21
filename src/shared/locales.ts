/**
 * The platform's six locales (#71): the union used to be re-declared per
 * module, hiding a real 5-vs-6 split — the widget lead boundary accepts five
 * (no Romanian market yet) while the app and the catalog labels carry six.
 * Both sets are declared here, once, with the distinction named.
 */
export const APP_LOCALES = ["it", "en", "fr", "de", "nl", "ro"] as const;
export type AppLocale = (typeof APP_LOCALES)[number];

/** Locales a widget lead may arrive in: the six minus the not-yet-launched RO. */
export const WIDGET_LEAD_LOCALES = ["it", "en", "fr", "de", "nl"] as const;
export type WidgetLeadLocale = (typeof WIDGET_LEAD_LOCALES)[number];
