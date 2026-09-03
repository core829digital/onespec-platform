"use client";

import { use, useState } from "react";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Link, useRouter } from "@/i18n/navigation";

export default function AcceptInvitePage({ params }: { params: Promise<{ token: string }> }) {
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
        <h1 className="text-xl font-bold text-[var(--auth-text)]">Invito al team</h1>

        {invite === undefined ? (
          <p className="text-[var(--auth-text-dim)]">Caricamento…</p>
        ) : invite === null ? (
          <p className="text-[var(--color-danger)]">Invito non trovato.</p>
        ) : invite.accepted ? (
          <p className="text-[var(--auth-text-dim)]">Questo invito è già stato utilizzato.</p>
        ) : invite.expired ? (
          <p className="text-[var(--color-danger)]">Questo invito è scaduto.</p>
        ) : (
          <>
            <p className="text-[var(--auth-text-dim)] text-sm">
              Sei stato invitato a collaborare su <strong className="text-[var(--auth-text)]">{invite.tenantName}</strong> come{" "}
              {invite.role === "admin" ? "amministratore" : "membro"}. L&apos;invito è per{" "}
              <span className="font-mono">{invite.email}</span>.
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
                    setErr(
                      e instanceof Error && /EMAIL_MISMATCH/.test(e.message)
                        ? "Questo invito è per un altro indirizzo email. Accedi con l'account giusto."
                        : e instanceof Error && /ALREADY_HAS_TENANT/.test(e.message)
                          ? "Fai già parte di un'organizzazione."
                          : e instanceof Error
                            ? e.message
                            : "Errore",
                    );
                    setBusy(false);
                  }
                }}
                className="w-full rounded-lg bg-[var(--auth-live)] px-5 py-2.5 text-sm font-semibold text-[var(--color-mint-dark)] disabled:opacity-50"
              >
                {busy ? "…" : "Accetta l'invito"}
              </button>
            ) : (
              <div className="flex gap-2">
                <Link
                  href={`/auth/login?redirect=${encodeURIComponent(redirect)}`}
                  className="flex-1 text-center rounded-lg border border-[var(--auth-line-dim)] px-4 py-2 text-sm text-[var(--auth-text)]"
                >
                  Accedi
                </Link>
                <Link
                  href={`/auth/register?redirect=${encodeURIComponent(redirect)}`}
                  className="flex-1 text-center rounded-lg bg-[var(--auth-live)] px-4 py-2 text-sm font-semibold text-[var(--color-mint-dark)]"
                >
                  Registrati
                </Link>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
