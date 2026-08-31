"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export default function OnboardingPage() {
  const t = useTranslations("auth.onboarding");
  const [companyName, setCompanyName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ alpha: boolean; seatNumber?: number } | null>(null);

  const registerTenant = useMutation(api.tenants.registerTenant);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await registerTenant({ companyName });
      setResult(res);
      setLoading(false);
    } catch (err: any) {
      setError(err?.message || t("error"));
      setLoading(false);
    }
  }

  if (result) {
    return (
      <div className="space-y-6 text-center">
        <div className={cn(
          "p-6 rounded-xl border",
          result.alpha
            ? "bg-gradient-to-br from-[var(--color-mint)]/10 to-[var(--color-mint-dark)]/10 border-[var(--color-mint)]"
            : "bg-[var(--color-bg-alt)] border-[var(--color-border)]"
        )}>
          <div className="mb-4">
            {result.alpha ? (
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--color-mint)]/20 text-[var(--color-mint)] text-sm font-medium">
                <span className="w-2 h-2 rounded-full bg-[var(--color-mint)]" />
                Alpha Member
              </span>
            ) : (
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text-secondary)] text-sm">
                Starter
              </span>
            )}
          </div>
          <h2 className="text-2xl font-bold text-[var(--color-text)] mb-2">
            {result.alpha ? t("alphaTitle") : t("starterTitle")}
          </h2>
          <p className="text-[var(--color-text-secondary)] mb-4">
            {result.alpha
              ? t("alphaSubtitle", { seatNumber: result.seatNumber ?? 0, companyName })
              : t("starterSubtitle", { companyName })}
          </p>
          {result.alpha && result.seatNumber && (
            <div className="text-4xl font-bold text-[var(--color-mint)] font-mono mb-4">
              #{result.seatNumber}
            </div>
          )}
        </div>

        <Button
          onClick={() => {
            // Full-page navigation so the request passes through the proxy,
            // which promotes the client's auth tokens to server cookies before
            // the /app layout runs its server-side auth check.
            window.location.assign("/app/dashboard");
          }}
          className="w-full"
          size="lg"
        >
          {t("continue")}
        </Button>
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
        <Label htmlFor="companyName" className="text-sm font-medium text-[var(--color-text)]">
          {t("companyNameLabel")}
        </Label>
        <Input
          id="companyName"
          type="text"
          value={companyName}
          onChange={e => setCompanyName(e.target.value)}
          placeholder={t("companyNamePlaceholder")}
          className="mt-1"
          required
          disabled={loading}
        />
      </div>

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? t("loading") : t("submit")}
      </Button>
    </form>
  );
}