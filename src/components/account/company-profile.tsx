"use client";

import { useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useTranslations } from "next-intl";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Section, Field, TextInput, SelectInput } from "@/components/configurator/editor-primitives";
import { useFriendlyError } from "@/lib/use-friendly-error";

const COUNTRIES = [
  { v: "IT", l: "Italia" },
  { v: "FR", l: "France" },
  { v: "BE", l: "Belgique / België" },
  { v: "NL", l: "Nederland" },
  { v: "DE", l: "Deutschland" },
  { v: "LU", l: "Luxembourg" },
];

const LOGO_TYPES = ["image/png", "image/jpeg"];
const LOGO_MAX_BYTES = 2 * 1024 * 1024;

type Draft = { country?: string; vatId?: string; address?: string; phone?: string; companyEmail?: string };

export function CompanyProfileSection({ tenantId, country }: { tenantId: Id<"tenants">; country?: string }) {
  const t = useTranslations("company");
  const tf = useFriendlyError();
  const profile = useQuery(api.tenants.getCompanyProfile);
  const updateTenant = useMutation(api.tenants.updateTenant);
  const genUrl = useMutation(api.tenants.generateLogoUploadUrl);
  const setLogo = useMutation(api.tenants.setCompanyLogo);

  const [draft, setDraft] = useState<Draft>({});
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState<"" | "save" | "logo">("");
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const val = (k: keyof Draft, stored?: string) => draft[k] ?? stored ?? "";
  const dirty = Object.keys(draft).length > 0;

  async function save() {
    setError("");
    setBusy("save");
    try {
      await updateTenant({ tenantId, ...draft });
      setDraft({});
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(tf(e));
    } finally {
      setBusy("");
    }
  }

  async function onLogoFile(file: File | undefined) {
    if (!file) return;
    setError("");
    if (!LOGO_TYPES.includes(file.type)) return setError(t("logoType"));
    if (file.size > LOGO_MAX_BYTES) return setError(t("logoSize"));
    setBusy("logo");
    try {
      const url = await genUrl({ tenantId });
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": file.type }, body: file });
      if (!res.ok) throw new Error("upload");
      const { storageId } = (await res.json()) as { storageId: Id<"_storage"> };
      await setLogo({ tenantId, storageId });
    } catch (e) {
      setError(tf(e));
    } finally {
      setBusy("");
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function removeLogo() {
    setError("");
    setBusy("logo");
    try {
      await setLogo({ tenantId, storageId: null });
    } catch (e) {
      setError(tf(e));
    } finally {
      setBusy("");
    }
  }

  return (
    <Section title={t("title")} description={t("description")}>
      {error ? <p className="text-sm text-[var(--color-danger)]">{error}</p> : null}

      <Field label={t("logo")} hint={t("logoHint")}>
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-40 items-center justify-center rounded-lg border border-dashed border-[var(--color-border)] bg-[var(--color-bg)] p-1">
            {profile?.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.logoUrl} alt="" className="max-h-full max-w-full object-contain" />
            ) : (
              <span className="text-xs text-[var(--color-text-secondary)]">{t("noLogo")}</span>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg"
              className="hidden"
              onChange={(e) => void onLogoFile(e.target.files?.[0])}
            />
            <button
              type="button"
              disabled={busy !== ""}
              onClick={() => fileRef.current?.click()}
              className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm font-medium hover:bg-[var(--color-bg)] disabled:opacity-50"
            >
              {busy === "logo" ? t("uploading") : profile?.logoUrl ? t("logoReplace") : t("logoUpload")}
            </button>
            {profile?.logoUrl ? (
              <button
                type="button"
                disabled={busy !== ""}
                onClick={() => void removeLogo()}
                className="text-left text-sm text-[var(--color-danger)] hover:underline disabled:opacity-50"
              >
                {t("logoRemove")}
              </button>
            ) : null}
          </div>
        </div>
      </Field>

      <Field label={t("country")}>
        <SelectInput value={val("country", country)} onChange={(e) => setDraft((d) => ({ ...d, country: e.target.value }))}>
          <option value="" disabled>
            {t("countryUnset")}
          </option>
          {COUNTRIES.map((c) => (
            <option key={c.v} value={c.v}>
              {c.l}
            </option>
          ))}
        </SelectInput>
      </Field>
      <Field label={t("vatId")}>
        <TextInput maxLength={200} value={val("vatId", profile?.vatId)} onChange={(e) => setDraft((d) => ({ ...d, vatId: e.target.value }))} />
      </Field>
      <Field label={t("address")}>
        <TextInput maxLength={200} value={val("address", profile?.address)} onChange={(e) => setDraft((d) => ({ ...d, address: e.target.value }))} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t("phone")}>
          <TextInput maxLength={200} value={val("phone", profile?.phone)} onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))} />
        </Field>
        <Field label={t("email")}>
          <TextInput type="email" maxLength={200} value={val("companyEmail", profile?.email)} onChange={(e) => setDraft((d) => ({ ...d, companyEmail: e.target.value }))} />
        </Field>
      </div>
      <button
        type="button"
        onClick={() => void save()}
        disabled={!dirty || busy !== ""}
        className="rounded-lg bg-[var(--color-mint)] px-4 py-2 text-sm font-semibold text-[var(--color-mint-dark)] disabled:opacity-50"
      >
        {saved ? t("saved") : t("save")}
      </button>
    </Section>
  );
}
