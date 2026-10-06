"use client";

import { useState } from "react";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useLocale, useTranslations } from "next-intl";
import { api } from "@/convex/_generated/api";
import { Link, useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthErrorMessage } from "@/lib/use-friendly-error";
import { extractJoinToken } from "@/lib/join-link";
import { gradeLabel } from "@/shared/grade-labels";

const field = "mt-1";

/**
 * "Join a company": the way a colleague comes in without an account. Three keys — the link of the invitation e-mail (opens this page with
 * the token already in), the 6-digit code of the same e-mail, and the team's password given in person. Nothing here waits for the sign-in
 * machinery to load: the page and the invitation's details appear at once, only the final button talks to the server.
 */
export function JoinTeam({ initialToken }: { initialToken: string }) {
  const t = useTranslations("join");
  const te = useTranslations("errors");
  const locale = useLocale();
  const router = useRouter();
  const authMsg = useAuthErrorMessage();
  const { signIn, signOut } = useAuthActions();
  const { isAuthenticated } = useConvexAuth();

  const [token, setToken] = useState(initialToken);
  const [tab, setTab] = useState<"invite" | "return">("invite");
  const info = useQuery(api.teams.getJoinInfo, token ? { token } : "skip");

  const [pasted, setPasted] = useState("");
  const [pasteError, setPasteError] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const requestLink = useMutation(api.teams.requestAccessLink);
  const [retEmail, setRetEmail] = useState("");
  const [retPassword, setRetPassword] = useState("");
  const [retBusy, setRetBusy] = useState(false);
  const [retSent, setRetSent] = useState(false);

  const statusText: Record<string, string> = {
    notFound: te("joinNotFound"),
    used: te("joinUsed"),
    expired: te("joinExpired"),
    locked: te("joinLocked"),
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await signIn("team-access", { token, code, password, name, locale, consent });
      router.replace("/app/dashboard");
    } catch (err) {
      setError(authMsg(err, te("generic")));
      setBusy(false);
    }
  }

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    setRetBusy(true);
    try {
      await requestLink({ email: retEmail, password: retPassword, locale });
      setRetSent(true);
    } finally {
      setRetBusy(false);
    }
  }

  function acceptPasted(e: React.FormEvent) {
    e.preventDefault();
    const found = extractJoinToken(pasted);
    if (!found) {
      setPasteError(t("invalidLink"));
      return;
    }
    setPasteError("");
    setToken(found);
  }

  const alert = (msg: string) => (
    <div role="alert" className="p-4 bg-[var(--color-danger)]/10 border border-[var(--color-danger)] rounded-lg text-[var(--color-danger)] text-sm">
      {msg}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="text-center mb-2">
        <h1 className="text-2xl font-bold text-[var(--color-text)]">{t("title")}</h1>
        <p className="text-[var(--color-text-secondary)] mt-2">{t("subtitle")}</p>
      </div>

      {isAuthenticated ? (
        <div className="rounded-lg border border-[var(--auth-line-dim)] p-4 text-sm space-y-3">
          <p className="text-[var(--color-text)]">{t("alreadyIn")}</p>
          <div className="flex flex-wrap gap-2">
            <Link href="/app/dashboard" className="rounded-lg border border-[var(--auth-line-dim)] px-3 py-1.5 text-[var(--color-text)]">
              {t("goDashboard")}
            </Link>
            <button type="button" onClick={() => void signOut()} className="rounded-lg bg-[var(--auth-live)] px-3 py-1.5 font-semibold text-[var(--color-mint-dark)]">
              {t("signOutContinue")}
            </button>
          </div>
        </div>
      ) : null}

      {token ? (
        info === undefined ? (
          <p className="text-center text-sm text-[var(--color-text-secondary)]" role="status">{t("checking")}</p>
        ) : info.status !== "ok" ? (
          <div className="space-y-4">
            {alert(statusText[info.status] ?? te("joinNotFound"))}
            <Button type="button" className="w-full" onClick={() => { setToken(""); setTab("return"); }}>
              {t("newLink")}
            </Button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-5">
            <div className="rounded-lg bg-[var(--color-bg-alt)] border border-[var(--auth-line-dim)] p-4 text-sm space-y-1">
              <p className="text-[var(--color-text)]">
                {info.kind === "login"
                  ? t("loginFor", { company: info.companyName, team: info.teamName })
                  : info.grade
                    ? t("invited", { company: info.companyName, team: info.teamName, grade: gradeLabel(locale, info.grade) })
                    : t("invitedNoGrade", { company: info.companyName, team: info.teamName })}
              </p>
              <p className="text-xs text-[var(--color-text-secondary)]">{t("emailHint", { email: info.emailHint })}</p>
            </div>

            {error ? alert(error) : null}

            <div>
              <Label htmlFor="join-code" className="text-sm font-medium text-[var(--color-text)]">{t("codeLabel")}</Label>
              <Input
                id="join-code"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/[^\d ]/g, "").slice(0, 7))}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="000000"
                className={`${field} font-mono tracking-[0.4em] text-lg`}
                required
                disabled={busy}
              />
              <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{t("codeHint")}</p>
            </div>

            <div>
              <Label htmlFor="join-password" className="text-sm font-medium text-[var(--color-text)]">{t("passwordLabel")}</Label>
              <Input
                id="join-password"
                value={password}
                onChange={(e) => setPassword(e.target.value.slice(0, 32))}
                autoComplete="off"
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                placeholder="XXXXX-XXXXX"
                className={`${field} font-mono uppercase tracking-widest`}
                required
                disabled={busy}
              />
              <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{t("passwordHint")}</p>
            </div>

            {info.kind === "invite" ? (
              <>
                <div>
                  <Label htmlFor="join-name" className="text-sm font-medium text-[var(--color-text)]">{t("nameLabel")}</Label>
                  <Input
                    id="join-name"
                    value={name || info.inviteeName || ""}
                    onChange={(e) => setName(e.target.value)}
                    autoComplete="name"
                    placeholder={t("namePlaceholder")}
                    className={field}
                    required
                    disabled={busy}
                  />
                </div>
                <label className="flex items-start gap-2 text-sm text-[var(--color-text-secondary)]">
                  <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 h-4 w-4" required disabled={busy} />
                  <span>
                    {t("consentPrefix")}{" "}
                    <Link href="/legal/termini-di-servizio" target="_blank" className="text-[var(--color-mint-text)] underline underline-offset-2">{t("terms")}</Link>{" "}
                    {t("consentAnd")}{" "}
                    <Link href="/legal/privacy" target="_blank" className="text-[var(--color-mint-text)] underline underline-offset-2">{t("privacy")}</Link>
                  </span>
                </label>
              </>
            ) : null}

            <Button type="submit" className="w-full" disabled={busy || code.replace(/\D/g, "").length !== 6 || password.trim().length < 10 || (info.kind === "invite" && !consent)}>
              {busy ? t("submitting") : t("submit")}
            </Button>
          </form>
        )
      ) : (
        <>
          <div role="tablist" className="grid grid-cols-2 gap-1 rounded-lg border border-[var(--auth-line-dim)] p-1 text-sm">
            {(["invite", "return"] as const).map((k) => (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={tab === k}
                onClick={() => setTab(k)}
                className={`rounded-md px-3 py-2 font-medium transition-colors ${tab === k ? "bg-[var(--auth-live)] text-[var(--color-mint-dark)]" : "text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"}`}
              >
                {k === "invite" ? t("tabInvite") : t("tabReturn")}
              </button>
            ))}
          </div>

          {tab === "invite" ? (
            <form onSubmit={acceptPasted} className="space-y-4">
              <p className="text-sm text-[var(--color-text-secondary)]">{t("steps")}</p>
              <div>
                <Label htmlFor="join-link" className="text-sm font-medium text-[var(--color-text)]">{t("pasteLabel")}</Label>
                <Input id="join-link" value={pasted} onChange={(e) => setPasted(e.target.value)} placeholder={t("pastePlaceholder")} className={field} autoComplete="off" required />
                <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{t("pasteHint")}</p>
              </div>
              {pasteError ? alert(pasteError) : null}
              <Button type="submit" className="w-full">{t("pasteNext")}</Button>
            </form>
          ) : retSent ? (
            <p role="status" className="rounded-lg border border-[var(--color-mint)]/40 bg-[var(--color-mint-light)] p-4 text-sm text-[var(--color-text)]">{t("returnSent")}</p>
          ) : (
            <form onSubmit={sendLink} className="space-y-4">
              <div>
                <h2 className="font-semibold text-[var(--color-text)]">{t("returnTitle")}</h2>
                <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{t("returnBody")}</p>
              </div>
              <div>
                <Label htmlFor="ret-email" className="text-sm font-medium text-[var(--color-text)]">{t("returnEmail")}</Label>
                <Input id="ret-email" type="email" value={retEmail} onChange={(e) => setRetEmail(e.target.value)} className={field} autoComplete="email" required disabled={retBusy} />
              </div>
              <div>
                <Label htmlFor="ret-password" className="text-sm font-medium text-[var(--color-text)]">{t("returnPassword")}</Label>
                <Input
                  id="ret-password"
                  value={retPassword}
                  onChange={(e) => setRetPassword(e.target.value.slice(0, 32))}
                  autoComplete="off"
                  autoCapitalize="characters"
                  autoCorrect="off"
                  spellCheck={false}
                  placeholder="XXXXX-XXXXX"
                  className={`${field} font-mono uppercase tracking-widest`}
                  required
                  disabled={retBusy}
                />
              </div>
              <Button type="submit" className="w-full" disabled={retBusy}>{retBusy ? t("returnSending") : t("returnSubmit")}</Button>
            </form>
          )}
        </>
      )}

      <p className="text-center text-sm text-[var(--color-text-secondary)]">
        <Link href="/auth/login" className="text-[var(--color-mint-text)] underline underline-offset-2">{t("backToLogin")}</Link>
      </p>
    </div>
  );
}
