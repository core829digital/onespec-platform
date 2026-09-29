"use client";

import { requestConfirm } from "@/lib/confirm-dialog";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useTranslations, useFormatter, useLocale } from "next-intl";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { Plus, Trash2, Truck, Package, CalendarDays, Warehouse, MapPinned } from "lucide-react";
import { useFriendlyError } from "@/lib/use-friendly-error";
import { EmptyState } from "@/components/app-shell/empty-state";
import { SiteDeliveriesTab } from "@/components/logistics/site-deliveries-tab";

type Tab = "calendar" | "suppliers" | "carriers" | "inventory" | "siteDeliveries";
type Delivery = Doc<"deliveries">;

export default function LogisticsPage() {
  const t = useTranslations("logistics");
  const tf = useFriendlyError();
  const tenant = useQuery(api.tenants.getMyTenant);
  const [tab, setTab] = useState<Tab>("calendar");
  const [err, setErr] = useState("");
  const showError = (e: unknown) => {
    setErr(tf(e));
    setTimeout(() => setErr(""), 8000);
  };

  const tabs: { key: Tab; label: string; icon: typeof CalendarDays }[] = [
    { key: "calendar", label: t("tabs.calendar"), icon: CalendarDays },
    { key: "suppliers", label: t("tabs.suppliers"), icon: Truck },
    { key: "carriers", label: t("tabs.carriers"), icon: Package },
    { key: "inventory", label: t("tabs.inventory"), icon: Warehouse },
    { key: "siteDeliveries", label: t("tabs.siteDeliveries"), icon: MapPinned },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-[var(--color-text)]">{t("title")}</h1>
        <p className="text-[var(--color-text-secondary)] mt-1">{t("subtitle")}</p>
      </div>
      {err ? <p className="text-sm text-[var(--color-danger)]">{err}</p> : null}

      <div role="tablist" className="inline-flex flex-wrap gap-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-1">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              tab === key
                ? "bg-[var(--color-mint)] text-[var(--color-mint-dark)]"
                : "text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
            }`}
          >
            <Icon size={15} aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>

      {!tenant ? null : tab === "calendar" ? (
        <CalendarTab tenantId={tenant._id} onError={showError} />
      ) : tab === "suppliers" ? (
        <SuppliersTab tenantId={tenant._id} onError={showError} />
      ) : tab === "carriers" ? (
        <CarriersTab tenantId={tenant._id} onError={showError} />
      ) : tab === "inventory" ? (
        <InventoryTab tenantId={tenant._id} />
      ) : (
        <SiteDeliveriesTab tenantId={tenant._id} onError={showError} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Calendar
// ---------------------------------------------------------------------------

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function addMonths(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}
function sameDay(a: number, b: Date) {
  const da = new Date(a);
  return da.getFullYear() === b.getFullYear() && da.getMonth() === b.getMonth() && da.getDate() === b.getDate();
}

function CalendarTab({ tenantId, onError }: { tenantId: Id<"tenants">; onError: (e: unknown) => void }) {
  const t = useTranslations("logistics.calendar");
  const format = useFormatter();
  const locale = useLocale();
  // Monday-first localized weekday abbreviations (2026-01-05 is a Monday).
  const weekdayLabels = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(locale, { weekday: "short" });
    return Array.from({ length: 7 }, (_, i) => fmt.format(new Date(2026, 0, 5 + i)));
  }, [locale]);
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  // Read once per mount (lazy initializer), not inline in the render body —
  // Date.now() there is an impure call the React Compiler flags as an error.
  const [now] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);

  const from = month.getTime();
  const to = addMonths(month, 1).getTime();
  const deliveries = useQuery(api.logistics.listDeliveries, { tenantId, from, to });
  const suppliers = useQuery(api.logistics.listLogisticsSuppliers, { tenantId });
  const carriers = useQuery(api.logistics.listCarriers, { tenantId });
  const markReceived = useMutation(api.logistics.markDeliveryReceived);
  const removeDelivery = useMutation(api.logistics.deleteDelivery);
  const createDelivery = useMutation(api.logistics.createDelivery);

  const byDay = useMemo(() => {
    const map = new Map<number, Delivery[]>();
    for (const d of deliveries ?? []) {
      const day = new Date(d.scheduledDate);
      const key = new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime();
      map.set(key, [...(map.get(key) ?? []), d]);
    }
    return map;
  }, [deliveries]);

  // Monday-first 6-week grid covering the whole month.
  const gridStart = useMemo(() => {
    const first = new Date(month);
    const dow = (first.getDay() + 6) % 7; // 0 = Monday
    first.setDate(first.getDate() - dow);
    return first;
  }, [month]);
  const cells = useMemo(() => Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    return d;
  }), [gridStart]);

  const selectedDeliveries: Delivery[] = selectedDay
    ? (byDay.get(new Date(selectedDay.getFullYear(), selectedDay.getMonth(), selectedDay.getDate()).getTime()) ?? [])
    : [];

  async function handleMarkReceived(delivery: Delivery) {
    if (!(await requestConfirm(t("markReceivedConfirm")))) return;
    setBusy(true);
    try {
      await markReceived({ deliveryId: delivery._id });
    } catch (e) {
      onError(e);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(delivery: Delivery) {
    if (!(await requestConfirm(t("deleteConfirm"), { danger: true }))) return;
    setBusy(true);
    try {
      await removeDelivery({ deliveryId: delivery._id });
    } catch (e) {
      onError(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setMonth((m) => addMonths(m, -1))} className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text)] hover:bg-[var(--color-bg-alt)]">
            ←
          </button>
          <p className="min-w-[10rem] text-center font-semibold text-[var(--color-text)] capitalize">
            {format.dateTime(month, { month: "long", year: "numeric" })}
          </p>
          <button type="button" onClick={() => setMonth((m) => addMonths(m, 1))} className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text)] hover:bg-[var(--color-bg-alt)]">
            →
          </button>
        </div>
        <button
          type="button"
          disabled={!suppliers || suppliers.length === 0}
          onClick={() => setFormOpen(true)}
          title={suppliers && suppliers.length === 0 ? t("noSupplier") : undefined}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-mint)] px-4 py-2 text-sm font-semibold text-[var(--color-mint-dark)] disabled:opacity-50"
        >
          <Plus size={16} aria-hidden="true" />
          {t("newDelivery")}
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-3">
        <div className="grid min-w-[640px] grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase text-[var(--color-text-secondary)]">
          {weekdayLabels.map((d, i) => (
            <div key={i} className="py-1">{d}</div>
          ))}
        </div>
        <div className="grid min-w-[640px] grid-cols-7 gap-1">
          {cells.map((d, i) => {
            const key = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
            const dayDeliveries = byDay.get(key) ?? [];
            const inMonth = d.getMonth() === month.getMonth();
            const isSelected = selectedDay && sameDay(key, selectedDay);
            const isToday = sameDay(now, d);
            return (
              <button
                key={i}
                type="button"
                onClick={() => setSelectedDay(d)}
                className={`flex min-h-[64px] flex-col items-start rounded-lg border p-1.5 text-left text-xs transition-colors ${
                  isSelected ? "border-[var(--color-mint)] bg-[var(--color-mint)]/10" : "border-transparent hover:bg-[var(--color-bg)]"
                } ${inMonth ? "text-[var(--color-text)]" : "text-[var(--color-text-secondary)] opacity-50"}`}
              >
                <span className={`font-medium ${isToday ? "rounded-full bg-[var(--color-mint)] px-1.5 text-[var(--color-mint-dark)]" : ""}`}>
                  {d.getDate()}
                </span>
                {dayDeliveries.length > 0 ? (
                  <span className="mt-1 rounded-full bg-[var(--color-mint)]/20 px-1.5 py-0.5 text-[10px] font-semibold text-[var(--color-mint-dark)]">
                    {dayDeliveries.length}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-4">
        {!selectedDay ? (
          <p className="text-sm text-[var(--color-text-secondary)]">{t("selectDay")}</p>
        ) : (
          <>
            <p className="mb-3 font-semibold text-[var(--color-text)] capitalize">
              {format.dateTime(selectedDay, { weekday: "long", day: "numeric", month: "long" })}
            </p>
            {selectedDeliveries.length === 0 ? (
              <p className="text-sm text-[var(--color-text-secondary)]">{t("noDeliveriesDay")}</p>
            ) : (
              <ul className="space-y-2">
                {selectedDeliveries.map((d) => {
                  const supplier = suppliers?.find((s) => s._id === d.supplierId);
                  const carrier = carriers?.find((c) => c._id === d.carrierId);
                  return (
                    <li key={d._id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-3 text-sm">
                      <div>
                        <p className="font-medium text-[var(--color-text)]">{supplier?.name ?? "—"}</p>
                        <p className="text-xs text-[var(--color-text-secondary)]">
                          {carrier ? `${t("carrier")}: ${carrier.name} · ` : ""}
                          {d.driverName ? `${t("driver")}: ${d.driverName} · ` : ""}
                          {t(`status.${d.status}`)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {d.status !== "received" && d.status !== "cancelled" ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => handleMarkReceived(d)}
                            className="rounded-lg bg-[var(--color-mint)] px-3 py-1.5 text-xs font-semibold text-[var(--color-mint-dark)] disabled:opacity-50"
                          >
                            {t("markReceived")}
                          </button>
                        ) : null}
                        {d.status !== "received" ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => handleDelete(d)}
                            aria-label={t("delete")}
                            className="rounded-lg border border-[var(--color-border)] p-1.5 text-[var(--color-danger)] hover:bg-[var(--color-bg-alt)] disabled:opacity-50"
                          >
                            <Trash2 size={14} aria-hidden="true" />
                          </button>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </div>

      {formOpen && suppliers && suppliers.length > 0 ? (
        <NewDeliveryModal
          tenantId={tenantId}
          suppliers={suppliers}
          carriers={carriers ?? []}
          defaultDate={selectedDay ?? new Date()}
          onClose={() => setFormOpen(false)}
          onSave={async (data) => {
            try {
              await createDelivery(data);
              setFormOpen(false);
            } catch (e) {
              onError(e);
            }
          }}
        />
      ) : null}
    </div>
  );
}

function NewDeliveryModal({
  tenantId,
  suppliers,
  carriers,
  defaultDate,
  onClose,
  onSave,
}: {
  tenantId: Id<"tenants">;
  suppliers: Doc<"logisticsSuppliers">[];
  carriers: Doc<"carriers">[];
  defaultDate: Date;
  onClose: () => void;
  onSave: (data: {
    tenantId: Id<"tenants">;
    supplierId: Id<"logisticsSuppliers">;
    carrierId?: Id<"carriers">;
    driverName?: string;
    driverPhone?: string;
    scheduledDate: number;
    notes?: string;
    expectedItems?: string[];
  }) => void;
}) {
  const t = useTranslations("logistics.calendar");
  const [supplierId, setSupplierId] = useState<string>(suppliers[0]._id);
  const [carrierId, setCarrierId] = useState<string>("");
  const [driverName, setDriverName] = useState("");
  const [driverPhone, setDriverPhone] = useState("");
  const [date, setDate] = useState(() => defaultDate.toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState("");
  const [saving, setSaving] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-xl bg-[var(--color-bg)] shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-[var(--color-border)] p-4">
          <h2 className="text-lg font-semibold text-[var(--color-text)]">{t("newDelivery")}</h2>
        </div>
        <div className="max-h-[70vh] space-y-3 overflow-y-auto p-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--color-text-secondary)]">{t("supplier")}</label>
            <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)]">
              {suppliers.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--color-text-secondary)]">{t("carrier")}</label>
            <select value={carrierId} onChange={(e) => setCarrierId(e.target.value)} className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)]">
              <option value="">—</option>
              {carriers.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--color-text-secondary)]">{t("driverName")}</label>
              <input value={driverName} onChange={(e) => setDriverName(e.target.value)} className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)]" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--color-text-secondary)]">{t("driverPhone")}</label>
              <input value={driverPhone} onChange={(e) => setDriverPhone(e.target.value)} className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)]" />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--color-text-secondary)]">{t("scheduledDate")}</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)]" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--color-text-secondary)]">{t("expectedItems")}</label>
            <textarea value={items} onChange={(e) => setItems(e.target.value)} rows={3} className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)]" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--color-text-secondary)]">{t("notes")}</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)]" />
          </div>
        </div>
        <div className="flex justify-end gap-3 border-t border-[var(--color-border)] p-4">
          <button type="button" onClick={onClose} className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-text)]">
            {t("cancel")}
          </button>
          <button
            type="button"
            disabled={saving || !date}
            onClick={() => {
              setSaving(true);
              onSave({
                tenantId,
                supplierId: supplierId as Id<"logisticsSuppliers">,
                carrierId: carrierId ? (carrierId as Id<"carriers">) : undefined,
                driverName: driverName || undefined,
                driverPhone: driverPhone || undefined,
                scheduledDate: new Date(date).getTime(),
                notes: notes || undefined,
                expectedItems: items.split("\n").map((s) => s.trim()).filter(Boolean),
              });
            }}
            className="rounded-lg bg-[var(--color-mint)] px-4 py-2 text-sm font-semibold text-[var(--color-mint-dark)] disabled:opacity-50"
          >
            {saving ? "…" : t("save")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Suppliers
// ---------------------------------------------------------------------------

function SuppliersTab({ tenantId, onError }: { tenantId: Id<"tenants">; onError: (e: unknown) => void }) {
  const t = useTranslations("logistics.suppliers");
  const suppliers = useQuery(api.logistics.listLogisticsSuppliers, { tenantId });
  const create = useMutation(api.logistics.createLogisticsSupplier);
  const remove = useMutation(api.logistics.deleteLogisticsSupplier);
  const [form, setForm] = useState(false);

  return (
    <ContactDirectory
      title={t("add")}
      items={suppliers}
      renderRow={(s: Doc<"logisticsSuppliers">) => (
        <ContactRow key={s._id} name={s.name} contact={s.contactName} phone={s.phone} email={s.email} onDelete={async () => {
          if (!(await requestConfirm(t("deleteConfirm"), { danger: true }))) return;
          try {
            await remove({ supplierId: s._id });
          } catch (e) {
            onError(e);
          }
        }} />
      )}
      empty={t("empty")}
      formOpen={form}
      onOpenForm={() => setForm(true)}
      onCloseForm={() => setForm(false)}
      addLabel={t("add")}
      onSubmit={async (fields) => {
        try {
          await create({ tenantId, ...fields });
          setForm(false);
        } catch (e) {
          onError(e);
        }
      }}
      fieldsConfig={[
        { key: "name", label: t("name"), required: true },
        { key: "contactName", label: t("contact") },
        { key: "phone", label: t("phone") },
        { key: "email", label: t("email") },
        { key: "address", label: t("address") },
        { key: "notes", label: t("notes") },
      ]}
    />
  );
}

function CarriersTab({ tenantId, onError }: { tenantId: Id<"tenants">; onError: (e: unknown) => void }) {
  const t = useTranslations("logistics.carriers");
  const carriers = useQuery(api.logistics.listCarriers, { tenantId });
  const create = useMutation(api.logistics.createCarrier);
  const remove = useMutation(api.logistics.deleteCarrier);
  const [form, setForm] = useState(false);

  return (
    <ContactDirectory
      title={t("add")}
      items={carriers}
      renderRow={(c: Doc<"carriers">) => (
        <ContactRow key={c._id} name={c.name} contact={c.contactName} phone={c.phone} email={c.email} onDelete={async () => {
          if (!(await requestConfirm(t("deleteConfirm"), { danger: true }))) return;
          try {
            await remove({ carrierId: c._id });
          } catch (e) {
            onError(e);
          }
        }} />
      )}
      empty={t("empty")}
      formOpen={form}
      onOpenForm={() => setForm(true)}
      onCloseForm={() => setForm(false)}
      addLabel={t("add")}
      onSubmit={async (fields) => {
        try {
          await create({ tenantId, ...fields });
          setForm(false);
        } catch (e) {
          onError(e);
        }
      }}
      fieldsConfig={[
        { key: "name", label: t("name"), required: true },
        { key: "contactName", label: t("contact") },
        { key: "phone", label: t("phone") },
        { key: "email", label: t("email") },
        { key: "notes", label: t("notes") },
      ]}
    />
  );
}

interface FieldConfig {
  key: string;
  label: string;
  required?: boolean;
}

function ContactDirectory<T>({
  items,
  renderRow,
  empty,
  formOpen,
  onOpenForm,
  onCloseForm,
  addLabel,
  onSubmit,
  fieldsConfig,
}: {
  title: string;
  items: T[] | undefined;
  renderRow: (item: T) => React.ReactNode;
  empty: string;
  formOpen: boolean;
  onOpenForm: () => void;
  onCloseForm: () => void;
  addLabel: string;
  onSubmit: (fields: { name: string } & Record<string, string | undefined>) => void;
  fieldsConfig: FieldConfig[];
}) {
  const [values, setValues] = useState<Record<string, string>>({});

  if (items === undefined) {
    return <div className="h-24 animate-pulse rounded-xl bg-[var(--color-bg-alt)]" />;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button type="button" onClick={onOpenForm} className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-mint)] px-4 py-2 text-sm font-semibold text-[var(--color-mint-dark)]">
          <Plus size={16} aria-hidden="true" />
          {addLabel}
        </button>
      </div>

      {formOpen ? (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {fieldsConfig.map((f) => (
              <div key={f.key}>
                <label className="mb-1 block text-sm font-medium text-[var(--color-text-secondary)]">{f.label}</label>
                <input
                  value={values[f.key] ?? ""}
                  onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                  className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)]"
                />
              </div>
            ))}
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <button type="button" onClick={onCloseForm} className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-text)]">
              ×
            </button>
            <button
              type="button"
              disabled={!values.name?.trim()}
              onClick={() => {
                if (!values.name?.trim()) return;
                onSubmit({ ...values, name: values.name });
                setValues({});
              }}
              className="rounded-lg bg-[var(--color-mint)] px-4 py-2 text-sm font-semibold text-[var(--color-mint-dark)] disabled:opacity-50"
            >
              {addLabel}
            </button>
          </div>
        </div>
      ) : null}

      {items.length === 0 ? (
        <EmptyState title={empty} />
      ) : (
        <ul className="divide-y divide-[var(--color-border)] rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-alt)]">
          {items.map(renderRow)}
        </ul>
      )}
    </div>
  );
}

function ContactRow({
  name,
  contact,
  phone,
  email,
  onDelete,
}: {
  name: string;
  contact?: string;
  phone?: string;
  email?: string;
  onDelete: () => void;
}) {
  return (
    <li className="flex items-center justify-between gap-3 p-3 text-sm">
      <div>
        <p className="font-medium text-[var(--color-text)]">{name}</p>
        <p className="text-xs text-[var(--color-text-secondary)]">{[contact, phone, email].filter(Boolean).join(" · ") || "—"}</p>
      </div>
      <button type="button" onClick={onDelete} aria-label="delete" className="rounded-lg border border-[var(--color-border)] p-1.5 text-[var(--color-danger)] hover:bg-[var(--color-bg)]">
        <Trash2 size={14} aria-hidden="true" />
      </button>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Inventory
// ---------------------------------------------------------------------------

const STATUS_LABEL_KEY: Record<
  string,
  "statusIn_stock" | "statusAssigned" | "statusIn_transit" | "statusDelivered" | "statusInstalled"
> = {
  in_stock: "statusIn_stock",
  assigned: "statusAssigned",
  in_transit: "statusIn_transit",
  delivered: "statusDelivered",
  installed: "statusInstalled",
};

function InventoryTab({ tenantId }: { tenantId: Id<"tenants"> }) {
  const t = useTranslations("logistics.inventory");
  const format = useFormatter();
  const [status, setStatus] = useState<"in_stock" | "assigned" | "in_transit" | "delivered" | "installed" | "">(
    "",
  );
  const items = useQuery(api.logistics.listInventoryItems, {
    tenantId,
    status: status || undefined,
  });

  return (
    <div className="space-y-4">
      <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)]">
        <option value="">{t("filterAll")}</option>
        <option value="in_stock">{t("statusIn_stock")}</option>
        <option value="assigned">{t("statusAssigned")}</option>
        <option value="in_transit">{t("statusIn_transit")}</option>
        <option value="delivered">{t("statusDelivered")}</option>
        <option value="installed">{t("statusInstalled")}</option>
      </select>
      {/* "In magazzino" (the warehouse-count everyone actually cares about
          day to day) is in_stock + assigned only — once a piece is
          in_transit/delivered/installed it has physically left the
          warehouse, so the default ("all statuses") view still shows it for
          traceability, but it's no longer counted as warehouse stock
          anywhere (see logistics.getLogisticsSummary's itemsInStock, which
          only ever queries the in_stock index). */}

      {items === undefined ? (
        <div className="h-24 animate-pulse rounded-xl bg-[var(--color-bg-alt)]" />
      ) : items.length === 0 ? (
        <EmptyState title={t("empty")} />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-alt)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-left text-xs text-[var(--color-text-secondary)]">
                <th className="p-3">{t("label")}</th>
                <th className="p-3">{t("quantity")}</th>
                <th className="p-3">{t("status")}</th>
                <th className="p-3">{t("received")}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr key={i._id} className="border-b border-[var(--color-border)] last:border-0 text-[var(--color-text)]">
                  <td className="p-3">{i.label}</td>
                  <td className="p-3">{i.quantity} {i.unit}</td>
                  <td className="p-3">
                    <span className="rounded-full bg-[var(--color-mint)]/15 px-2 py-0.5 text-xs font-medium text-[var(--color-mint-dark)]">
                      {STATUS_LABEL_KEY[i.status] ? t(STATUS_LABEL_KEY[i.status]) : i.status}
                    </span>
                  </td>
                  <td className="p-3 text-[var(--color-text-secondary)]">{format.dateTime(new Date(i.receivedAt), { dateStyle: "medium" })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
