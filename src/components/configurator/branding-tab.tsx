"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Section, Field, TextInput, SelectInput, Toggle, inputClass } from "./editor-primitives";

const FONTS = [
  { value: "geist", label: "Geist (default OneSpec)" },
  { value: "inter", label: "Inter" },
  { value: "space-grotesk", label: "Space Grotesk" },
  { value: "system", label: "Font di sistema" },
];

const UPLOAD_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const LOCALES = ["it", "en", "fr"] as const;
type CopyBlock = { headline?: string; subheadline?: string; ctaLabel?: string };

export function BrandingTab({ configuratorId }: { configuratorId: Id<"configurators"> }) {
  const branding = useQuery(api.branding.getBranding, { configuratorId });
  const updateBranding = useMutation(api.branding.updateBranding);
  const generateUploadUrl = useMutation(api.branding.generateUploadUrl);
  const setLogo = useMutation(api.branding.setLogo);
  const deleteLogo = useMutation(api.branding.deleteLogo);

  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Record<string, string | boolean>>({});
  const [copy, setCopy] = useState<Record<string, CopyBlock> | null>(null);

  if (branding === undefined) {
    return <p className="text-[var(--color-text-secondary)]">Caricamento...</p>;
  }
  if (branding === null) {
    return <p className="text-[var(--color-danger)]">Branding non trovato per questo configuratore.</p>;
  }

  const val = (k: string, fallback: string | boolean) => form[k] ?? fallback;
  const set = (k: string, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));
  const currentCopy: Record<string, CopyBlock> = copy ?? (branding.copy ?? {});
  const setCopyField = (loc: string, field: keyof CopyBlock, v: string) =>
    setCopy({ ...currentCopy, [loc]: { ...currentCopy[loc], [field]: v } });

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      await updateBranding({
        configuratorId,
        whiteLabel: Boolean(val("whiteLabel", branding!.whiteLabel)),
        colorAccent: String(val("colorAccent", branding!.colorAccent)),
        colorAccentInk: String(val("colorAccentInk", branding!.colorAccentInk)),
        colorBg: String(val("colorBg", branding!.colorBg ?? "")) || undefined,
        colorBgDark: String(val("colorBgDark", branding!.colorBgDark ?? "")) || undefined,
        fontFamily: String(val("fontFamily", branding!.fontFamily)) as "geist",
        copy: currentCopy,
        companyInfo: {
          name: String(val("ciName", branding!.companyInfo.name)),
          vatId: String(val("ciVat", branding!.companyInfo.vatId ?? "")) || undefined,
          address: String(val("ciAddr", branding!.companyInfo.address ?? "")) || undefined,
          phone: String(val("ciPhone", branding!.companyInfo.phone ?? "")) || undefined,
          email: String(val("ciEmail", branding!.companyInfo.email ?? "")) || undefined,
        },
      });
      setForm({});
      setCopy(null);
      setMsg({ kind: "ok", text: "Branding salvato. Pubblica per applicarlo al widget." });
    } catch (e) {
      setMsg({ kind: "err", text: e instanceof Error ? e.message : "Errore nel salvataggio" });
    } finally {
      setSaving(false);
    }
  }

  async function uploadLogo(file: File, variant: "dark" | "light") {
    setMsg(null);
    if (!UPLOAD_TYPES.includes(file.type)) {
      setMsg({ kind: "err", text: "Formato non supportato (PNG, JPEG, WEBP, SVG)." });
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      setMsg({ kind: "err", text: "Il logo supera 2 MB." });
      return;
    }
    try {
      const { uploadUrl } = await generateUploadUrl({ configuratorId, contentType: file.type });
      const res = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!res.ok) throw new Error("Upload fallito");
      const { storageId } = (await res.json()) as { storageId: Id<"_storage"> };
      await setLogo({ configuratorId, storageId, variant });
      setMsg({ kind: "ok", text: "Logo caricato." });
    } catch (e) {
      setMsg({ kind: "err", text: e instanceof Error ? e.message : "Errore nel caricamento" });
    }
  }

  return (
    <div className="space-y-6">
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

      <Section title="Marchio" description="Colori e font applicati al widget pubblico.">
        <Toggle
          checked={Boolean(val("whiteLabel", branding.whiteLabel))}
          onChange={(v) => set("whiteLabel", v)}
          label="White-label (nascondi il badge OneSpec) — richiede piano Business o superiore"
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Colore accento" hint="Bottoni e accenti.">
            <ColorInput value={String(val("colorAccent", branding.colorAccent))} onChange={(v) => set("colorAccent", v)} />
          </Field>
          <Field label="Testo su accento" hint="Colore del testo sopra i bottoni accento.">
            <ColorInput value={String(val("colorAccentInk", branding.colorAccentInk))} onChange={(v) => set("colorAccentInk", v)} />
          </Field>
          <Field label="Sfondo (tema chiaro)" hint="Opzionale. Lascia vuoto per il default.">
            <ColorInput value={String(val("colorBg", branding.colorBg ?? ""))} onChange={(v) => set("colorBg", v)} allowEmpty />
          </Field>
          <Field label="Sfondo (tema scuro)" hint="Opzionale.">
            <ColorInput value={String(val("colorBgDark", branding.colorBgDark ?? ""))} onChange={(v) => set("colorBgDark", v)} allowEmpty />
          </Field>
        </div>
        <Field label="Font">
          <SelectInput value={String(val("fontFamily", branding.fontFamily))} onChange={(e) => set("fontFamily", e.target.value)}>
            {FONTS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </SelectInput>
        </Field>
      </Section>

      <Section title="Logo" description="Caricato su Convex Storage. PNG, JPEG, WEBP o SVG, max 2 MB.">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <LogoSlot
            title="Logo (sfondo chiaro)"
            url={branding.logoUrl}
            onPick={(f) => uploadLogo(f, "dark")}
            onDelete={() => deleteLogo({ configuratorId, variant: "dark" })}
          />
          <LogoSlot
            title="Logo (sfondo scuro)"
            url={branding.logoLightUrl}
            onPick={(f) => uploadLogo(f, "light")}
            onDelete={() => deleteLogo({ configuratorId, variant: "light" })}
          />
        </div>
      </Section>

      <Section title="Testi del widget" description="Titolo, sottotitolo e call-to-action per lingua. Testo semplice, nessun HTML.">
        {LOCALES.map((loc) => (
          <div key={loc} className="space-y-2">
            <p className="text-sm font-medium text-[var(--color-text)] uppercase">{loc}</p>
            <TextInput
              placeholder="Titolo"
              value={currentCopy[loc]?.headline ?? ""}
              onChange={(e) => setCopyField(loc, "headline", e.target.value)}
              maxLength={120}
            />
            <TextInput
              placeholder="Sottotitolo"
              value={currentCopy[loc]?.subheadline ?? ""}
              onChange={(e) => setCopyField(loc, "subheadline", e.target.value)}
              maxLength={200}
            />
            <TextInput
              placeholder="Etichetta CTA"
              value={currentCopy[loc]?.ctaLabel ?? ""}
              onChange={(e) => setCopyField(loc, "ctaLabel", e.target.value)}
              maxLength={40}
            />
          </div>
        ))}
      </Section>

      <Section title="Dati azienda" description="Mostrati nel widget e nelle email di preventivo.">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Ragione sociale">
            <TextInput value={String(val("ciName", branding.companyInfo.name))} onChange={(e) => set("ciName", e.target.value)} />
          </Field>
          <Field label="Partita IVA">
            <TextInput value={String(val("ciVat", branding.companyInfo.vatId ?? ""))} onChange={(e) => set("ciVat", e.target.value)} />
          </Field>
          <Field label="Indirizzo">
            <TextInput value={String(val("ciAddr", branding.companyInfo.address ?? ""))} onChange={(e) => set("ciAddr", e.target.value)} />
          </Field>
          <Field label="Telefono">
            <TextInput value={String(val("ciPhone", branding.companyInfo.phone ?? ""))} onChange={(e) => set("ciPhone", e.target.value)} />
          </Field>
          <Field label="Email">
            <TextInput type="email" value={String(val("ciEmail", branding.companyInfo.email ?? ""))} onChange={(e) => set("ciEmail", e.target.value)} />
          </Field>
        </div>
      </Section>

      <button
        type="button"
        onClick={save}
        disabled={saving}
        className="rounded-lg bg-[var(--color-mint)] px-5 py-2.5 text-sm font-semibold text-[var(--color-mint-dark)] disabled:opacity-50"
      >
        {saving ? "Salvataggio..." : "Salva branding"}
      </button>
    </div>
  );
}

function ColorInput({
  value,
  onChange,
  allowEmpty,
}: {
  value: string;
  onChange: (v: string) => void;
  allowEmpty?: boolean;
}) {
  const hex = /^#[0-9a-fA-F]{6}$/.test(value) ? value : "#16d19d";
  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={hex}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-12 rounded border border-[var(--color-border)] bg-transparent"
      />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={allowEmpty ? "(default)" : "#16d19d"}
        className={`${inputClass} font-mono w-32`}
      />
    </div>
  );
}

function LogoSlot({
  title,
  url,
  onPick,
  onDelete,
}: {
  title: string;
  url: string | null | undefined;
  onPick: (f: File) => void;
  onDelete: () => void;
}) {
  return (
    <div className="border border-[var(--color-border)] rounded-lg p-3 space-y-2">
      <p className="text-sm font-medium text-[var(--color-text)]">{title}</p>
      <div className="h-20 flex items-center justify-center rounded bg-[var(--color-bg)] border border-[var(--color-border)]">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={title} className="max-h-16 max-w-full object-contain" />
        ) : (
          <span className="text-xs text-[var(--color-text-secondary)]">Nessun logo</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <label className="text-xs font-medium text-[var(--color-mint)] cursor-pointer hover:underline">
          Carica
          <input
            type="file"
            accept={UPLOAD_TYPES.join(",")}
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onPick(f);
              e.target.value = "";
            }}
          />
        </label>
        {url ? (
          <button
            type="button"
            onClick={onDelete}
            className="text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-danger)]"
          >
            Rimuovi
          </button>
        ) : null}
      </div>
    </div>
  );
}
