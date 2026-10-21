"use client";

import { useState } from "react";
import { ConvexError } from "convex/values";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFriendlyError } from "@/lib/use-friendly-error";
import { useTurnstile } from "@/lib/use-turnstile";
import { CONTACT_LIMITS, CONTACT_TOPICS, type ContactTopic } from "@/shared/support";

const CONVEX_SITE =
  (process.env.NEXT_PUBLIC_CONVEX_SITE_URL as string) ||
  (process.env.NEXT_PUBLIC_CONVEX_URL as string)?.replace(".convex.cloud", ".convex.site") ||
  "";

const area =
  "mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-base text-[var(--color-text)] focus:border-[var(--color-mint)] focus:outline-none";

/** Public "Contact us": for people who cannot sign in (so no account, no ticket). Same bot protection as the sign-in forms. */
export default function ContactPage() {
  const t = useTranslations("contact");
  const locale = useLocale();
  const tf = useFriendlyError();
  const ts = useTurnstile();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [topic, setTopic] = useState<ContactTopic>("login");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState(""); // honeypot: real people never see or fill it
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const valid =
    name.trim().length >= CONTACT_LIMITS.nameMin &&
    /^\S+@\S+\.\S+$/.test(email.trim()) &&
    message.trim().length >= CONTACT_LIMITS.messageMin;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid || loading) return;
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${CONVEX_SITE}/api/support/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, topic, message, locale, website, turnstileToken: ts.token }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) throw new ConvexError(data.error ?? "ERROR");
      setSent(true);
    } catch (err) {
      setError(tf(err));
    } finally {
      ts.reset();
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="space-y-4 text-center">
        <h1 className="text-2xl font-bold text-[var(--color-text)]">{t("sentTitle")}</h1>
        <p className="text-[var(--color-text-secondary)]">{t("sentBody")}</p>
        <Link href="/auth/login" className="inline-flex min-h-11 items-center text-[var(--color-mint-text)] underline underline-offset-2">{t("backToLogin")}</Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="mb-2 text-center">
        <h1 className="text-2xl font-bold text-[var(--color-text)]">{t("title")}</h1>
        <p className="mt-2 text-[var(--color-text-secondary)]">{t("subtitle")}</p>
      </div>

      {error && (
        <div role="alert" className="rounded-lg border border-[var(--color-danger)] bg-[var(--color-danger)]/10 p-4 text-sm text-[var(--color-danger)]">{error}</div>
      )}

      <div>
        <Label htmlFor="c-name">{t("name")}</Label>
        <Input id="c-name" className="mt-1" value={name} onChange={(e) => setName(e.target.value)} maxLength={CONTACT_LIMITS.nameMax} autoComplete="name" required disabled={loading} />
      </div>
      <div>
        <Label htmlFor="c-email">{t("email")}</Label>
        <Input id="c-email" type="email" className="mt-1" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required disabled={loading} />
      </div>
      <div>
        <Label htmlFor="c-topic">{t("topic")}</Label>
        <select id="c-topic" value={topic} onChange={(e) => setTopic(e.target.value as ContactTopic)} className={area} disabled={loading}>
          {CONTACT_TOPICS.map((k) => <option key={k} value={k}>{t(`topic_${k}`)}</option>)}
        </select>
      </div>
      <div>
        <Label htmlFor="c-message">{t("message")}</Label>
        <textarea id="c-message" rows={6} value={message} onChange={(e) => setMessage(e.target.value)} maxLength={CONTACT_LIMITS.messageMax} className={area} required disabled={loading} />
        <p className="mt-1 flex justify-between gap-3 text-xs text-[var(--color-text-secondary)]">
          <span>{t("messageHint")}</span>
          <span className="shrink-0">{message.length}/{CONTACT_LIMITS.messageMax}</span>
        </p>
      </div>

      {/* Honeypot: hidden from people and from assistive tech. */}
      <div aria-hidden="true" className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
        <label>Website<input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} /></label>
      </div>

      {ts.box}
      <Button type="submit" className="w-full" disabled={loading || !valid || !ts.ready}>{loading ? t("sending") : t("send")}</Button>

      <p className="text-center text-xs text-[var(--color-text-secondary)]">
        {t("privacy")}{" "}
        <Link href="/legal/privacy" className="underline underline-offset-2">{t("privacyLink")}</Link>
      </p>
      <p className="text-center text-sm">
        <Link href="/auth/login" className="text-[var(--color-mint-text)] underline underline-offset-2">{t("backToLogin")}</Link>
      </p>
    </form>
  );
}
