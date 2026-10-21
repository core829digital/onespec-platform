import { redirect } from "@/i18n/navigation";

export default async function LocaleIndex({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect({ href: "/auth/login", locale });
}
