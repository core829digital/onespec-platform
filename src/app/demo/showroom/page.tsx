import { NextIntlClientProvider } from "next-intl";
import { resolveWidgetLang, resolveWidgetTheme } from "@/lib/widget-params";
import { DemoShowroom } from "@/components/demo/demo-showroom";
import it from "../../../../messages/it.json";

type Messages = Record<string, unknown>;
const SCOPES = ["pieces", "sash", "showroom", "glazingPicker", "finishPicker", "structure"] as const;

function pick(all: Messages): Messages {
  return Object.fromEntries(SCOPES.filter((k) => all[k] !== undefined).map((k) => [k, all[k]]));
}

function merge(base: Messages, over: Messages): Messages {
  const out: Messages = { ...base };
  for (const [k, v] of Object.entries(over)) {
    const b = out[k];
    out[k] =
      v && typeof v === "object" && !Array.isArray(v) && b && typeof b === "object"
        ? merge(b as Messages, v as Messages)
        : v;
  }
  return out;
}

export default async function DemoShowroomPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const lang = resolveWidgetLang(sp.lang, "it");
  const theme = resolveWidgetTheme(sp.theme, "dark");
  const local = lang === "it" ? {} : ((await import(`../../../../messages/${lang}.json`)).default as Messages);
  const messages = merge(pick(it as Messages), pick(local));
  return (
    <NextIntlClientProvider locale={lang} messages={messages}>
      <DemoShowroom lang={lang} theme={theme} />
    </NextIntlClientProvider>
  );
}
