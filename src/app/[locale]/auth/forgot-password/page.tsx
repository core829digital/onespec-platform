"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/app/[locale]/auth/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ForgotPasswordPage() {
  const t = useTranslations("auth.forgotPassword");
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await resetPassword(email);
      setSuccess(true);
    } catch (err: any) {
      setError(err?.message || t("error"));
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="space-y-6 text-center">
        <div className="p-4 bg-[var(--color-mint)]/10 border border-[var(--color-mint)] rounded-lg text-[var(--color-mint)]">
          {t("success")}
        </div>
        <p className="text-[var(--color-text-secondary)]">{t("checkEmail")}</p>
      </div>
    );
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

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? t("loading") : t("submit")}
      </Button>

      <p className="text-center text-sm text-[var(--color-text-secondary)]">
        {t("backToLogin")} <a href="/login" className="text-[var(--color-mint)] hover:underline">{t("loginLink")}</a>
      </p>
    </form>
  );
}