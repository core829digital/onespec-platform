/**
 * Effective theme/language of a public widget: an explicit `?theme=` / `?lang=`
 * on the embed URL wins (the host site knows best), otherwise the
 * configurator's own default from the editor's General tab, otherwise a
 * platform default. The pages used to hard-code "dark" / "it" and never read
 * the configurator's defaults, so those two selectors did nothing.
 */
export type WidgetTheme = "light" | "dark" | "auto";
const THEMES: WidgetTheme[] = ["light", "dark", "auto"];
const LANGS = ["it", "en", "fr", "nl", "de", "ro"];

export function resolveWidgetTheme(param: unknown, configDefault: unknown): WidgetTheme {
  if (typeof param === "string" && (THEMES as string[]).includes(param)) return param as WidgetTheme;
  if (typeof configDefault === "string" && (THEMES as string[]).includes(configDefault)) return configDefault as WidgetTheme;
  return "auto";
}

export function resolveWidgetLang(param: unknown, configDefault: unknown): string {
  if (typeof param === "string" && LANGS.includes(param)) return param;
  if (typeof configDefault === "string" && LANGS.includes(configDefault)) return configDefault;
  return "it";
}
