"use client";

import { useState } from "react";
import posthog from "posthog-js";
import { useMutation, useQuery } from "convex/react";
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

const dt = (ms: number) => new Date(ms).toLocaleString("it-IT");
const d = (ms: number) => new Date(ms).toLocaleDateString("it-IT");

export default function AccountPage() {
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

  if (profile === undefined) return <p className="text-[var(--color-text-secondary)]">Caricamento...</p>;
  if (profile === null) return <p className="text-[var(--color-danger)]">Profilo non disponibile.</p>;

  const name = nameEdit ?? profile.name;
  const locale = localeEdit ?? profile.locale;

  async function saveProfile() {
    setMsg("");
    try {
      await updateProfile({ name: name.trim(), locale });
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
        <h1 className="text-2xl sm:text-3xl font-bold text-[var(--color-text)]">Account</h1>
        <p className="text-[var(--color-text-secondary)] mt-1">Profilo, sessioni e dati personali</p>
      </div>
      {msg ? <p className="text-sm text-[var(--color-danger)]">{msg}</p> : null}

      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-4">
        <p className="text-sm font-semibold text-[var(--color-text)]">Identità account</p>
        <p className="text-xs text-[var(--color-text-secondary)] mt-1 font-mono break-all">
          {profile.email} · {profile.userId}
        </p>
        <p className="text-xs text-[var(--color-text-secondary)] mt-1">
          Comunica questi dati al supporto per richieste sul tuo account.
        </p>
      </div>

      <Section title="Profilo">
        <Field label="Nome">
          <TextInput value={name} onChange={(e) => setNameEdit(e.target.value)} maxLength={80} />
        </Field>
        <Field label="Email" hint="Contatta il supporto per cambiare l'indirizzo email.">
          <TextInput value={profile.email} disabled />
        </Field>
        <Field label="Lingua">
          <SelectInput value={locale} onChange={(e) => setLocaleEdit(e.target.value)}>
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
          {savedProfile ? "Salvato" : "Salva profilo"}
        </button>
        {profile.tenant ? (
          <p className="text-xs text-[var(--color-text-secondary)]">
            {profile.tenant.name} · piano <span className="capitalize">{profile.tenant.plan}</span> ·
            ruolo {profile.role}
          </p>
        ) : null}
      </Section>

      {tenant && (profile.role === "owner" || profile.role === "admin") ? (
        <CompanyProfileSection tenantId={tenant._id} country={tenant.country} />
      ) : null}

      <Section title="Sessioni attive" description="Dispositivi e browser con cui hai effettuato l'accesso.">
        <ul className="space-y-2">
          {profile.sessions.map((s) => (
            <li
              key={s.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm"
            >
              <div>
                <p className="text-[var(--color-text)]">
                  {s.current ? "Questo dispositivo" : "Sessione"}
                  {s.current ? (
                    <span className="ml-2 rounded-full bg-[var(--color-mint-light)] px-1.5 py-0.5 text-xs text-[var(--color-mint)]">
                      attiva
                    </span>
                  ) : null}
                </p>
                <p className="text-xs text-[var(--color-text-secondary)]">
                  Accesso il {dt(s.createdAt)} · scade il {d(s.expiresAt)}
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
                  Revoca
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
                setMsg(`Disconnesse ${revoked} altre sessioni.`);
              } catch (e) {
                setMsg(tf(e));
              }
            }}
            className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-text)]"
          >
            Disconnetti gli altri dispositivi
          </button>
        ) : null}
      </Section>

      <Section title="Privacy e dati" description="Gestisci consensi, esporta o elimina i tuoi dati personali.">
        <div className="space-y-3">
          <Toggle
            checked={profile.consent.productUpdates}
            onChange={(vv) => setConsent({ productUpdates: vv })}
            label="Aggiornamenti sul prodotto e sul programma Alpha"
          />
          <Toggle
            checked={profile.consent.marketing}
            onChange={(vv) => setConsent({ marketing: vv })}
            label="Comunicazioni commerciali e novità"
          />
        </div>

        <div className="flex flex-wrap gap-2 pt-2">
          <button
            type="button"
            onClick={async () => download(await exportMyData())}
            className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-text)]"
          >
            Esporta i miei dati (JSON)
          </button>
          <Link
            href="/legal/privacy"
            className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-text)]"
          >
            Informativa privacy
          </Link>
        </div>

        {profile.pendingDeletion ? (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
            <p className="text-amber-500 font-medium">Eliminazione programmata</p>
            <p className="text-[var(--color-text-secondary)] mt-1">
              Il tuo account sarà eliminato il {d(profile.pendingDeletion.scheduledFor)}. Puoi
              annullare fino a quella data.
            </p>
            <button
              type="button"
              onClick={() => cancelDeletion()}
              className="mt-2 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs text-[var(--color-text)]"
            >
              Annulla eliminazione
            </button>
          </div>
        ) : !confirmDelete ? (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="text-sm text-[var(--color-danger)] hover:underline"
          >
            Richiedi l&apos;eliminazione dell&apos;account
          </button>
        ) : (
          <div className="rounded-lg border border-[var(--color-danger)]/40 bg-[var(--color-danger)]/10 p-3 space-y-2">
            <p className="text-sm text-[var(--color-text)]">
              L&apos;account e i dati personali verranno eliminati dopo 30 giorni. Le richieste di
              preventivo restano all&apos;organizzazione. Confermi?
            </p>
            <TextInput
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Motivo (facoltativo)"
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
                Conferma richiesta
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-text)]"
              >
                Annulla
              </button>
            </div>
          </div>
        )}
      </Section>

      <div className="flex gap-3">
        <Link href="/app/account/team" className="text-sm text-[var(--color-mint)] hover:underline">
          Team
        </Link>
        <Link href="/app/account/billing" className="text-sm text-[var(--color-mint)] hover:underline">
          Piano e fatturazione
        </Link>
        <Link href="/app/account/dpa" className="text-sm text-[var(--color-mint)] hover:underline">
          Accordo DPA (GDPR)
        </Link>
        <button
          type="button"
          onClick={handleSignOut}
          className="text-sm text-[var(--color-danger)] hover:underline ml-auto"
        >
          Esci
        </button>
      </div>
    </div>
  );
}
