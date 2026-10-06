"use client";

import { Suspense, useState } from "react";
import { analytics as posthog } from "@/lib/monitoring";
import { useRouter } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useAuthActions } from "@convex-dev/auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthErrorMessage } from "@/lib/use-friendly-error";
import { useTurnstile } from "@/lib/use-turnstile";
import { getSafeRedirect } from "@/lib/redirect-validator";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const t = useTranslations("auth.login");
  const tj = useTranslations("auth.join");
  const authMsg = useAuthErrorMessage();
  const router = useRouter();
  const redirect = getSafeRedirect(useSearchParams().get("redirect"), "/app/dashboard");
  const { signIn } = useAuthActions();
  const ts = useTurnstile();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signIn("password", { email, password, flow: "signIn", turnstileToken: ts.token });
      posthog.capture("user_logged_in", { auth_method: "password" });
      router.push(redirect);
    } catch (err) {
      posthog.captureException(err);
      setError(authMsg(err, t("error")));
    } finally {
      ts.reset();
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="text-center mb-4">
        <h1 className="text-2xl font-bold text-[var(--color-text)]">{t("title")}</h1>
        <p className="text-[var(--color-text-secondary)] mt-2">{t("subtitle")}</p>
      </div>

      {error && (
        <div className="p-4 bg-[var(--color-danger)]/10 border border-[var(--color-danger)] rounded-lg text-[var(--color-danger)] text-sm">
          {error}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <Label htmlFor="email" className="text-sm font-medium text-[var(--color-text)]">
            {t("emailLabel")}
          </Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder={t("emailPlaceholder")}
            className="mt-1"
            required
            disabled={loading}
          />
        </div>

        <div>
          <Label htmlFor="password" className="text-sm font-medium text-[var(--color-text)]">
            {t("passwordLabel")}
          </Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder={t("passwordPlaceholder")}
            className="mt-1"
            required
            disabled={loading}
          />
        </div>
      </div>

      {ts.box}
      <Button type="submit" className="w-full" disabled={loading || !ts.ready}>
        {loading ? t("loading") : t("submit")}
      </Button>

      <p className="text-center text-sm text-[var(--color-text-secondary)]">
        {t("noAccount")}{" "}
        <Link
          href={redirect === "/app/dashboard" ? "/auth/register" : `/auth/register?redirect=${encodeURIComponent(redirect)}`}
          className="text-[var(--color-mint-text)] underline underline-offset-2"
        >
          {t("registerLink")}
        </Link>
      </p>
      <p className="text-center text-sm text-[var(--color-text-secondary)]">
        <Link href="/auth/forgot-password" className="text-[var(--color-mint-text)] underline underline-offset-2">{t("forgotPassword")}</Link>
      </p>
      <div className="border-t border-[var(--auth-line-dim)] pt-5 text-center text-sm text-[var(--color-text-secondary)]">
        <p>{tj("prompt")}</p>
        <Link
          href="/auth/join"
          className="mt-2 inline-flex w-full items-center justify-center rounded-lg border border-[var(--auth-line-dim)] px-4 py-2 font-medium text-[var(--color-text)] transition-colors hover:border-[var(--auth-live)] hover:text-[var(--color-mint-text)]"
        >
          {tj("cta")}
        </Link>
      </div>
    </form>
  );
}