"use client";

import { use, useState } from "react";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Link, useRouter } from "@/i18n/navigation";
import { useFriendlyError } from "@/lib/use-friendly-error";
import { useTranslations } from "next-intl";

export default function AcceptInvitePage({ params }: { params: Promise<{ token: string }> }) {
  const t = useTranslations("invite");
  const tf = useFriendlyError();
  const { token } = use(params);
  const router = useRouter();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const invite = useQuery(api.tenants.getInvitationByToken, { token });
  const accept = useMutation(api.tenants.acceptInvitation);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const redirect = `/invite/${token}`;

  return (
    <div className="auth-scene min-h-dvh flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-[var(--auth-panel)] border border-[var(--auth-line-dim)] rounded-2xl p-8 space-y-4">
        <h1 className="text-xl font-bold text-[var(--auth-text)]">{t("title")}</h1>

        {invite === undefined ? (
          <p className="text-[var(--auth-text-dim)]">{t("loading")}</p>
        ) : invite === null ? (
          <p className="text-[var(--color-danger)]">{t("notFound")}</p>
        ) : invite.accepted ? (
          <p className="text-[var(--auth-text-dim)]">{t("used")}</p>
        ) : invite.expired ? (
          <p className="text-[var(--color-danger)]">{t("expired")}</p>
        ) : (
          <>
            <p className="text-[var(--auth-text-dim)] text-sm">
              {t("body", {
                company: invite.tenantName,
                role: invite.role === "admin" ? t("roleAdmin") : t("roleMember"),
                email: invite.email,
              })}
            </p>
            {err ? <p className="text-sm text-[var(--color-danger)]">{err}</p> : null}

            {isLoading ? (
              <p className="text-[var(--auth-text-dim)]">…</p>
            ) : isAuthenticated ? (
              <button
                type="button"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  setErr("");
                  try {
                    await accept({ token });
                    router.replace("/app/dashboard");
                  } catch (e) {
                    setErr(tf(e));
                    setBusy(false);
                  }
                }}
                className="w-full rounded-lg bg-[var(--auth-live)] px-5 py-2.5 text-sm font-semibold text-[var(--color-mint-dark)] disabled:opacity-50"
              >
                {busy ? "…" : t("accept")}
              </button>
            ) : (
              <div className="flex gap-2">
                <Link
                  href={`/auth/login?redirect=${encodeURIComponent(redirect)}`}
                  className="flex-1 text-center rounded-lg border border-[var(--auth-line-dim)] px-4 py-2 text-sm text-[var(--auth-text)]"
                >
                  {t("login")}
                </Link>
                <Link
                  href={`/auth/register?redirect=${encodeURIComponent(redirect)}`}
                  className="flex-1 text-center rounded-lg bg-[var(--auth-live)] px-4 py-2 text-sm font-semibold text-[var(--color-mint-dark)]"
                >
                  {t("register")}
                </Link>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
