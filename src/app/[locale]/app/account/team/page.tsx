"use client";

import { useState } from "react";
import { useConvexAuth, useMutation } from "convex/react";
import { useQuery } from "@/lib/convex-query";
import { useLocale, useTranslations } from "next-intl";
import { api } from "@/convex/_generated/api";
import { Link } from "@/i18n/navigation";
import type { Id } from "@/convex/_generated/dataModel";
import { useFriendlyError } from "@/lib/use-friendly-error";
import { useRunAction } from "@/hooks/useRunAction";
import { requestConfirm } from "@/lib/confirm-dialog";
import { gradeLabel } from "@/shared/grade-labels";
import { GradeSelect } from "@/components/team/grade-select";

const box = "bg-[var(--color-bg-alt)] border border-[var(--color-border)] rounded-xl";
const input = "w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)]";
const primary = "rounded-lg bg-[var(--color-mint)] px-4 py-2 text-sm font-semibold text-[var(--color-mint-dark)] disabled:opacity-50";
const ghost = "text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text)]";

/** The password of a team, shown once: the admin must copy it and hand it over in person. */
function PasswordReveal({ name, password, onClose }: { name: string; password: string; onClose: () => void }) {
  const t = useTranslations("team");
  const [copied, setCopied] = useState(false);
  return (
    <div data-no-swipe className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label={t("passwordTitle", { name })}>
      <div className="w-full max-w-md space-y-4 rounded-xl bg-[var(--color-bg)] p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-[var(--color-text)]">{t("passwordTitle", { name })}</h2>
        <p className="select-all rounded-lg border border-[var(--color-mint)] bg-[var(--color-bg-alt)] p-4 text-center font-mono text-2xl font-semibold tracking-[0.25em] text-[var(--color-mint-text)]">
          {password}
        </p>
        <p className="text-sm text-[var(--color-text-secondary)]">{t("passwordWarn")}</p>
        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-text)]"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(password);
                setCopied(true);
              } catch {
                /* clipboard unavailable: the password is selectable on screen */
              }
            }}
          >
            {copied ? t("copied") : t("copy")}
          </button>
          <button type="button" className={primary} onClick={onClose}>
            {t("savedIt")}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TeamPage() {
  const t = useTranslations("team");
  const locale = useLocale();
  const d = (ms: number) => new Date(ms).toLocaleDateString(locale);
  const run = useRunAction();
  const tf = useFriendlyError();
  const { isAuthenticated } = useConvexAuth();
  const tenant = useQuery(api.tenants.getMyTenant);
  const me = useQuery(api.tenants.getMyMembership);
  const isAdmin = me?.role === "owner" || me?.role === "admin";
  const isOwner = me?.role === "owner";
  const tenantId = tenant?._id;
  const members = useQuery(api.tenants.listMembers, tenantId ? { tenantId } : "skip");
  const teams = useQuery(api.teams.listTeams, tenantId && isAdmin ? { tenantId } : "skip");
  const invites = useQuery(api.teams.listInvites, tenantId && isAdmin ? { tenantId } : "skip");
  const billing = useQuery(api.billing.getBillingState, tenantId && isAuthenticated ? { tenantId } : "skip");

  const createTeam = useMutation(api.teams.createTeam);
  const regenerate = useMutation(api.teams.regeneratePassword);
  const archiveTeam = useMutation(api.teams.archiveTeam);
  const inviteToTeam = useMutation(api.teams.inviteToTeam);
  const resendInvite = useMutation(api.teams.resendInvite);
  const cancelInvite = useMutation(api.teams.cancelInvite);
  const setMemberGrade = useMutation(api.teams.setMemberGrade);
  const removeMember = useMutation(api.tenants.removeMember);

  const [teamName, setTeamName] = useState("");
  const [email, setEmail] = useState("");
  const [inviteeName, setInviteeName] = useState("");
  const [teamId, setTeamId] = useState("");
  const [grade, setGrade] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [reveal, setReveal] = useState<{ name: string; password: string } | null>(null);

  const maxMembers = billing?.entitlements.maxTeamMembers;
  const activeCount = (members ?? []).filter((m) => m.status === "active").length;
  const pendingCount = invites?.length ?? 0;
  const used = activeCount + pendingCount;
  const atLimit = typeof maxMembers === "number" && Number.isFinite(maxMembers) && used >= maxMembers;
  const effectiveTeam = teamId || teams?.[0]?._id || "";

  async function guard(fn: () => Promise<void>) {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
    } catch (err) {
      setMsg({ kind: "err", text: tf(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <Link href="/app/account" className="text-[var(--color-text-secondary)] hover:text-[var(--color-text)]" aria-label="←">
          ←
        </Link>
        <h1 className="text-2xl sm:text-3xl font-bold text-[var(--color-text)]">{t("title")}</h1>
        {typeof maxMembers === "number" ? (
          <span className="ml-auto text-xs text-[var(--color-text-secondary)] tabular-nums">
            {t("seats", { used, max: Number.isFinite(maxMembers) ? maxMembers : "∞" })}
          </span>
        ) : null}
      </div>

      {msg ? (
        <p
          role={msg.kind === "err" ? "alert" : "status"}
          className={
            msg.kind === "ok"
              ? "text-sm text-[var(--color-mint-text)] bg-[var(--color-mint-light)] border border-[var(--color-mint)]/30 rounded-lg px-3 py-2"
              : "text-sm text-[var(--color-danger)] bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/30 rounded-lg px-3 py-2"
          }
        >
          {msg.text}
        </p>
      ) : null}

      {isAdmin && tenantId ? (
        <>
          <section className="space-y-3">
            <div>
              <h2 className="text-lg font-semibold text-[var(--color-text)]">{t("teamsTitle")}</h2>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{t("teamsIntro")}</p>
            </div>
            <form
              className="flex flex-wrap items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void guard(async () => {
                  const r = await createTeam({ tenantId, name: teamName });
                  setTeamName("");
                  setReveal({ name: teamName.trim(), password: r.password });
                });
              }}
            >
              <label className="min-w-[220px] flex-1 text-sm">
                <span className="mb-1 block text-[var(--color-text)]">{t("newTeamLabel")}</span>
                <input className={input} value={teamName} maxLength={60} onChange={(e) => setTeamName(e.target.value)} placeholder={t("newTeamPlaceholder")} required />
              </label>
              <button type="submit" className={primary} disabled={busy || teamName.trim().length < 2}>
                {t("createTeam")}
              </button>
            </form>

            {teams === undefined ? (
              <p className="text-sm text-[var(--color-text-secondary)]">{t("loading")}</p>
            ) : teams.length === 0 ? (
              <p className="text-sm text-[var(--color-text-secondary)]">{t("noTeams")}</p>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2">
                {teams.map((tm) => (
                  <li key={tm._id} className={`${box} space-y-2 p-4`}>
                    <p className="font-semibold text-[var(--color-text)]">{tm.name}</p>
                    <p className="text-xs text-[var(--color-text-secondary)]">
                      {t("members", { count: tm.memberCount })} · {t("pending", { count: tm.pendingCount })}
                    </p>
                    <div className="flex flex-wrap gap-3">
                      <button
                        type="button"
                        className={ghost}
                        disabled={busy}
                        onClick={async () => {
                          if (!(await requestConfirm(t("regenConfirm", { name: tm.name })))) return;
                          void guard(async () => {
                            const r = await regenerate({ teamId: tm._id as Id<"teams"> });
                            setReveal({ name: tm.name, password: r.password });
                          });
                        }}
                      >
                        {t("regen")}
                      </button>
                      <button
                        type="button"
                        className={`${ghost} hover:text-[var(--color-danger)]`}
                        disabled={busy}
                        onClick={async () => {
                          if (!(await requestConfirm(t("archiveConfirm", { name: tm.name }), { danger: true }))) return;
                          void guard(async () => {
                            await archiveTeam({ teamId: tm._id as Id<"teams"> });
                          });
                        }}
                      >
                        {t("archive")}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-[var(--color-text)]">{t("inviteTitle")}</h2>
            <form
              className="grid gap-3 sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault();
                void guard(async () => {
                  await inviteToTeam({ teamId: effectiveTeam as Id<"teams">, email: email.trim(), grade, inviteeName: inviteeName.trim() || undefined });
                  setEmail("");
                  setInviteeName("");
                  setMsg({ kind: "ok", text: t("inviteSent") });
                });
              }}
            >
              <label className="text-sm">
                <span className="mb-1 block text-[var(--color-text)]">{t("inviteEmail")}</span>
                <input type="email" className={input} value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t("inviteEmailPlaceholder")} required />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-[var(--color-text)]">{t("inviteName")}</span>
                <input className={input} value={inviteeName} maxLength={120} onChange={(e) => setInviteeName(e.target.value)} autoComplete="off" />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-[var(--color-text)]">{t("inviteTeam")}</span>
                <select className={input} value={effectiveTeam} onChange={(e) => setTeamId(e.target.value)} required disabled={!teams || teams.length === 0}>
                  {(teams ?? []).map((tm) => (
                    <option key={tm._id} value={tm._id}>{tm.name}</option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-[var(--color-text)]">{t("inviteGrade")}</span>
                <GradeSelect value={grade} onChange={setGrade} canGrantAdmin={isOwner} placeholder={t("invitePick")} className={input} />
              </label>
              <div className="sm:col-span-2">
                <button type="submit" className={primary} disabled={busy || atLimit || !effectiveTeam || !grade} title={atLimit ? t("limitReached") : undefined}>
                  {busy ? "…" : t("inviteSend")}
                </button>
                {atLimit ? (
                  <p className="mt-2 text-xs text-[var(--color-text-secondary)]">
                    {t("upgradeHint")}{" "}
                    <Link href="/app/account/billing" className="text-[var(--color-mint-text)]">{t("plans")}</Link>
                  </p>
                ) : null}
              </div>
            </form>
          </section>

          {pendingCount > 0 ? (
            <section>
              <h2 className="mb-2 text-sm font-semibold text-[var(--color-text)]">{t("pendingTitle")}</h2>
              <div className={`${box} divide-y divide-[var(--color-border)]`}>
                {invites!.map((inv) => (
                  <div key={inv._id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
                    <span className="min-w-0 truncate text-[var(--color-text)]">
                      {inv.inviteeName ? `${inv.inviteeName} · ` : ""}{inv.email}{" "}
                      <span className="text-xs text-[var(--color-text-secondary)]">
                        {t("pendingMeta", { team: inv.teamName, grade: inv.grade ? gradeLabel(locale, inv.grade) : "—", date: d(inv.expiresAt) })}
                      </span>
                      {inv.locked ? <span className="ml-2 text-xs text-[var(--color-danger)]">{t("locked")}</span> : null}
                    </span>
                    <span className="flex shrink-0 gap-3">
                      <button
                        type="button"
                        className={ghost}
                        disabled={busy}
                        onClick={() =>
                          void guard(async () => {
                            await resendInvite({ ticketId: inv._id as Id<"teamTickets"> });
                            setMsg({ kind: "ok", text: t("resent") });
                          })
                        }
                      >
                        {t("resend")}
                      </button>
                      <button type="button" className={`${ghost} hover:text-[var(--color-danger)]`} onClick={() => run(cancelInvite({ ticketId: inv._id as Id<"teamTickets"> }))}>
                        {t("cancel")}
                      </button>
                    </span>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </>
      ) : null}

      <section>
        <h2 className="mb-2 text-sm font-semibold text-[var(--color-text)]">{t("membersTitle")}</h2>
        <div className={`${box} divide-y divide-[var(--color-border)]`}>
          {members === undefined ? (
            <div className="px-6 py-8 text-center text-[var(--color-text-secondary)]">{t("loading")}</div>
          ) : (
            members
              .filter((m) => m.status !== "removed")
              .map((m) => (
                <div key={m._id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-[var(--color-text)]">{m.userName ?? m.userEmail ?? "—"}</p>
                    <p className="truncate text-xs text-[var(--color-text-secondary)]">
                      {m.userEmail}
                      {m.acceptedAt ? t("memberSince", { date: d(m.acceptedAt) }) : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {isAdmin && m.role !== "owner" ? (
                      <GradeSelect
                        value={m.grade ?? ""}
                        placeholder={t("noGrade")}
                        canGrantAdmin={isOwner}
                        ariaLabel={t("inviteGrade")}
                        className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1 text-xs text-[var(--color-text)]"
                        onChange={(g) =>
                          g &&
                          void guard(async () => {
                            await setMemberGrade({ membershipId: m._id as Id<"memberships">, grade: g });
                            setMsg({ kind: "ok", text: t("gradeChanged") });
                          })
                        }
                      />
                    ) : (
                      <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-0.5 text-xs capitalize">
                        {m.grade ? gradeLabel(locale, m.grade) : m.role}
                      </span>
                    )}
                    {isAdmin && m.role !== "owner" ? (
                      <button type="button" onClick={() => run(removeMember({ membershipId: m._id as Id<"memberships"> }))} className={`${ghost} hover:text-[var(--color-danger)]`}>
                        {t("remove")}
                      </button>
                    ) : null}
                  </div>
                </div>
              ))
          )}
        </div>
      </section>

      {reveal ? <PasswordReveal name={reveal.name} password={reveal.password} onClose={() => setReveal(null)} /> : null}
    </div>
  );
}
