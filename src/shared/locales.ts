/**
 * The platform's six languages, the one list every locale type derives from (issue #71). The public widget
 * takes leads in five of them: Romanian is a platform (dashboard, e-mail, catalogue label) language, not a
 * widget language, so the split is declared here instead of being an accident of separate copies.
 */
export const APP_LOCALES = ["it", "en", "fr", "de", "nl", "ro"] as const;
export type AppLocale = (typeof APP_LOCALES)[number];

export const WIDGET_LEAD_LOCALES = ["it", "en", "fr", "nl", "de"] as const satisfies readonly AppLocale[];
export type WidgetLeadLocale = (typeof WIDGET_LEAD_LOCALES)[number];
