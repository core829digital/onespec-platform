"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { MessageSquarePlus } from "lucide-react";

type Category = "bug" | "feature" | "general";

const CATEGORIES: Array<{ v: Category; label: string }> = [
  { v: "bug", label: "Bug" },
  { v: "feature", label: "Suggerimento" },
  { v: "general", label: "Altro" },
];

export function AlphaFeedbackButton() {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<Category>("bug");
  const [message, setMessage] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [err, setErr] = useState("");
  const submit = useMutation(api.feedback.submitFeedback);

  async function send() {
    setState("sending");
    setErr("");
    try {
      await submit({
        category,
        message: message.trim(),
        pagePath: typeof window !== "undefined" ? window.location.pathname : undefined,
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
      });
      setState("sent");
      setMessage("");
      setTimeout(() => {
        setOpen(false);
        setState("idle");
      }, 1400);
    } catch (e) {
      setState("error");
      setErr(
        e instanceof Error && /RATE_LIMITED/.test(e.message)
          ? "Hai inviato troppi feedback. Riprova più tardi."
          : e instanceof Error
            ? e.message
            : "Errore",
      );
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-2.5 py-1.5 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
        aria-label="Invia feedback o segnala un bug"
      >
        <MessageSquarePlus size={14} aria-hidden="true" />
        Feedback
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => state !== "sending" && setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Invia feedback"
            className="w-full max-w-md rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-5 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-semibold text-[var(--color-text)]">Feedback Alpha</h2>
            {state === "sent" ? (
              <p className="text-sm text-[var(--color-mint)]">Grazie! Ricevuto.</p>
            ) : (
              <>
                <div className="flex gap-2">
                  {CATEGORIES.map((c) => (
                    <button
                      key={c.v}
                      type="button"
                      onClick={() => setCategory(c.v)}
                      className={
                        category === c.v
                          ? "rounded-lg border border-[var(--color-mint)] bg-[var(--color-mint-light)] px-3 py-1.5 text-xs text-[var(--color-mint)]"
                          : "rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs text-[var(--color-text-secondary)]"
                      }
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={4}
                  maxLength={4000}
                  placeholder="Cosa è successo o cosa vorresti…"
                  className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)]"
                />
                {err ? <p className="text-xs text-[var(--color-danger)]">{err}</p> : null}
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-text)]"
                  >
                    Annulla
                  </button>
                  <button
                    type="button"
                    disabled={state === "sending" || message.trim().length < 3}
                    onClick={send}
                    className="rounded-lg bg-[var(--color-mint)] px-4 py-2 text-sm font-semibold text-[var(--color-mint-dark)] disabled:opacity-50"
                  >
                    {state === "sending" ? "Invio…" : "Invia"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
