"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { useAuthActions } from "@convex-dev/auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authErrorMessage } from "@/lib/errors";
import { getSafeRedirect } from "@/lib/redirect-validator";

function VerifyContent() {
  const t = useTranslations("auth.verify");
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signIn } = useAuthActions();
  const email = searchParams.get("email") || "";
  const redirect = getSafeRedirect(searchParams.get("redirect"), "/auth/onboarding");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signIn("password", { email, code, flow: "email-verification" });
      try {
        sessionStorage.removeItem("onespec-signup");
      } catch {
        /* ignore */
      }
      router.push(redirect ?? "/auth/onboarding");
    } catch (err) {
      setError(authErrorMessage(err, t("error")));
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setError("");
    setResent(false);
    setResending(true);
    try {
      const raw = sessionStorage.getItem("onespec-signup");
      const saved = raw ? (JSON.parse(raw) as { email?: string; password?: string }) : null;
      if (!saved || saved.email !== email || !saved.password) {
        // No saved credentials (expired tab, other device): go back to register.
        router.push("/auth/register");
        return;
      }
      await signIn("password", { email, password: saved.password, flow: "signUp" });
      setResent(true);
    } catch (err) {
      setError(authErrorMessage(err, t("error")));
    } finally {
      setResending(false);
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
          autoComplete="one-time-code"
        />
      </div>

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? t("loading") : t("submit")}
      </Button>

      <p className="text-center text-sm text-[var(--color-text-secondary)]">
        <button
          type="button"
          onClick={handleResend}
          disabled={resending || loading}
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

export default function VerifyPage() {
  return (
    <Suspense fallback={null}>
      <VerifyContent />
    </Suspense>
  );
}