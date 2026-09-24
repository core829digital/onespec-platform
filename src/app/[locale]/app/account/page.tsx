"use client";

import { useState } from "react";
import posthog from "posthog-js";
import { useMutation, useQuery } from "convex/react";
import { useLocale, useTranslations } from "next-intl";
import { api } from "@/convex/_generated/api";
import { useAuthActions } from "@convex-dev/auth/react";
import { Link } from "@/i18n/navigation";
import { Section, Field, TextInput, SelectInput, Toggle } from "@/components/configurator/editor-primitives";
import type { Id } from "@/convex/_generated/dataModel";
import { CompanyProfileSection } from "@/components/account/company-profile";
import { useFriendlyError } from "@/lib/use-friendly-error";

const LOCALES = [
  { v: "it", l: "Italiano" },
  { v: "en", l: "English" },
  { v: "fr", l: "Français" },
  { v: "de", l: "Deutsch" },
  { v: "nl", l: "Nederlands" },
  { v: "ro", l: "Română" },
];

export default function AccountPage() {
  const t = useTranslations("accountMain");
  const locale = useLocale();
  const tf = useFriendlyError();
  const profile = useQuery(api.account.getProfile);
  const tenant = useQuery(api.tenants.getMyTenant);
  const updateProfile = useMutation(api.account.updateProfile);
  const setConsent = useMutation(api.account.setConsent);
  const revokeSession = useMutation(api.account.revokeSession);
  const revokeOthers = useMutation(api.account.revokeOtherSessions);
  const exportMyData = useMutation(api.account.exportMyData);
  const requestDeletion = useMutation(api.account.requestDeletion);
  const cancelDeletion = useMutation(api.account.cancelDeletion);
  const { signOut } = useAuthActions();

  const [nameEdit, setNameEdit] = useState<string | null>(null);
  const [localeEdit, setLocaleEdit] = useState<string | null>(null);
  const [savedProfile, setSavedProfile] = useState(false);
  const [msg, setMsg] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [reason, setReason] = useState("");

  const dt = (ms: number) => new Date(ms).toLocaleString(locale);
  const d = (ms: number) => new Date(ms).toLocaleDateString(locale);

  if (profile === undefined) return <p className="text-[var(--color-text-secondary)]">{t("loading")}</p>;
  if (profile === null) return <p className="text-[var(--color-danger)]">{t("unavailable")}</p>;

  const name = nameEdit ?? profile.name;
  const localeValue = localeEdit ?? profile.locale;

  async function saveProfile() {
    setMsg("");
    try {
      await updateProfile({ name: name.trim(), locale: localeValue });
      setNameEdit(null);
      setLocaleEdit(null);
      setSavedProfile(true);
      setTimeout(() => setSavedProfile(false), 2000);
    } catch (e) {
      setMsg(tf(e));
    }
  }

  async function handleSignOut() {
    posthog.capture("user_logged_out");
    posthog.reset();
    await signOut();
  }

  async function download(res: { filename: string; mimeType: string; content: string }) {
    const blob = new Blob([res.content], { type: res.mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = res.filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="w-full space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-[var(--color-text)]">{t("title")}</h1>
        <p className="text-[var(--color-text-secondary)] mt-1">{t("subtitle")}</p>
      </div>
      {msg ? <p className="text-sm text-[var(--color-danger)]">{msg}</p> : null}

      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-4">
        <p className="text-sm font-semibold text-[var(--color-text)]">{t("identityTitle")}</p>
        <p className="text-xs text-[var(--color-text-secondary)] mt-1 font-mono break-all">
          {profile.email} · {profile.userId}
        </p>
        <p className="text-xs text-[var(--color-text-secondary)] mt-1">
          {t("identityHint")}
        </p>
      </div>

      <Section title={t("profileSection")}>
        <Field label={t("nameLabel")}>
          <TextInput value={name} onChange={(e) => setNameEdit(e.target.value)} maxLength={80} />
        </Field>
        <Field label={t("emailLabel")} hint={t("emailHint")}>
          <TextInput value={profile.email} disabled />
        </Field>
        <Field label={t("langLabel")}>
          <SelectInput value={localeValue} onChange={(e) => setLocaleEdit(e.target.value)}>
            {LOCALES.map((l) => (
              <option key={l.v} value={l.v}>
                {l.l}
              </option>
            ))}
          </SelectInput>
        </Field>
        <button
          type="button"
          onClick={saveProfile}
          className="rounded-lg bg-[var(--color-mint)] px-4 py-2 text-sm font-semibold text-[var(--color-mint-dark)]"
        >
          {savedProfile ? t("saved") : t("saveProfile")}
        </button>
        {profile.tenant ? (
          <p className="text-xs text-[var(--color-text-secondary)]">
            {profile.tenant.name} · {t("planWord")} <span className="capitalize">{profile.tenant.plan}</span> ·{" "}
            {t("roleWord")} {profile.role}
          </p>
        ) : null}
      </Section>

      {tenant && (profile.role === "owner" || profile.role === "admin") ? (
        <CompanyProfileSection tenantId={tenant._id} country={tenant.country} />
      ) : null}

      <Section title={t("sessionsTitle")} description={t("sessionsDesc")}>
        <ul className="space-y-2">
          {profile.sessions.map((s) => (
            <li
              key={s.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm"
            >
              <div>
                <p className="text-[var(--color-text)]">
                  {s.current ? t("thisDevice") : t("session")}
                  {s.current ? (
                    <span className="ml-2 rounded-full bg-[var(--color-mint-light)] px-1.5 py-0.5 text-xs text-[var(--color-mint)]">
                      {t("active")}
                    </span>
                  ) : null}
                </p>
                <p className="text-xs text-[var(--color-text-secondary)]">
                  {t("sessionDates", { login: dt(s.createdAt), expiry: d(s.expiresAt) })}
                </p>
              </div>
              {!s.current ? (
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await revokeSession({ sessionId: s.id as Id<"authSessions"> });
                    } catch (e) {
                      setMsg(tf(e));
                    }
                  }}
                  className="rounded-lg border border-[var(--color-border)] px-3 py-1 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-danger)]"
                >
                  {t("revoke")}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
        {profile.sessions.length > 1 ? (
          <button
            type="button"
            onClick={async () => {
              try {
                const { revoked } = await revokeOthers();
                setMsg(t("disconnectedMsg", { count: revoked }));
              } catch (e) {
                setMsg(tf(e));
              }
            }}
            className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-text)]"
          >
            {t("disconnectOthers")}
          </button>
        ) : null}
      </Section>

      <Section title={t("privacyTitle")} description={t("privacyDesc")}>
        <div className="space-y-3">
          <Toggle
            checked={profile.consent.productUpdates}
            onChange={(vv) => setConsent({ productUpdates: vv })}
            label={t("productUpdates")}
          />
          <Toggle
            checked={profile.consent.marketing}
            onChange={(vv) => setConsent({ marketing: vv })}
            label={t("marketing")}
          />
        </div>

        <div className="flex flex-wrap gap-2 pt-2">
          <button
            type="button"
            onClick={async () => download(await exportMyData())}
            className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-text)]"
          >
            {t("exportData")}
          </button>
          <Link
            href="/legal/privacy"
            className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-text)]"
          >
            {t("privacyPolicy")}
          </Link>
        </div>

        {profile.pendingDeletion ? (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
            <p className="text-amber-500 font-medium">{t("deletionScheduled")}</p>
            <p className="text-[var(--color-text-secondary)] mt-1">
              {t("deletionInfo", { date: d(profile.pendingDeletion.scheduledFor) })}
            </p>
            <button
              type="button"
              onClick={() => cancelDeletion()}
              className="mt-2 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs text-[var(--color-text)]"
            >
              {t("cancelDeletion")}
            </button>
          </div>
        ) : !confirmDelete ? (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="text-sm text-[var(--color-danger)] hover:underline"
          >
            {t("requestDeletion")}
          </button>
        ) : (
          <div className="rounded-lg border border-[var(--color-danger)]/40 bg-[var(--color-danger)]/10 p-3 space-y-2">
            <p className="text-sm text-[var(--color-text)]">
              {t("deletionConfirm")}
            </p>
            <TextInput
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t("reasonPlaceholder")}
              maxLength={500}
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={async () => {
                  try {
                    await requestDeletion({ reason: reason.trim() || undefined });
                    setConfirmDelete(false);
                  } catch (e) {
                    setMsg(tf(e));
                    setConfirmDelete(false);
                  }
                }}
                className="rounded-lg bg-[var(--color-danger)] px-4 py-2 text-sm font-semibold text-white"
              >
                {t("confirmRequest")}
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-text)]"
              >
                {t("cancel")}
              </button>
            </div>
          </div>
        )}
      </Section>

      <div className="flex gap-3">
        <Link href="/app/account/team" className="text-sm text-[var(--color-mint)] hover:underline">
          {t("teamLink")}
        </Link>
        <Link href="/app/account/billing" className="text-sm text-[var(--color-mint)] hover:underline">
          {t("billingLink")}
        </Link>
        <Link href="/app/account/dpa" className="text-sm text-[var(--color-mint)] hover:underline">
          {t("dpaLink")}
        </Link>
        <button
          type="button"
          onClick={handleSignOut}
          className="text-sm text-[var(--color-danger)] hover:underline ml-auto"
        >
          {t("logout")}
        </button>
      </div>
    </div>
  );
}
