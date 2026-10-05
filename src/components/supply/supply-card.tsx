"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { useFormatter, useTranslations } from "next-intl";
import { Check } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { useFriendlyError } from "@/lib/use-friendly-error";
import { requestConfirm } from "@/lib/confirm-dialog";
import { SUPPLY_STAGES, nextStage, parseEuroInput, type MoneyCheck } from "@/shared/supply";
import { centsToInput, useEuro } from "./money";

type Supply = Doc<"supplies"> & { costCents: number; profitCents: number };
const input = "w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)]";
const btn = "rounded-lg bg-[var(--color-mint)] px-4 py-2 text-sm font-semibold text-[var(--color-mint-dark)] disabled:opacity-50";
const ghost = "rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs text-[var(--color-text)] hover:bg-[var(--color-bg-alt)] disabled:opacity-50";

function MoneyField({ label, value, onChange, check, show }: { label: string; value: string; onChange: (v: string) => void; check: MoneyCheck; show: boolean }) {
  const t = useTranslations("supply.amount");
  const bad = show && !check.ok;
  return (
    <label className="block text-xs font-medium text-[var(--color-text-secondary)]">
      {label}
      <input className={`${input} mt-1`} inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value.slice(0, 14))} aria-invalid={bad} placeholder="0,00" />
      {bad && !check.ok ? <span role="alert" className="mt-1 block text-[var(--color-danger)]">{t(check.code)}</span> : null}
    </label>
  );
}

export function SupplyCard({ supply, partners, isAdmin }: { supply: Supply; partners: Doc<"supplyPartners">[]; isAdmin: boolean }) {
  const t = useTranslations("supply");
  const tf = useFriendlyError();
  const euro = useEuro();
  const fmt = useFormatter();
  const advance = useMutation(api.supplies.advance);
  const revert = useMutation(api.supplies.revert);
  const remove = useMutation(api.supplies.remove);
  const setPaid = useMutation(api.supplies.setFactoryPaid);
  const updateCosts = useMutation(api.supplies.updateCosts);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [touched, setTouched] = useState(false);
  const [factory, setFactory] = useState(centsToInput(supply.factoryCostCents));
  const [transport, setTransport] = useState(centsToInput(supply.transportCostCents ?? 0));
  const [other, setOther] = useState(centsToInput(supply.otherCostsCents));
  const [partnerId, setPartnerId] = useState("");

  const to = nextStage(supply.status);
  const idx = SUPPLY_STAGES.indexOf(supply.status);
  const factoryCheck = parseEuroInput(factory);
  const transportCheck = parseEuroInput(transport);
  const otherCheck = other.trim() === "" ? ({ ok: true, cents: 0 } as MoneyCheck) : parseEuroInput(other);
  const producers = partners.filter((p) => !p.archived && p.roles.includes("producer"));
  const deliverers = partners.filter((p) => !p.archived && p.roles.includes("deliverer"));

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setErr("");
    try {
      await fn();
      setTouched(false);
    } catch (e) {
      setErr(tf(e));
    } finally {
      setBusy(false);
    }
  }

  function onAdvance() {
    if (!to) return;
    setTouched(true);
    if (to === "production") {
      if (!factoryCheck.ok) return;
      void run(() => advance({ supplyId: supply._id, factoryCostCents: factoryCheck.cents, producerId: partnerId ? (partnerId as Doc<"supplyPartners">["_id"]) : undefined }));
    } else if (to === "delivery") {
      if (!transportCheck.ok) return;
      void run(() => advance({ supplyId: supply._id, transportCostCents: transportCheck.cents, delivererId: partnerId ? (partnerId as Doc<"supplyPartners">["_id"]) : undefined }));
    } else {
      void run(() => advance({ supplyId: supply._id }));
    }
  }

  const name = (id: string | undefined) => partners.find((p) => p._id === id)?.name;

  return (
    <li className="space-y-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-[var(--color-text)]">{supply.reference}</p>
          <p className="text-sm text-[var(--color-text-secondary)]">{supply.customerName}</p>
        </div>
        <div className="text-right text-sm">
          <p className="tabular-nums text-[var(--color-text)]">{euro(supply.revenueExVatCents)} <span className="text-xs text-[var(--color-text-secondary)]">{t("fields.exVat")}</span></p>
          <p className={`text-xs tabular-nums ${supply.profitCents < 0 ? "text-[var(--color-danger)]" : "text-[var(--color-text-secondary)]"}`}>{t("fields.profit")}: {euro(supply.profitCents)}</p>
        </div>
      </div>

      <ol className="flex flex-wrap gap-1.5 text-xs" aria-label={t("title")}>
        {SUPPLY_STAGES.filter((s) => s !== "delivered").map((s, i) => {
          const done = idx > i || supply.status === "delivered";
          const current = idx === i;
          return (
            <li key={s} aria-current={current ? "step" : undefined} className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 ${done ? "border-[var(--color-mint)] bg-[var(--color-mint-light)] text-[var(--color-mint-text)]" : current ? "border-[var(--color-mint)] text-[var(--color-text)] font-semibold" : "border-[var(--color-border)] text-[var(--color-text-secondary)]"}`}>
              {done ? <Check size={12} aria-hidden="true" /> : null}
              {t(`stages.${s}`)}
            </li>
          );
        })}
      </ol>

      <dl className="grid gap-x-6 gap-y-1 text-xs text-[var(--color-text-secondary)] sm:grid-cols-2">
        {supply.factoryCostCents !== undefined ? (
          <div className="flex justify-between gap-2"><dt>{t("fields.factoryCost")}{name(supply.producerId) ? ` · ${name(supply.producerId)}` : ""}</dt><dd className="tabular-nums">{euro(supply.factoryCostCents)}</dd></div>
        ) : null}
        {supply.transportCostCents !== undefined ? (
          <div className="flex justify-between gap-2"><dt>{t("fields.transportCost")}{name(supply.delivererId) ? ` · ${name(supply.delivererId)}` : ""}</dt><dd className="tabular-nums">{euro(supply.transportCostCents)}</dd></div>
        ) : null}
        {supply.otherCostsCents ? <div className="flex justify-between gap-2"><dt>{t("fields.otherCosts")}</dt><dd className="tabular-nums">{euro(supply.otherCostsCents)}</dd></div> : null}
        {supply.deliveredAt ? <div className="flex justify-between gap-2"><dt>{t("stages.delivered")}</dt><dd>{fmt.dateTime(supply.deliveredAt, { dateStyle: "medium" })}</dd></div> : null}
      </dl>

      {supply.status !== "quote" && supply.status !== "order" && supply.status !== "delivered" ? (
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <span className={supply.factoryPaidAt ? "text-[var(--color-mint-text)]" : "text-[var(--color-text-secondary)]"}>
            {supply.factoryPaidAt ? t("fields.factoryPaid") : t("fields.factoryUnpaid")}
          </span>
          <button type="button" className={ghost} disabled={busy} onClick={() => run(() => setPaid({ supplyId: supply._id, paid: !supply.factoryPaidAt }))}>
            {supply.factoryPaidAt ? t("fields.markUnpaid") : t("fields.markPaid")}
          </button>
        </div>
      ) : null}

      {err ? <p role="alert" className="text-sm text-[var(--color-danger)]">{err}</p> : null}

      {to === "production" || to === "delivery" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {to === "production" ? (
            <MoneyField label={t("fields.factoryCost")} value={factory} onChange={setFactory} check={factoryCheck} show={touched} />
          ) : (
            <MoneyField label={t("fields.transportCost")} value={transport} onChange={setTransport} check={transportCheck} show={touched} />
          )}
          <label className="block text-xs font-medium text-[var(--color-text-secondary)]">
            {to === "production" ? t("fields.producer") : t("fields.deliverer")}
            <select className={`${input} mt-1`} value={partnerId} onChange={(e) => setPartnerId(e.target.value)}>
              <option value="">{t("fields.none")}</option>
              {(to === "production" ? producers : deliverers).map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
            </select>
          </label>
        </div>
      ) : null}

      {supply.status !== "quote" ? (
        <details className="text-xs">
          <summary className="cursor-pointer text-[var(--color-text-secondary)]">{t("fields.otherCosts")}</summary>
          <div className="mt-2 flex flex-wrap items-end gap-2">
            <div className="w-40"><MoneyField label={t("fields.otherCosts")} value={other} onChange={setOther} check={otherCheck} show={true} /></div>
            <button type="button" className={ghost} disabled={busy || !otherCheck.ok} onClick={() => otherCheck.ok && run(() => updateCosts({ supplyId: supply._id, otherCostsCents: otherCheck.cents }))}>{t("fields.save")}</button>
          </div>
        </details>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {to ? <button type="button" className={btn} disabled={busy} onClick={onAdvance}>{busy ? "…" : t(`advance.${to}`)}</button> : null}
        {isAdmin && idx > 0 ? (
          <button type="button" className={ghost} disabled={busy} onClick={async () => { if (await requestConfirm(t("confirmRevert"), { confirmLabel: t("revert"), danger: true })) void run(() => revert({ supplyId: supply._id })); }}>{t("revert")}</button>
        ) : null}
        {isAdmin && (supply.status === "quote" || supply.status === "order") ? (
          <button type="button" className={ghost} disabled={busy} onClick={async () => { if (await requestConfirm(t("confirmRemove"), { confirmLabel: t("remove"), danger: true })) void run(() => remove({ supplyId: supply._id })); }}>{t("remove")}</button>
        ) : null}
      </div>
    </li>
  );
}
