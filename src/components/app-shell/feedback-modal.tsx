"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { analytics as posthog } from "@/lib/monitoring";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ChevronRight, LifeBuoy, MessageSquarePlus, Star, X } from "lucide-react";
import { useFriendlyError } from "@/lib/use-friendly-error";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

type Category = "general" | "feature" | "bug";

const CATEGORIES: Array<{ v: Category; labelKey: "catGeneral" | "catFeature" | "catBug" }> = [
  { v: "general", labelKey: "catGeneral" },
  { v: "feature", labelKey: "catFeature" },
  { v: "bug", labelKey: "catBug" },
];

/** Matches the exit keyframes in globals.css (os-dialog-out / os-backdrop-out). */
const EXIT_MS = 180;

/**
 * Feedback = an opinion on OneSpec (optionally with stars and permission to publish it as a review).
 * Help with a problem goes to a support ticket instead: the dialog says so and links there.
 *
 * Rendered in a portal on <body>: the topbar is a backdrop-filter surface, which becomes the containing block of
 * `position: fixed` children — inside it the dialog was trapped in the header instead of covering the screen.
 */
export function FeedbackButton({ variant = "topbar" }: { variant?: "topbar" | "row" }) {
  const t = useTranslations("feedback");
  const tf = useFriendlyError();
  const [phase, setPhase] = useState<"closed" | "open" | "closing">("closed");
  const [category, setCategory] = useState<Category>("general");
  const [message, setMessage] = useState("");
  const [rating, setRating] = useState(0);
  const [consent, setConsent] = useState(false);
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [err, setErr] = useState("");
  const submit = useMutation(api.feedback.submitFeedback);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reset = () => {
    setCategory("general");
    setMessage("");
    setRating(0);
    setConsent(false);
    setState("idle");
    setErr("");
  };

  const close = useCallback(() => {
    if (state === "sending") return;
    setPhase("closing");
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => {
      setPhase("closed");
      triggerRef.current?.focus();
    }, EXIT_MS);
  }, [state]);

  const open = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    if (state === "sent") reset();
    setPhase("open");
  };

  // While open: Escape closes, the page behind does not scroll, the text box takes the focus.
  useEffect(() => {
    if (phase !== "open") return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focus = setTimeout(() => textRef.current?.focus(), 30);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
      clearTimeout(focus);
    };
  }, [phase, close]);

  useEffect(() => () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }, []);

  async function send() {
    setState("sending");
    setErr("");
    try {
      await submit({
        category,
        message: message.trim(),
        pagePath: typeof window !== "undefined" ? window.location.pathname : undefined,
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
        rating: rating || undefined,
        reviewConsent: consent || undefined,
      });
      posthog.capture("feedback_submitted", {
        category,
        rating: rating || null,
        review_consent: consent,
        page_path: typeof window !== "undefined" ? window.location.pathname : undefined,
      });
      setState("sent");
      setTimeout(() => {
        setPhase((p) => (p === "open" ? "closing" : p));
        setTimeout(() => {
          setPhase("closed");
          reset();
        }, EXIT_MS);
      }, 1600);
    } catch (e) {
      posthog.captureException(e);
      setState("error");
      setErr(tf(e));
    }
  }

  const closing = phase === "closing";

  const dialog =
    phase === "closed" ? null : (
      <div
        className={`os-feedback-backdrop fixed inset-0 z-[70] flex items-center justify-center bg-black/45 p-4 backdrop-blur-md ${closing ? "is-closing" : ""}`}
        onClick={close}
      >
        <div
          role="dialog"
          aria-modal="true"
          data-feedback-dialog
          aria-labelledby="feedback-title"
          className={`os-feedback-panel w-full max-w-lg max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-5 shadow-[0_24px_60px_-12px_rgb(0_0_0/0.55)] sm:p-6 ${closing ? "is-closing" : ""}`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id="feedback-title" className="text-lg font-semibold text-[var(--color-text)]">{t("title")}</h2>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{t("intro")}</p>
            </div>
            <button
              type="button"
              onClick={close}
              aria-label={t("cancel")}
              className="-m-1 rounded-lg p-1.5 text-[var(--color-text-secondary)] hover:bg-[var(--color-bg)] hover:text-[var(--color-text)]"
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>

          {state === "sent" ? (
            <p className="mt-6 rounded-xl bg-[var(--color-mint-light)] px-4 py-3 text-sm text-[var(--color-mint-text)]" role="status">
              {consent ? t("thanksReview") : t("thanks")}
            </p>
          ) : (
            <div className="mt-4 space-y-4">
              {/* Feedback is not support: a problem that needs an answer goes to a ticket. */}
              <div className="flex gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3.5 py-3">
                <LifeBuoy size={18} className="mt-0.5 shrink-0 text-[var(--color-mint-text)]" aria-hidden="true" />
                <div className="min-w-0 text-xs leading-relaxed text-[var(--color-text-secondary)]">
                  <p>{t("supportHint")}</p>
                  <Link href="/app/support" onClick={close} className="mt-1 inline-block font-semibold text-[var(--color-mint-text)] hover:underline">
                    {t("supportCta")} →
                  </Link>
                </div>
              </div>

              <fieldset>
                <legend className="mb-1.5 text-xs font-medium text-[var(--color-text-secondary)]">{t("ratingLabel")}</legend>
                <div className="flex items-center gap-1" role="radiogroup" aria-label={t("ratingLabel")}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      role="radio"
                      aria-checked={rating === n}
                      aria-label={t("ratingValue", { n })}
                      onClick={() => setRating(rating === n ? 0 : n)}
                      className="rounded-md p-1 transition-transform duration-150 hover:scale-110 active:scale-95"
                    >
                      <Star
                        size={24}
                        aria-hidden="true"
                        className={n <= rating ? "fill-[#ffc94d] text-[#ffc94d]" : "text-[var(--color-border)]"}
                      />
                    </button>
                  ))}
                </div>
              </fieldset>

              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t("categoryLabel")}>
                {CATEGORIES.map((c) => (
                  <button
                    key={c.v}
                    type="button"
                    role="radio"
                    aria-checked={category === c.v}
                    onClick={() => setCategory(c.v)}
                    className={
                      category === c.v
                        ? "rounded-lg border border-[var(--color-mint)] bg-[var(--color-mint-light)] px-3 py-1.5 text-xs text-[var(--color-mint-text)]"
                        : "rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
                    }
                  >
                    {t(c.labelKey)}
                  </button>
                ))}
              </div>
              {category === "bug" ? <p className="-mt-2 text-xs text-[var(--color-text-secondary)]">{t("bugHint")}</p> : null}

              <textarea
                ref={textRef}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                maxLength={4000}
                aria-label={t("messageLabel")}
                placeholder={t("placeholder")}
                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2.5 text-sm text-[var(--color-text)]"
              />

              <label className="flex cursor-pointer items-start gap-2.5 text-xs leading-relaxed text-[var(--color-text-secondary)]">
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-mint)]" />
                <span>{t("reviewConsent")}</span>
              </label>

              {err ? <p className="text-xs text-[var(--color-danger)]" role="alert">{err}</p> : null}

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={close}
                  className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-text)]"
                >
                  {t("cancel")}
                </button>
                <button
                  type="button"
                  disabled={state === "sending" || message.trim().length < 3}
                  onClick={send}
                  className="rounded-lg bg-[var(--color-mint)] px-4 py-2 text-sm font-semibold text-[var(--color-mint-dark)] disabled:opacity-50"
                >
                  {state === "sending" ? t("sending") : t("send")}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );

  return (
    <>
      {variant === "row" ? (
        // The phone "More" sheet: same look as its other lines (the top bar button is hidden on small screens).
        <button
          ref={triggerRef}
          type="button"
          onClick={open}
          aria-haspopup="dialog"
          className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-sm font-medium text-[var(--color-text)] hover:bg-[var(--color-bg)]"
        >
          <span className="text-[var(--color-text-secondary)]"><MessageSquarePlus size={20} aria-hidden="true" /></span>
          <span className="min-w-0 flex-1 truncate text-left">{t("button")}</span>
          <ChevronRight size={16} aria-hidden="true" className="shrink-0 text-[var(--color-text-secondary)]" />
        </button>
      ) : (
        <button
          ref={triggerRef}
          type="button"
          onClick={open}
          className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-2.5 py-1.5 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
          aria-label={t("open")}
          aria-haspopup="dialog"
        >
          <MessageSquarePlus size={14} aria-hidden="true" />
          {t("button")}
        </button>
      )}
      {dialog ? createPortal(dialog, document.body) : null}
    </>
  );
}
