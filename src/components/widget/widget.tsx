"use client";

import { useState, useEffect } from "react";

interface WidgetProps {
  configurator: any;
  theme: string;
  lang: string;
  preview: boolean;
}

export function Widget({ configurator, theme, lang, preview }: WidgetProps) {
  useEffect(() => {
    const resolved = theme === "light" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", resolved);
  }, [theme]);

  useEffect(() => {
    function postHeight() {
      if (window.parent === window) return;
      window.parent.postMessage(
        { type: "onespec:resize", publicId: configurator.publicId, height: document.body.scrollHeight },
        "*",
      );
    }
    postHeight();
    const ro = new ResizeObserver(postHeight);
    ro.observe(document.body);
    if (window.parent !== window) {
      window.parent.postMessage({ type: "onespec:ready", publicId: configurator.publicId }, "*");
    }
    return () => ro.disconnect();
  }, [configurator.publicId]);

  const [step, setStep] = useState<"config" | "form" | "success">("config");
  const [formData, setFormData] = useState({
    leadName: "",
    leadEmail: "",
    leadPhone: "",
    leadCompany: "",
    leadMessage: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmitQuote() {
    setError("");
    setLoading(true);
    try {
      const response = await fetch("/api/widget/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          publicId: configurator.publicId,
          configuratorId: configurator.publicId, // Will be resolved server-side
          catalogVersion: configurator.catalogVersion,
          items: [{ quantity: 1, price: 1000 }], // Stub items
          priceCents: 1000,
          leadName: formData.leadName,
          leadEmail: formData.leadEmail,
          leadPhone: formData.leadPhone,
          leadCompany: formData.leadCompany,
          leadMessage: formData.leadMessage,
          leadLocale: lang,
        }),
      });

      if (response.ok) {
        setStep("success");
        if (window.parent !== window) {
          window.parent.postMessage({ type: "onespec:submitted", publicId: configurator.publicId }, "*");
        }
      } else {
        const err = await response.json();
        setError(err.error || "Submission failed");
      }
    } catch (e: any) {
      setError(e.message || "Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full min-h-screen bg-[var(--color-bg)] text-[var(--color-text)] p-6">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-2">{configurator.name}</h1>
        <p className="text-[var(--color-text-secondary)] mb-6">Configuratore di infissi</p>

        {step === "config" && (
          <div className="space-y-4">
            <div className="bg-[var(--color-bg-alt)] rounded-lg p-6 border border-[var(--color-border)]">
              <div className="aspect-video bg-[var(--color-bg)] rounded border border-dashed border-[var(--color-border)] flex items-center justify-center mb-4">
                <p className="text-[var(--color-text-secondary)] text-sm">Widget UI placeholder</p>
              </div>
              <button
                onClick={() => setStep("form")}
                className="w-full bg-[var(--color-mint)] text-[var(--color-mint-dark)] font-bold py-3 rounded-lg hover:opacity-90"
              >
                Continua → Richiedi Preventivo
              </button>
            </div>
          </div>
        )}

        {step === "form" && (
          <div className="bg-[var(--color-bg-alt)] rounded-lg p-6 border border-[var(--color-border)]">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Nome</label>
                <input
                  type="text"
                  value={formData.leadName}
                  onChange={(e) => setFormData({ ...formData, leadName: e.target.value })}
                  className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded px-3 py-2 text-[var(--color-text)]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <input
                  type="email"
                  value={formData.leadEmail}
                  onChange={(e) => setFormData({ ...formData, leadEmail: e.target.value })}
                  className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded px-3 py-2 text-[var(--color-text)]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Telefono</label>
                <input
                  type="tel"
                  value={formData.leadPhone}
                  onChange={(e) => setFormData({ ...formData, leadPhone: e.target.value })}
                  className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded px-3 py-2 text-[var(--color-text)]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Azienda</label>
                <input
                  type="text"
                  value={formData.leadCompany}
                  onChange={(e) => setFormData({ ...formData, leadCompany: e.target.value })}
                  className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded px-3 py-2 text-[var(--color-text)]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Messaggio</label>
                <textarea
                  value={formData.leadMessage}
                  onChange={(e) => setFormData({ ...formData, leadMessage: e.target.value })}
                  className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded px-3 py-2 text-[var(--color-text)] h-24"
                />
              </div>
              {error && <p className="text-red-500 text-sm">{error}</p>}
              <button
                onClick={handleSubmitQuote}
                disabled={loading}
                className="w-full bg-[var(--color-mint)] text-[var(--color-mint-dark)] font-bold py-3 rounded-lg hover:opacity-90 disabled:opacity-50"
              >
                {loading ? "Invio..." : "Invia Richiesta"}
              </button>
            </div>
          </div>
        )}

        {step === "success" && (
          <div className="bg-[var(--color-bg-alt)] rounded-lg p-6 border border-[var(--color-border)] text-center">
            <p className="text-lg font-bold text-[var(--color-mint)]">✓ Richiesta inviata con successo!</p>
            <p className="text-[var(--color-text-secondary)] mt-2">Ti contatteremo presto con un preventivo.</p>
          </div>
        )}
      </div>
    </div>
  );
}
