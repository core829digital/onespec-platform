"use client";

import { ConvexError } from "convex/values";
import { useEffect, useState } from "react";
import { useMutation } from "convex/react";
import { useQuery } from "@/lib/convex-query";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Section, Field, TextInput, SelectInput, Toggle, inputClass } from "./editor-primitives";
import { useFriendlyError } from "@/lib/use-friendly-error";
import { useTranslations } from "next-intl";

const FONTS = [
  { value: "geist", label: "Geist (OneSpec)" },
  { value: "inter", label: "Inter" },
  { value: "space-grotesk", label: "Space Grotesk" },
  { value: "system", label: null },
];

const UPLOAD_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
const MAX_LOGO_BYTES = 2 * 1024 * 1024;
// Every language the public widget speaks — each can carry its own texts.
const LOCALES = ["it", "en", "fr", "de", "nl"] as const;
type CopyBlock = { headline?: string; subheadline?: string; ctaLabel?: string };

export function BrandingTab({ configuratorId }: { configuratorId: Id<"configurators"> }) {
  const t = useTranslations("editor.branding");
  const tf = useFriendlyError();
  const branding = useQuery(api.branding.getBranding, { configuratorId });
  const updateBranding = useMutation(api.branding.updateBranding);
  const generateUploadUrl = useMutation(api.branding.generateUploadUrl);
  const setLogo = useMutation(api.branding.setLogo);
  const deleteLogo = useMutation(api.branding.deleteLogo);

  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Record<string, string | boolean>>({});
  const [copy, setCopy] = useState<Record<string, CopyBlock> | null>(null);

  const val = (k: string, fallback: string | boolean) => form[k] ?? fallback;
  const set = (k: string, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));
  const currentCopy: Record<string, CopyBlock> = copy ?? (branding?.copy ?? {});
  const setCopyField = (loc: string, field: keyof CopyBlock, v: string) =>
    setCopy({ ...currentCopy, [loc]: { ...currentCopy[loc], [field]: v } });

  async function save() {
    if (!branding) return;
    setSaving(true);
    setMsg(null);
    try {
      await updateBranding({
        configuratorId,
        whiteLabel: Boolean(val("whiteLabel", branding.whiteLabel)),
        colorAccent: String(val("colorAccent", branding.colorAccent)),
        colorAccentInk: String(val("colorAccentInk", branding.colorAccentInk)),
        colorBg: String(val("colorBg", branding.colorBg ?? "")) || undefined,
        colorBgDark: String(val("colorBgDark", branding.colorBgDark ?? "")) || undefined,
        fontFamily: String(val("fontFamily", branding.fontFamily)) as "geist",
        copy: currentCopy,
        companyInfo: {
          name: String(val("ciName", branding.companyInfo.name)),
          vatId: String(val("ciVat", branding.companyInfo.vatId ?? "")) || undefined,
          address: String(val("ciAddr", branding.companyInfo.address ?? "")) || undefined,
          phone: String(val("ciPhone", branding.companyInfo.phone ?? "")) || undefined,
          email: String(val("ciEmail", branding.companyInfo.email ?? "")) || undefined,
        },
      });
      setForm({});
      setCopy(null);
      setMsg({ kind: "ok", text: t("saved") });
    } catch (e) {
      setMsg({ kind: "err", text: tf(e) });
    } finally {
      setSaving(false);
    }
  }

  // Auto-save: colors/toggles/copy used to sit inert until "Salva branding"
  // was clicked. Debounced so typing doesn't spam mutations; `form`/`copy`
  // start empty/null, so this only fires once the user has actually edited
  // something (never on the initial load render).
  useEffect(() => {
    if (!branding) return;
    if (Object.keys(form).length === 0 && copy === null) return;
    const timer = setTimeout(() => void save(), 900);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, copy, branding]);

  if (branding === undefined) {
    return <p className="text-[var(--color-text-secondary)]">{t("loading")}</p>;
  }
  if (branding === null) {
    return <p className="text-[var(--color-danger)]">{t("notFound")}</p>;
  }

  async function uploadLogo(file: File, variant: "dark" | "light") {
    setMsg(null);
    if (!UPLOAD_TYPES.includes(file.type)) {
      setMsg({ kind: "err", text: t("errFormat") });
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      setMsg({ kind: "err", text: t("errSize") });
      return;
    }
    try {
      const { uploadUrl } = await generateUploadUrl({ configuratorId, contentType: file.type });
      const res = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!res.ok) throw new ConvexError("UPLOAD_FAILED");
      const { storageId } = (await res.json()) as { storageId: Id<"_storage"> };
      await setLogo({ configuratorId, storageId, variant });
      setMsg({ kind: "ok", text: t("logoUploaded") });
    } catch (e) {
      setMsg({ kind: "err", text: tf(e) });
    }
  }

  return (
    <div className="space-y-6">
      {msg ? (
        <p
          className={
            msg.kind === "ok"
              ? "text-sm text-[var(--color-mint-text)] bg-[var(--color-mint-light)] border border-[var(--color-mint)]/30 rounded-lg px-3 py-2"
              : "text-sm text-[var(--color-danger)] bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/30 rounded-lg px-3 py-2"
          }
        >
          {msg.text}
        </p>
      ) : null}

      <Section title={t("brandTitle")} description={t("brandDesc")}>
        <Toggle
          checked={Boolean(val("whiteLabel", branding.whiteLabel))}
          onChange={(v) => set("whiteLabel", v)}
          label={t("whiteLabel")}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label={t("accent")} hint={t("accentHint")}>
            <ColorInput value={String(val("colorAccent", branding.colorAccent))} onChange={(v) => set("colorAccent", v)} />
          </Field>
          <Field label={t("accentInk")} hint={t("accentInkHint")}>
            <ColorInput value={String(val("colorAccentInk", branding.colorAccentInk))} onChange={(v) => set("colorAccentInk", v)} />
          </Field>
          <Field label={t("bgLight")} hint={t("bgLightHint")}>
            <ColorInput value={String(val("colorBg", branding.colorBg ?? ""))} onChange={(v) => set("colorBg", v)} emptyPlaceholder={t("defaultPlaceholder")} />
          </Field>
          <Field label={t("bgDark")} hint={t("optional")}>
            <ColorInput value={String(val("colorBgDark", branding.colorBgDark ?? ""))} onChange={(v) => set("colorBgDark", v)} emptyPlaceholder={t("defaultPlaceholder")} />
          </Field>
        </div>
        <Field label={t("font")}>
          <SelectInput value={String(val("fontFamily", branding.fontFamily))} onChange={(e) => set("fontFamily", e.target.value)}>
            {FONTS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label ?? t("fontSystem")}
              </option>
            ))}
          </SelectInput>
        </Field>
      </Section>

      <Section title={t("logoTitle")} description={t("logoDesc")}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <LogoSlot
            title={t("logoLightBg")}
            url={branding.logoUrl}
            onPick={(f) => uploadLogo(f, "dark")}
            onDelete={() => deleteLogo({ configuratorId, variant: "dark" })}
          />
          <LogoSlot
            title={t("logoDarkBg")}
            url={branding.logoLightUrl}
            onPick={(f) => uploadLogo(f, "light")}
            onDelete={() => deleteLogo({ configuratorId, variant: "light" })}
          />
        </div>
      </Section>

      <Section title={t("textsTitle")} description={t("textsDesc")}>
        {LOCALES.map((loc) => (
          <div key={loc} className="space-y-2">
            <p className="text-sm font-medium text-[var(--color-text)] uppercase">{loc}</p>
            <TextInput
              placeholder={t("headline")}
              value={currentCopy[loc]?.headline ?? ""}
              onChange={(e) => setCopyField(loc, "headline", e.target.value)}
              maxLength={120}
            />
            <TextInput
              placeholder={t("subheadline")}
              value={currentCopy[loc]?.subheadline ?? ""}
              onChange={(e) => setCopyField(loc, "subheadline", e.target.value)}
              maxLength={200}
            />
            <TextInput
              placeholder={t("ctaLabel")}
              value={currentCopy[loc]?.ctaLabel ?? ""}
              onChange={(e) => setCopyField(loc, "ctaLabel", e.target.value)}
              maxLength={40}
            />
          </div>
        ))}
      </Section>

      <Section title={t("companyTitle")} description={t("companyDesc")}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label={t("legalName")}>
            <TextInput value={String(val("ciName", branding.companyInfo.name))} onChange={(e) => set("ciName", e.target.value)} />
          </Field>
          <Field label={t("vatId")}>
            <TextInput value={String(val("ciVat", branding.companyInfo.vatId ?? ""))} onChange={(e) => set("ciVat", e.target.value)} />
          </Field>
          <Field label={t("address")}>
            <TextInput value={String(val("ciAddr", branding.companyInfo.address ?? ""))} onChange={(e) => set("ciAddr", e.target.value)} />
          </Field>
          <Field label={t("phone")}>
            <TextInput value={String(val("ciPhone", branding.companyInfo.phone ?? ""))} onChange={(e) => set("ciPhone", e.target.value)} />
          </Field>
          <Field label={t("email")}>
            <TextInput type="email" value={String(val("ciEmail", branding.companyInfo.email ?? ""))} onChange={(e) => set("ciEmail", e.target.value)} />
          </Field>
        </div>
      </Section>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="rounded-lg bg-[var(--color-mint)] px-5 py-2.5 text-sm font-semibold text-[var(--color-mint-dark)] transition-all hover:brightness-95 hover:shadow-sm active:brightness-90 disabled:opacity-50 disabled:hover:brightness-100 disabled:hover:shadow-none"
        >
          {saving ? t("saving") : t("saveNow")}
        </button>
        <span className="text-xs text-[var(--color-text-secondary)]">{t("autosave")}</span>
      </div>
    </div>
  );
}

function ColorInput({
  value,
  onChange,
  emptyPlaceholder,
}: {
  value: string;
  onChange: (v: string) => void;
  /** Set when the field may stay empty (falls back to the default colour). */
  emptyPlaceholder?: string;
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
        placeholder={emptyPlaceholder ?? "#16d19d"}
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
  const t = useTranslations("editor.branding");
  return (
    <div className="border border-[var(--color-border)] rounded-lg p-3 space-y-2">
      <p className="text-sm font-medium text-[var(--color-text)]">{title}</p>
      <div className="h-20 flex items-center justify-center rounded bg-[var(--color-bg)] border border-[var(--color-border)]">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={title} className="max-h-16 max-w-full object-contain" />
        ) : (
          <span className="text-xs text-[var(--color-text-secondary)]">{t("noLogo")}</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <label className="text-xs font-medium text-[var(--color-mint-text)] cursor-pointer hover:underline">
          {t("upload")}
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
            {t("remove")}
          </button>
        ) : null}
      </div>
    </div>
  );
}
