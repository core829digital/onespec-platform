"use client";

import { useState, Suspense } from "react";
import { useRouter } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useAuthActions } from "@convex-dev/auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authErrorMessage } from "@/lib/errors";
import { useTurnstile } from "@/lib/use-turnstile";
import { getSafeRedirect } from "@/lib/redirect-validator";

function ResetPasswordContent() {
  const t = useTranslations("auth.resetPassword");
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = getSafeRedirect(searchParams.get("redirect"), "/auth/login");
  const { signIn } = useAuthActions();
  const email = searchParams.get("email") || "";
  const [code, setCode] = useState(searchParams.get("code") || "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const ts = useTurnstile();
  const [resent, setResent] = useState(false);

  async function handleResend() {
    if (!email) return;
    setError("");
    setResent(false);
    setResending(true);
    try {
      await signIn("password", { email, flow: "reset", turnstileToken: ts.token });
      setResent(true);
    } catch (err) {
      setError(authErrorMessage(err, t("error")));
    } finally {
      ts.reset();
      setResending(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError(t("passwordMismatch"));
      return;
    }
    setError("");
    setLoading(true);
    try {
      await signIn("password", { email, code, newPassword: password, flow: "reset-verification" });
      router.push(redirect);
    } catch (err) {
      setError(authErrorMessage(err, t("error")));
    } finally {
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

      <div>
        <Label htmlFor="code" className="text-sm font-medium text-[var(--color-text)]">
          {t("codeLabel")}
        </Label>
        <Input
          id="code"
          type="text"
          value={code}
          onChange={e => setCode(e.target.value)}
          placeholder={t("codePlaceholder")}
          className="mt-1 text-center text-2xl tracking-widest font-mono"
          maxLength={6}
          required
          disabled={loading}
        />
      </div>

      <div className="space-y-4">
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
            minLength={8}
            disabled={loading}
          />
        </div>

        <div>
          <Label htmlFor="confirmPassword" className="text-sm font-medium text-[var(--color-text)]">
            {t("confirmPasswordLabel")}
          </Label>
          <Input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            placeholder={t("confirmPasswordPlaceholder")}
            className="mt-1"
            required
            disabled={loading}
          />
        </div>
      </div>

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? t("loading") : t("submit")}
      </Button>

      {ts.box}
      <p className="text-center text-sm text-[var(--color-text-secondary)]">
        <button
          type="button"
          onClick={handleResend}
          disabled={resending || loading || !email || !ts.ready}
          className="text-[var(--color-mint)] hover:underline disabled:opacity-50"
        >
          {resending ? t("resendSending") : t("resendLink")}
        </button>
      </p>
      {resent ? (
        <p className="text-center text-sm text-[var(--color-mint)]">{t("resent")}</p>
      ) : null}
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordContent />
    </Suspense>
  );
}