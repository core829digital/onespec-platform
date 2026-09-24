"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Link } from "@/i18n/navigation";
import type { Id } from "@/convex/_generated/dataModel";
import { useFriendlyError } from "@/lib/use-friendly-error";
import { useRunAction } from "@/hooks/useRunAction";
import { useLocale, useTranslations } from "next-intl";

export default function TeamPage() {
  const t = useTranslations("team");
  const locale = useLocale();
  const d = (ms: number) => new Date(ms).toLocaleDateString(locale);
  const run = useRunAction();
  const tf = useFriendlyError();
  const tenant = useQuery(api.tenants.getMyTenant);
  const members = useQuery(api.tenants.listMembers, tenant ? { tenantId: tenant._id } : "skip");
  const invitations = useQuery(
    api.tenants.listInvitations,
    tenant ? { tenantId: tenant._id } : "skip",
  );
  const billing = useQuery(api.billing.getBillingState, tenant ? { tenantId: tenant._id } : "skip");

  const inviteMember = useMutation(api.tenants.inviteMember);
  const cancelInvitation = useMutation(api.tenants.cancelInvitation);
  const removeMember = useMutation(api.tenants.removeMember);

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "member">("member");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const maxMembers = billing?.entitlements.maxTeamMembers;
  const activeCount = (members ?? []).filter((m) => m.status === "active").length;
  const pendingCount = invitations?.length ?? 0;
  const used = activeCount + pendingCount;
  const atLimit =
    typeof maxMembers === "number" && Number.isFinite(maxMembers) && used >= maxMembers;

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    if (!tenant) return;
    setBusy(true);
    setMsg(null);
    try {
      await inviteMember({ tenantId: tenant._id, email: email.trim(), role });
      setEmail("");
      setMsg({ kind: "ok", text: t("inviteSent") });
    } catch (err) {
      setMsg({ kind: "err", text: tf(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/app/account" className="text-[var(--color-text-secondary)] hover:text-[var(--color-text)]">
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
          className={
            msg.kind === "ok"
              ? "text-sm text-[var(--color-mint)] bg-[var(--color-mint-light)] border border-[var(--color-mint)]/30 rounded-lg px-3 py-2"
              : "text-sm text-[var(--color-danger)] bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/30 rounded-lg px-3 py-2"
          }
        >
          {msg.text}
        </p>
      ) : null}

      <form onSubmit={invite} className="flex flex-wrap gap-2 items-end">
        <label className="flex-1 min-w-[200px] text-sm">
          <span className="block text-[var(--color-text)] mb-1">{t("inviteByEmail")}</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder={t("emailPlaceholder")}
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)]"
          />
        </label>
        <label className="text-sm">
          <span className="block text-[var(--color-text)] mb-1">{t("role")}</span>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as "admin" | "member")}
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)]"
          >
            <option value="member">{t("member")}</option>
            <option value="admin">{t("adminRole")}</option>
          </select>
        </label>
        <button
          type="submit"
          disabled={busy || atLimit}
          title={atLimit ? t("limitReached") : undefined}
          className="rounded-lg bg-[var(--color-mint)] px-4 py-2 text-sm font-semibold text-[var(--color-mint-dark)] disabled:opacity-50"
        >
          {busy ? "…" : t("invite")}
        </button>
      </form>
      {atLimit ? (
        <p className="text-xs text-[var(--color-text-secondary)]">
          {t("upgradeHint")}{" "}
          <Link href="/app/account/billing" className="text-[var(--color-mint)]">
            {t("plans")}
          </Link>
        </p>
      ) : null}

      <div className="bg-[var(--color-bg-alt)] border border-[var(--color-border)] rounded-xl divide-y divide-[var(--color-border)]">
        {members === undefined ? (
          <div className="px-6 py-8 text-center text-[var(--color-text-secondary)]">{t("loading")}</div>
        ) : (
          members
            .filter((m) => m.status !== "removed")
            .map((m) => (
              <div key={m._id} className="px-5 py-3.5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-[var(--color-text)] truncate">
                    {m.userName ?? m.userEmail ?? "—"}
                  </p>
                  <p className="text-xs text-[var(--color-text-secondary)] truncate">
                    {m.userEmail}
                    {m.acceptedAt ? t("memberSince", { date: d(m.acceptedAt) }) : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--color-bg)] border border-[var(--color-border)] capitalize">
                    {m.role}
                  </span>
                  {m.role !== "owner" ? (
                    <button
                      type="button"
                      onClick={() => run(removeMember({ membershipId: m._id as Id<"memberships"> }))}
                      className="text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-danger)]"
                    >
                      {t("remove")}
                    </button>
                  ) : null}
                </div>
              </div>
            ))
        )}
      </div>

      {pendingCount > 0 ? (
        <div>
          <h2 className="text-sm font-semibold text-[var(--color-text)] mb-2">{t("pendingInvites")}</h2>
          <div className="bg-[var(--color-bg-alt)] border border-[var(--color-border)] rounded-xl divide-y divide-[var(--color-border)]">
            {invitations!.map((inv) => (
              <div key={inv._id} className="px-5 py-3 flex items-center justify-between gap-3 text-sm">
                <span className="text-[var(--color-text)] truncate">
                  {inv.email}{" "}
                  <span className="text-xs text-[var(--color-text-secondary)]">
                    {t("inviteMeta", { role: inv.role, date: d(inv.expiresAt) })}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => run(cancelInvitation({ invitationId: inv._id as Id<"invitations"> }))}
                  className="text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-danger)]"
                >
                  {t("cancel")}
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
