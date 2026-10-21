"use client";

import { ConvexError } from "convex/values";
import { useEffect, useState } from "react";
import { useMutation } from "convex/react";
import { useQuery } from "@/lib/convex-query";
import { useTranslations } from "next-intl";
import QRCode from "qrcode";
import { api } from "@/convex/_generated/api";
import { Section } from "@/components/configurator/editor-primitives";
import { useFriendlyError } from "@/lib/use-friendly-error";

const btn =
  "inline-flex min-h-11 items-center justify-center rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-text)] hover:border-[var(--color-mint)] disabled:opacity-50";
const primary =
  "inline-flex min-h-11 items-center justify-center rounded-lg bg-[var(--color-mint)] px-4 py-2 text-sm font-medium text-[var(--color-on-mint,#0b1d16)] disabled:opacity-50";
const input =
  "mt-1 block min-h-11 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 font-mono text-base tracking-widest text-[var(--color-text)]";

type Step =
  | { kind: "idle" }
  | { kind: "setup"; secret: string; uri: string; qr: string }
  | { kind: "codes"; codes: string[] }
  | { kind: "ask"; action: "disable" | "regenerate" };

/** Account → two-step verification with an authenticator app. The secret and the recovery codes are shown once and never kept in the browser. */
export function MfaSettings() {
  const t = useTranslations("mfa");
  const tf = useFriendlyError();
  const status = useQuery(api.mfa.status);
  const begin = useMutation(api.mfa.beginSetup);
  const confirm = useMutation(api.mfa.confirmSetup);
  const disable = useMutation(api.mfa.disable);
  const regenerate = useMutation(api.mfa.regenerateRecoveryCodes);
  const [step, setStep] = useState<Step>({ kind: "idle" });
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [copied, setCopied] = useState(false);

  // Leaving the page forgets the codes: nothing secret outlives the screen that showed it.
  useEffect(() => () => setStep({ kind: "idle" }), []);

  async function run(fn: () => Promise<void>) {
    setError("");
    setInfo("");
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setError(tf(e));
    } finally {
      setBusy(false);
    }
  }
  const fail = (e: string) => tf(new ConvexError(e));

  const start = () =>
    run(async () => {
      const r = await begin({});
      if (!r.ok) return setError(fail(r.error));
      const qr = await QRCode.toDataURL(r.uri, { margin: 1, width: 220 });
      setCode("");
      setStep({ kind: "setup", secret: r.secret, uri: r.uri, qr });
    });

  const finish = () =>
    run(async () => {
      const r = await confirm({ code });
      if (!r.ok) return setError(fail(r.error));
      setCode("");
      setStep({ kind: "codes", codes: r.recoveryCodes });
      setInfo(t("doneOn"));
    });

  const submitAsk = (action: "disable" | "regenerate") =>
    run(async () => {
      if (action === "disable") {
        const r = await disable({ code });
        if (!r.ok) return setError(fail(r.error));
        setStep({ kind: "idle" });
        setInfo(t("doneOff"));
      } else {
        const r = await regenerate({ code });
        if (!r.ok) return setError(fail(r.error));
        setStep({ kind: "codes", codes: r.recoveryCodes });
        setInfo(t("doneRegen"));
      }
      setCode("");
    });

  async function copy(codes: string[]) {
    try {
      await navigator.clipboard.writeText(codes.join("\n"));
      setCopied(true);
    } catch {
      /* clipboard can be blocked: the codes stay on screen */
    }
  }
  function download(codes: string[]) {
    const url = URL.createObjectURL(new Blob([`OneSpec — ${t("recoveryTitle")}\n\n${codes.join("\n")}\n`], { type: "text/plain" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "onespec-recovery-codes.txt";
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!status) return null;

  return (
    <Section title={t("title")} description={t("desc")}>
      <div className="space-y-4" data-testid="mfa-settings">
        <p className="text-sm text-[var(--color-text)]">
          <span className={`mr-2 rounded-full px-2 py-0.5 text-xs ${status.enabled ? "bg-[var(--color-mint-light)] text-[var(--color-mint-text)]" : "bg-[var(--color-bg-alt)] text-[var(--color-text-secondary)]"}`}>
            {status.enabled ? t("on") : t("off")}
          </span>
          {status.enabled ? t("recoveryLeft", { count: status.recoveryRemaining }) : null}
        </p>
        {status.enabled && status.recoveryRemaining <= 2 && step.kind === "idle" ? (
          <p role="status" className="text-sm text-[var(--color-danger)]">{t("lowRecovery")}</p>
        ) : null}

        {!status.available ? <p className="text-sm text-[var(--color-text-secondary)]">{t("unavailable")}</p> : null}

        {status.available && !status.enabled && step.kind === "idle" ? (
          <button type="button" className={primary} onClick={start} disabled={busy}>{busy ? t("working") : t("enable")}</button>
        ) : null}

        {step.kind === "setup" ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void finish();
            }}
            className="space-y-4"
          >
            <p className="text-sm text-[var(--color-text)]">{t("scan")}</p>
            {/* eslint-disable-next-line @next/next/no-img-element -- a data: URL made in the browser, not a remote image */}
            <img src={step.qr} alt={t("qrAlt")} width={220} height={220} className="rounded-lg bg-white p-1" />
            <p className="text-xs text-[var(--color-text-secondary)]">
              {t("manual")}: <code className="break-all font-mono text-[var(--color-text)]">{step.secret.replace(/(.{4})/g, "$1 ").trim()}</code>
            </p>
            <label className="block text-sm text-[var(--color-text)]">
              {t("codeLabel")}
              <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" placeholder={t("codePlaceholder")} className={input} required />
            </label>
            <div className="flex flex-wrap gap-2">
              <button type="submit" className={primary} disabled={busy || code.length !== 6}>{busy ? t("working") : t("confirm")}</button>
              <button type="button" className={btn} onClick={() => { setStep({ kind: "idle" }); setCode(""); setError(""); }} disabled={busy}>{t("cancel")}</button>
            </div>
          </form>
        ) : null}

        {step.kind === "codes" ? (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-[var(--color-text)]">{t("recoveryTitle")}</h3>
            <p className="text-sm text-[var(--color-text-secondary)]">{t("recoveryDesc")}</p>
            <ul className="grid grid-cols-2 gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-3 font-mono text-sm text-[var(--color-text)]">
              {step.codes.map((c) => <li key={c}>{c}</li>)}
            </ul>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={btn} onClick={() => copy(step.codes)}>{copied ? t("copied") : t("copy")}</button>
              <button type="button" className={btn} onClick={() => download(step.codes)}>{t("download")}</button>
              <button type="button" className={primary} onClick={() => { setStep({ kind: "idle" }); setCopied(false); }}>{t("saved")}</button>
            </div>
          </div>
        ) : null}

        {status.enabled && step.kind === "idle" ? (
          <div className="flex flex-wrap gap-2">
            <button type="button" className={btn} onClick={() => { setCode(""); setError(""); setInfo(""); setStep({ kind: "ask", action: "regenerate" }); }}>{t("regenerate")}</button>
            <button type="button" className={btn} onClick={() => { setCode(""); setError(""); setInfo(""); setStep({ kind: "ask", action: "disable" }); }}>{t("disable")}</button>
          </div>
        ) : null}

        {step.kind === "ask" ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void submitAsk(step.action);
            }}
            className="space-y-3"
          >
            <label className="block text-sm text-[var(--color-text)]">
              {t("askCode")}
              <input value={code} onChange={(e) => setCode(e.target.value.slice(0, 16))} autoComplete="one-time-code" placeholder={t("codeOrRecovery")} className={input} required />
            </label>
            <div className="flex flex-wrap gap-2">
              <button type="submit" className={primary} disabled={busy || code.trim() === ""}>{busy ? t("working") : step.action === "disable" ? t("disable") : t("regenerate")}</button>
              <button type="button" className={btn} onClick={() => { setStep({ kind: "idle" }); setCode(""); setError(""); }} disabled={busy}>{t("cancel")}</button>
            </div>
          </form>
        ) : null}

        {error ? <p role="alert" className="text-sm text-[var(--color-danger)]">{error}</p> : null}
        {info && !error ? <p role="status" className="text-sm text-[var(--color-mint-text)]">{info}</p> : null}
      </div>
    </Section>
  );
}
