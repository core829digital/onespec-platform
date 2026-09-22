"use client";

import { useEffect, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authErrorMessage } from "@/lib/errors";

const COUNTRIES = [
  { code: "IT", label: "Italia" },
  { code: "FR", label: "France" },
  { code: "BE", label: "België / Belgique" },
  { code: "NL", label: "Nederland" },
  { code: "DE", label: "Deutschland" },
  { code: "LU", label: "Luxembourg" },
];

export default function OnboardingPage() {
  const t = useTranslations("auth.onboarding");
  const router = useRouter();
  const [companyName, setCompanyName] = useState("");
  const [country, setCountry] = useState("");
  const [detectedFrom, setDetectedFrom] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ tenantId: string } | null>(null);

  const registerTenant = useMutation(api.tenants.registerTenant);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/geo")
      .then((r) => r.json())
      .then((g: { country?: string; source?: string }) => {
        if (cancelled) return;
        if (g.country && COUNTRIES.some((c) => c.code === g.country)) {
          setCountry(g.country);
          setDetectedFrom(g.source ?? null);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await registerTenant({ companyName, country: country || undefined });
      setResult(res);
      setLoading(false);
    } catch (err) {
      setError(authErrorMessage(err, t("error")));
      setLoading(false);
    }
  }

  if (result) {
    return (
      <div className="space-y-6 text-center">
        <div className="p-6 rounded-xl border bg-[var(--color-bg-alt)] border-[var(--color-border)]">
          <h2 className="text-2xl font-bold text-[var(--color-text)] mb-2">{t("baseTitle")}</h2>
          <p className="text-[var(--color-text-secondary)]">{t("baseSubtitle", { companyName })}</p>
        </div>

        <Button onClick={() => router.push("/onboarding")} className="w-full" size="lg">
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

      <div>
        <Label htmlFor="country" className="text-sm font-medium text-[var(--color-text)]">
          {t("countryLabel")}
        </Label>
        <select
          id="country"
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          required
          disabled={loading}
          className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)]"
        >
          <option value="" disabled>
            {t("countryPlaceholder")}
          </option>
          {COUNTRIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.label}
            </option>
          ))}
        </select>
        {detectedFrom === "geo" ? (
          <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{t("countryDetected")}</p>
        ) : null}
      </div>

      <Button type="submit" className="w-full" disabled={loading || !country}>
        {loading ? t("loading") : t("submit")}
      </Button>
    </form>
  );
}