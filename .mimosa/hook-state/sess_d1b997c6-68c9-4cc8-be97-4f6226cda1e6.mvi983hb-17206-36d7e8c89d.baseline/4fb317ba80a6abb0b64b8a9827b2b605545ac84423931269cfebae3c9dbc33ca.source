"use client";

import { Suspense, useEffect, useState } from "react";
import { analytics as posthog } from "@/lib/monitoring";
import { useRouter } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useAuthActions } from "@convex-dev/auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { useAuthErrorMessage } from "@/lib/use-friendly-error";
import { useTurnstile } from "@/lib/use-turnstile";
import { getOptionalRedirect } from "@/lib/redirect-validator";
import { captureReferralFromUrl } from "@/lib/referral-capture";
import { checkSignup, checkPassword } from "@/shared/signup";
import { SUPPORTED_COUNTRIES, vatMaxLength, maskVat, maskPostal, type CountryCode } from "@/shared/validation";
import { VALIDATION_ERROR_KEY } from "@/lib/validation-messages";
import { DPA_VERSION } from "@/shared/dpa";

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterForm />
    </Suspense>
  );
}

const COUNTRY_LABELS: Record<string, string> = {
  IT: "Italia", SM: "San Marino", VA: "Città del Vaticano", FR: "France", MC: "Monaco", BE: "België / Belgique",
  NL: "Nederland", DE: "Deutschland", AT: "Österreich", LU: "Luxembourg",
};

const SELECT_CLASS = "mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)] min-h-10";

function RegisterForm() {
  const t = useTranslations("auth.register");
  const te = useTranslations("errors");
  const tj = useTranslations("auth.join");
  const authMsg = useAuthErrorMessage();
  const locale = useLocale();
  const router = useRouter();
  const redirect = getOptionalRedirect(useSearchParams().get("redirect"));
  const { signIn } = useAuthActions();
  const ts = useTurnstile();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [country, setCountry] = useState("IT");
  const [vatId, setVatId] = useState("");
  const [street, setStreet] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [city, setCity] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [dpaAccepted, setDpaAccepted] = useState(false);
  const [error, setError] = useState("");
  const [fieldError, setFieldError] = useState<{ field: string; message: string } | null>(null);
  const [loading, setLoading] = useState(false);

  // Remember an invitation link (?ref=…) until the account is created after verification.
  useEffect(() => {
    captureReferralFromUrl();
  }, []);

  const hasCompany = companyName.trim() !== "";
  const dpaPossible = hasCompany && vatId.trim() !== "" && street.trim() !== "";
  const cc = country as CountryCode;
  // The agreement needs the data it names: the tick only counts while that data is there.
  const dpaTicked = dpaAccepted && dpaPossible;

  const fieldMsg = (f: string) => (fieldError?.field === f ? <p className="mt-1 text-xs text-[var(--color-danger)]" role="alert">{fieldError.message}</p> : null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setFieldError(null);
    const parsed = checkSignup({ name, email, password, birthDate, termsAccepted, companyName, country, vatId, street, postalCode, city, dpaAccepted: dpaTicked });
    if (!parsed.ok) {
      setFieldError({ field: parsed.field, message: te(VALIDATION_ERROR_KEY[parsed.code] as never) });
      return;
    }
    if (password !== confirmPassword) {
      setFieldError({ field: "confirmPassword", message: t("passwordMismatch") });
      return;
    }
    setLoading(true);
    try {
      await signIn("password", {
        name,
        email,
        password,
        birthDate,
        termsAccepted: true,
        companyName,
        country,
        vatId,
        street,
        postalCode,
        city,
        dpaAccepted: dpaTicked,
        flow: "signUp",
        locale,
        turnstileToken: ts.token,
      });
      // Saved so /auth/verify can resend the code without asking the
      // password again. Cleared on successful verification. Never a token.
      try {
        sessionStorage.setItem("onespec-signup", JSON.stringify({ email, password }));
      } catch {
        /* private mode — resend just won't be available */
      }
      posthog.capture("user_signed_up", {
        auth_method: "password",
        verification_required: true,
      });
      const q = new URLSearchParams({ email });
      if (redirect) q.set("redirect", redirect);
      router.push(`/auth/verify?${q.toString()}`);
    } catch (err) {
      posthog.captureException(err);
      setError(authMsg(err, t("error")));
    } finally {
      ts.reset();
      setLoading(false);
    }
  }

  const label = "text-sm font-medium text-[var(--color-text)]";
  const pwCheck = password ? checkPassword(password, email) : null;

  return (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
      <div className="text-center mb-4">
        <h1 className="text-2xl font-bold text-[var(--color-text)]">{t("title")}</h1>
        <p className="text-[var(--color-text-secondary)] mt-2">{t("subtitle")}</p>
      </div>

      {error && (
        <div className="p-4 bg-[var(--color-danger)]/10 border border-[var(--color-danger)] rounded-lg text-[var(--color-danger)] text-sm" role="alert">
          {error}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <Label htmlFor="name" className={label}>{t("nameLabel")}</Label>
          <Input id="name" type="text" autoComplete="name" value={name} onChange={e => setName(e.target.value)} placeholder={t("namePlaceholder")} className="mt-1" required maxLength={80} disabled={loading} />
          {fieldMsg("name")}
        </div>

        <div>
          <Label htmlFor="email" className={label}>{t("emailLabel")}</Label>
          <Input id="email" type="email" autoComplete="email" inputMode="email" value={email} onChange={e => setEmail(e.target.value)} placeholder={t("emailPlaceholder")} className="mt-1" required maxLength={254} disabled={loading} />
          {fieldMsg("email")}
        </div>

        <div>
          <Label htmlFor="birthDate" className={label}>{t("birthDateLabel")}</Label>
          <Input id="birthDate" type="date" autoComplete="bday" value={birthDate} onChange={e => setBirthDate(e.target.value)} className="mt-1" required disabled={loading} />
          <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{t("birthDateHint")}</p>
          {fieldMsg("birthDate")}
        </div>

        <div>
          <Label htmlFor="password" className={label}>{t("passwordLabel")}</Label>
          <PasswordInput id="password" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} placeholder={t("passwordPlaceholder")} className="mt-1" required minLength={8} disabled={loading} />
          <p className={`mt-1 text-xs ${pwCheck && !pwCheck.ok ? "text-[var(--color-danger)]" : "text-[var(--color-text-secondary)]"}`}>{t("passwordRules")}</p>
          {fieldMsg("password")}
        </div>

        <div>
          <Label htmlFor="confirmPassword" className={label}>{t("confirmPasswordLabel")}</Label>
          <PasswordInput id="confirmPassword" autoComplete="new-password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder={t("confirmPasswordPlaceholder")} className="mt-1" required disabled={loading} />
          {fieldMsg("confirmPassword")}
        </div>
      </div>

      <fieldset className="space-y-4 rounded-xl border border-[var(--color-border)] p-4">
        <legend className="px-2 text-sm font-semibold text-[var(--color-text)]">{t("companySection")}</legend>
        <p className="text-xs text-[var(--color-text-secondary)]">{t("companyHint")}</p>

        <div>
          <Label htmlFor="companyName" className={label}>{t("companyNameLabel")}</Label>
          <Input id="companyName" type="text" autoComplete="organization" value={companyName} onChange={e => setCompanyName(e.target.value)} className="mt-1" maxLength={120} disabled={loading} />
          {fieldMsg("companyName")}
        </div>

        <div>
          <Label htmlFor="country" className={label}>{t("countryLabel")}</Label>
          <select id="country" value={country} onChange={e => { setCountry(e.target.value); setVatId(""); setPostalCode(""); }} disabled={loading} className={SELECT_CLASS}>
            {SUPPORTED_COUNTRIES.map(c => <option key={c} value={c}>{COUNTRY_LABELS[c] ?? c}</option>)}
          </select>
          {fieldMsg("country")}
        </div>

        <div>
          <Label htmlFor="vatId" className={label}>{t("vatLabel")}</Label>
          <Input id="vatId" type="text" autoComplete="off" value={vatId} onChange={e => setVatId(maskVat(cc, e.target.value))} maxLength={vatMaxLength(cc) + 4} className="mt-1" disabled={loading} />
          {fieldMsg("vatId")}
        </div>

        <div>
          <Label htmlFor="street" className={label}>{t("streetLabel")}</Label>
          <Input id="street" type="text" autoComplete="address-line1" value={street} onChange={e => setStreet(e.target.value)} maxLength={120} className="mt-1" disabled={loading} />
          {fieldMsg("street")}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="postalCode" className={label}>{t("postalCodeLabel")}</Label>
            <Input id="postalCode" type="text" autoComplete="postal-code" value={postalCode} onChange={e => setPostalCode(maskPostal(cc, e.target.value))} maxLength={10} className="mt-1" disabled={loading} />
            {fieldMsg("postalCode")}
          </div>
          <div>
            <Label htmlFor="city" className={label}>{t("cityLabel")}</Label>
            <Input id="city" type="text" autoComplete="address-level2" value={city} onChange={e => setCity(e.target.value)} maxLength={60} className="mt-1" disabled={loading} />
            {fieldMsg("city")}
          </div>
        </div>

        <div className="rounded-lg bg-[var(--color-bg-alt)] p-3">
          <label className="flex items-start gap-3 text-sm text-[var(--color-text)]">
            <input type="checkbox" checked={dpaTicked} onChange={e => setDpaAccepted(e.target.checked)} disabled={loading || !dpaPossible} className="mt-1 h-5 w-5 shrink-0 accent-[var(--color-mint)]" />
            <span>
              {t("dpaPrefix")}
              <Link href="/legal/dpa" target="_blank" className="text-[var(--color-mint-text)] underline underline-offset-2">{t("dpaLink")}</Link>
              {" "}({t("dpaVersion", { version: DPA_VERSION })}).
            </span>
          </label>
          {!dpaPossible ? <p className="mt-2 text-xs text-[var(--color-text-secondary)]">{t("dpaNeedsData")}</p> : null}
          {fieldMsg("dpa")}
        </div>
      </fieldset>

      <div>
        <label className="flex items-start gap-3 text-sm text-[var(--color-text)]">
          <input type="checkbox" checked={termsAccepted} onChange={e => setTermsAccepted(e.target.checked)} disabled={loading} className="mt-1 h-5 w-5 shrink-0 accent-[var(--color-mint)]" />
          <span>
            {t("termsPrefix")}
            <Link href="/legal/termini-di-servizio" target="_blank" className="text-[var(--color-mint-text)] underline underline-offset-2">{t("termsLink")}</Link>
            {t("termsAnd")}
            <Link href="/legal/privacy" target="_blank" className="text-[var(--color-mint-text)] underline underline-offset-2">{t("privacyLink")}</Link>.
          </span>
        </label>
        {fieldMsg("terms")}
      </div>

      {ts.box}
      <Button type="submit" className="w-full" disabled={loading || !ts.ready}>
        {loading ? t("loading") : t("submit")}
      </Button>

      <p className="text-center text-sm text-[var(--color-text-secondary)]">
        {t("hasAccount")} <Link href="/auth/login" className="text-[var(--color-mint-text)] underline underline-offset-2">{t("loginLink")}</Link>
      </p>
      <p className="text-center text-sm text-[var(--color-text-secondary)]">
        {tj("prompt")}{" "}
        <Link href="/auth/join" className="text-[var(--color-mint-text)] underline underline-offset-2">{tj("cta")}</Link>
      </p>
    </form>
  );
}
