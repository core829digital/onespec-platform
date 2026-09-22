"use client";

import { useState, useCallback } from "react";
import posthog from "posthog-js";
import { useQuery, useMutation } from "convex/react";
import { useTranslations, useFormatter } from "next-intl";
import { api } from "@/convex/_generated/api";
import { Link } from "@/i18n/navigation";
import type { Id } from "@/convex/_generated/dataModel";
import {
  Plus,
  Search,
  Filter,
  MapPin,
  Calendar,
  Euro,
  Users,
  MoreVertical,
  Edit,
  Trash2,
  Key,
  X,
  ChevronDown,
  Lock,
  AlertCircle,
  Clock,
  Package,
  CheckCircle,
  Link2,
} from "lucide-react";
import { EmptyState } from "@/components/app-shell/empty-state";
import { useFriendlyError } from "@/lib/use-friendly-error";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { SortableCantiereCard, type SortableCantiereCardProps } from "@/components/cantieri/SortableCantiereCard";

// Module-level constant for current time (updated on each render via useMemo in parent)
export const NOW = Date.now();

const STATUS_CONFIG = [
  { key: "preventivo", label: "Preventivo", color: "bg-blue-100 text-blue-700", icon: MapPin },
  { key: "confermato", label: "Confermato", color: "bg-purple-100 text-purple-700", icon: Package },
  { key: "in_produzione", label: "In Produzione", color: "bg-amber-100 text-amber-700", icon: Clock },
  { key: "pronto_consegna", label: "Pronto Consegna", color: "bg-indigo-100 text-indigo-700", icon: CheckCircle },
  { key: "in_posa", label: "In Posa", color: "bg-orange-100 text-orange-700", icon: Users },
  { key: "collaudo", label: "Collaudo", color: "bg-teal-100 text-teal-700", icon: AlertCircle },
  { key: "chiuso", label: "Chiuso", color: "bg-emerald-100 text-emerald-700", icon: Lock },
] as const;

const PRIORITY_COLORS = {
  low: "bg-gray-100 text-gray-700",
  medium: "bg-blue-100 text-blue-700",
  high: "bg-amber-100 text-amber-700",
  urgent: "bg-red-100 text-red-700",
};

interface Cantiere {
  _id: string;
  name: string;
  status: string;
  address: string;
  postalCode: string;
  city: string;
  country?: string;
  clientId?: string;
  quoteId?: string;
  client?: { name: string } | null;
  valueCents?: number;
  estimatedStartAt?: number;
  estimatedEndAt?: number;
  guestPin?: string;
  assignedUserIds?: string[];
  totalTasks?: number;
  taskCounts?: Record<string, number>;
  priority?: string;
  notes?: string;
}

export type { Cantiere };

function KanbanColumn({
  status,
  cantieri,
  onEdit,
  onDelete,
  onGeneratePin,
  onRevokePin,
  t,
  format,
}: {
  status: string;
  cantieri: Cantiere[];
  onEdit: (c: Cantiere) => void;
  onDelete: (id: string) => void;
  onGeneratePin: (c: Cantiere) => void;
  onRevokePin: (c: Cantiere) => void;
  t: (key: string) => string;
  format: ReturnType<typeof useFormatter>;
}) {
  const config = STATUS_CONFIG.find((s) => s.key === status);

  return (
    <div className="flex-shrink-0 w-80 bg-[var(--color-bg-alt)] rounded-xl p-3 min-h-[500px]">
      <div className="flex items-center justify-between mb-4">
<div className="flex items-center gap-2">
            {config?.icon && <config.icon className="w-5 h-5" />}
            <h3 className="font-semibold text-[var(--color-text)]">{config?.label || status}</h3>
          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--color-bg)] text-[var(--color-text-secondary)]">
            {cantieri.length}
          </span>
        </div>
      </div>
      <SortableContext
        items={cantieri.map((c) => c._id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-3 min-h-[300px]">
          {cantieri.length === 0 ? (
            <div className="text-center text-[var(--color-text-secondary)] py-8 text-sm">
              {t("noItemsInColumn")}
            </div>
          ) : (
            cantieri.map((cantiere, index) => (
              <SortableCantiereCard
                key={cantiere._id}
                cantiere={cantiere}
                onEdit={() => onEdit(cantiere)}
                onDelete={() => onDelete(cantiere._id)}
                onGeneratePin={() => onGeneratePin(cantiere)}
                onRevokePin={() => onRevokePin(cantiere)}
                t={t}
                format={format}
                index={index}
                items={cantieri}
              />
            ))
          )}
        </div>
      </SortableContext>
    </div>
  );
}

function CantiereModal({
  onClose,
  onSubmit,
  cantiere,
  clients,
  quotes,
  users,
  saving,
  t,
}: {
  onClose: () => void;
  onSubmit: (data: {
    name: string;
    address: string;
    city: string;
    postalCode: string;
    country: string;
    clientId?: string;
    quoteId?: string;
    status: "preventivo" | "confermato" | "in_produzione" | "pronto_consegna" | "in_posa" | "collaudo" | "chiuso";
    priority: "low" | "medium" | "high" | "urgent";
    assignedUserIds: string[];
    estimatedStartAt?: number;
    estimatedEndAt?: number;
    valueCents?: number;
    notes: string;
  }) => void;
  cantiere?: Cantiere;
  clients: Cantiere[];
  quotes: Array<{ _id: string; leadName: string; clientId?: string }>;
  users: Cantiere[];
  saving: boolean;
  t: (key: string) => string;
}) {
  const [formData, setFormData] = useState<{
    name: string;
    address: string;
    city: string;
    postalCode: string;
    country: string;
    clientId: string;
    quoteId: string;
    status: "preventivo" | "confermato" | "in_produzione" | "pronto_consegna" | "in_posa" | "collaudo" | "chiuso";
    priority: "low" | "medium" | "high" | "urgent";
    assignedUserIds: string[];
    estimatedStartAt: string;
    estimatedEndAt: string;
    valueCents: string;
    notes: string;
  }>(() =>
    cantiere
      ? {
          name: cantiere.name,
          address: cantiere.address,
          city: cantiere.city,
          postalCode: cantiere.postalCode,
          country: cantiere.country || "IT",
          clientId: cantiere.clientId || "",
          quoteId: cantiere.quoteId || "",
          status: cantiere.status as "preventivo" | "confermato" | "in_produzione" | "pronto_consegna" | "in_posa" | "collaudo" | "chiuso",
          priority: cantiere.priority as "low" | "medium" | "high" | "urgent",
          assignedUserIds: cantiere.assignedUserIds || [],
          estimatedStartAt: cantiere.estimatedStartAt ? new Date(cantiere.estimatedStartAt).toISOString().split("T")[0] : "",
          estimatedEndAt: cantiere.estimatedEndAt ? new Date(cantiere.estimatedEndAt).toISOString().split("T")[0] : "",
          valueCents: cantiere.valueCents ? String(cantiere.valueCents) : "",
          notes: cantiere.notes || "",
        }
      : {
          name: "",
          address: "",
          city: "",
          postalCode: "",
          country: "IT",
          clientId: "",
          quoteId: "",
          status: "preventivo",
          priority: "medium",
          assignedUserIds: [],
          estimatedStartAt: "",
          estimatedEndAt: "",
          valueCents: "",
          notes: "",
        },
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      ...formData,
      clientId: formData.clientId || undefined,
      quoteId: formData.quoteId || undefined,
      assignedUserIds: formData.assignedUserIds.filter(Boolean),
      estimatedStartAt: formData.estimatedStartAt ? new Date(formData.estimatedStartAt).getTime() : undefined,
      estimatedEndAt: formData.estimatedEndAt ? new Date(formData.estimatedEndAt).getTime() : undefined,
      valueCents: formData.valueCents ? parseInt(formData.valueCents, 10) : undefined,
    };
    onSubmit(data);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-xl shadow-xl max-w-xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)] sticky top-0 bg-white z-10">
          <h2 className="text-lg font-semibold">{cantiere ? t("editCantiere") : t("newCantiere")}</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-[var(--color-bg-alt)]">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                {t("name")} *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full rounded-lg border border-[var(--color-border)] bg-transparent px-3 py-2"
                required
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                  {t("address")} *
                </label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full rounded-lg border border-[var(--color-border)] bg-transparent px-3 py-2"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                  {t("city")} *
                </label>
                <input
                  type="text"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  className="w-full rounded-lg border border-[var(--color-border)] bg-transparent px-3 py-2"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                  {t("postalCode")} *
                </label>
                <input
                  type="text"
                  value={formData.postalCode}
                  onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                  className="w-full rounded-lg border border-[var(--color-border)] bg-transparent px-3 py-2"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                  {t("country")}
                </label>
                <input
                  type="text"
                  value={formData.country}
                  onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                  className="w-full rounded-lg border border-[var(--color-border)] bg-transparent px-3 py-2"
                />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                  {t("client")}
                </label>
                <select
                  value={formData.clientId}
                  onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
                  className="w-full rounded-lg border border-[var(--color-border)] bg-transparent px-3 py-2"
                >
                  <option value="">{t("selectClient")}</option>
                  {clients.map((c: { _id: string; name: string }) => (
                    <option key={c._id} value={c._id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                  {t("quote")}
                </label>
                <select
                  value={formData.quoteId}
                  onChange={(e) => setFormData({ ...formData, quoteId: e.target.value })}
                  className="w-full rounded-lg border border-[var(--color-border)] bg-transparent px-3 py-2"
                >
                  <option value="">{t("noQuote")}</option>
                  {quotes
                    .filter((q) => !formData.clientId || q.clientId === formData.clientId || q._id === formData.quoteId)
                    .map((q) => (
                      <option key={q._id} value={q._id}>{q.leadName}</option>
                    ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                  {t("status")}
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as "preventivo" | "confermato" | "in_produzione" | "pronto_consegna" | "in_posa" | "collaudo" | "chiuso" })}
                  className="w-full rounded-lg border border-[var(--color-border)] bg-transparent px-3 py-2"
                >
                  {STATUS_CONFIG.map((s) => (
                    <option key={s.key} value={s.key}>{s.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                  {t("priorityLabel")}
                </label>
                <select
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value as "low" | "medium" | "high" | "urgent" })}
                  className="w-full rounded-lg border border-[var(--color-border)] bg-transparent px-3 py-2"
                >
                  <option value="low">{t("priority.low")}</option>
                  <option value="medium">{t("priority.medium")}</option>
                  <option value="high">{t("priority.high")}</option>
                  <option value="urgent">{t("priority.urgent")}</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                  {t("assignedTo")}
                </label>
                <select
                  value={formData.assignedUserIds.join(",")}
                  onChange={(e) => setFormData({ ...formData, assignedUserIds: e.target.value.split(",").filter(Boolean) })}
                  multiple
                  className="w-full rounded-lg border border-[var(--color-border)] bg-transparent px-3 py-2 min-h-[80px]"
                >
                  {users.map((u: { _id: string; name?: string; email?: string }) => (
                    <option key={u._id} value={u._id}>{u.name || u.email}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                  {t("estimatedStart")}
                </label>
                <input
                  type="date"
                  value={formData.estimatedStartAt}
                  onChange={(e) => setFormData({ ...formData, estimatedStartAt: e.target.value })}
                  className="w-full rounded-lg border border-[var(--color-border)] bg-transparent px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                  {t("estimatedEnd")}
                </label>
                <input
                  type="date"
                  value={formData.estimatedEndAt}
                  onChange={(e) => setFormData({ ...formData, estimatedEndAt: e.target.value })}
                  className="w-full rounded-lg border border-[var(--color-border)] bg-transparent px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                  {t("value")}
                </label>
                <input
                  type="number"
                  value={formData.valueCents}
                  onChange={(e) => setFormData({ ...formData, valueCents: e.target.value })}
                  placeholder="0"
                  className="w-full rounded-lg border border-[var(--color-border)] bg-transparent px-3 py-2"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                {t("notes")}
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                className="w-full rounded-lg border border-[var(--color-border)] bg-transparent px-3 py-2"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-[var(--color-border)] sticky bottom-0 bg-white">
            <button type="button" onClick={onClose} className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm font-medium">
              {t("cancel")}
            </button>
            <button type="submit" disabled={saving} className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-[var(--color-accent-ink)] disabled:opacity-50">
              {saving ? t("saving") : t("save")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function GuestPinModal({
  pin,
  expiresAt,
  onClose,
  format,
  t,
}: {
  pin: string;
  expiresAt: number;
  onClose: () => void;
  format: ReturnType<typeof useFormatter>;
  t: (key: string) => string;
}) {
  const guestUrl = typeof window !== "undefined" ? `${window.location.origin}/k/${pin}` : `/k/${pin}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
        <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)]">
          <h2 className="text-lg font-semibold">{t("guestPinGenerated")}</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-[var(--color-bg-alt)]">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 text-center space-y-4">
          <p className="text-[var(--color-text-secondary)]">{t("sharePinWithCollaborators")}</p>
          <div className="bg-[var(--color-bg-alt)] border border-[var(--color-border)] rounded-xl p-6">
            <div className="text-4xl font-mono font-bold tracking-widest text-[var(--color-accent)]">{pin}</div>
            <p className="text-xs text-[var(--color-text-secondary)] mt-2">{t("validUntil")} {format.dateTime(new Date(expiresAt), { dateStyle: "medium" })}</p>
          </div>
          <div className="bg-[var(--color-bg-alt)] border border-[var(--color-border)] rounded-lg p-4 text-left space-y-2">
            <p className="text-xs font-medium text-[var(--color-text-secondary)]">{t("guestAccessUrl")}</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-[var(--color-bg)] border border-[var(--color-border)] rounded px-3 py-2 text-xs font-mono break-all">{guestUrl}</code>
              <button
                onClick={() => navigator.clipboard?.writeText(guestUrl)}
                className="px-3 py-2 text-xs rounded border border-[var(--color-border)] bg-[var(--color-bg)] hover:bg-[var(--color-bg-alt)] whitespace-nowrap"
              >
                {t("copyLink")}
              </button>
            </div>
          </div>
          <p className="text-xs text-[var(--color-text-secondary)]">{t("pinInstructions")}</p>
          <button onClick={onClose} className="w-full rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-[var(--color-accent-ink)]">
            {t("close")}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CantieriPage() {
  const t = useTranslations("cantieri");
  const tf = useFriendlyError();
  const [actionError, setActionError] = useState("");
  const showError = (e: unknown) => {
    setActionError(tf(e));
    setTimeout(() => setActionError(""), 8000);
  };
  const format = useFormatter();
  const tenant = useQuery(api.tenants.getMyTenant);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCantiere, setEditingCantiere] = useState<Cantiere | null>(null);
  const [pinModal, setPinModal] = useState<{ pin: string; expiresAt: number } | null>(null);
  const [saving, setSaving] = useState(false);

  const cantieri = useQuery(
    api.cantieri.listCantieri,
    tenant ? { tenantId: tenant._id, limit: 200 } : "skip",
  );

  const clients = useQuery(
    api.clients.listClients,
    tenant ? { tenantId: tenant._id, limit: 200 } : "skip",
  );

  const quotes = useQuery(
    api.quotes.listRequests,
    tenant ? { tenantId: tenant._id, limit: 200 } : "skip",
  );

  const users = useQuery(
    api.users.listUsers,
    tenant ? { tenantId: tenant._id } : "skip",
  );

  const createCantiere = useMutation(api.cantieri.createCantiere);
  const updateCantiere = useMutation(api.cantieri.updateCantiere);
  const deleteCantiere = useMutation(api.cantieri.deleteCantiere);
  const generateGuestPin = useMutation(api.cantieri.generateGuestPin);
  const revokeGuestPin = useMutation(api.cantieri.revokeGuestPin);

  const groupedCantieri = useCallback(() => {
    if (!cantieri) return {};
    return STATUS_CONFIG.reduce((acc, s) => {
      acc[s.key] = cantieri.filter((c) => c.status === s.key);
      return acc;
    }, {} as Record<string, Cantiere[]>);
  }, [cantieri]);

  const handleCreate = async (data: {
    name: string;
    address: string;
    city: string;
    postalCode: string;
    country: string;
    clientId?: string;
    quoteId?: string;
    status: "preventivo" | "confermato" | "in_produzione" | "pronto_consegna" | "in_posa" | "collaudo" | "chiuso";
    priority: "low" | "medium" | "high" | "urgent";
    assignedUserIds: string[];
    estimatedStartAt?: number;
    estimatedEndAt?: number;
    valueCents?: number;
    notes: string;
  }) => {
    setSaving(true);
    try {
      await createCantiere({ 
        tenantId: tenant!._id, 
        ...data,
        clientId: data.clientId as unknown as Id<"clients">,
        quoteId: data.quoteId as unknown as Id<"quoteRequests">,
        assignedUserIds: data.assignedUserIds as unknown as Id<"users">[],
      });
      posthog.capture("cantiere_created", {
        initial_status: data.status,
        priority: data.priority,
        has_client: Boolean(data.clientId),
        has_quote: Boolean(data.quoteId),
      });
      setModalOpen(false);
      setEditingCantiere(null);
    } catch (e) {
      posthog.captureException(e);
      showError(e);
    } finally {
      setSaving(false);
    }
  };

const handleUpdate = async (data: {
    name: string;
    address: string;
    city: string;
    postalCode: string;
    country: string;
    clientId?: string;
    quoteId?: string;
    status: "preventivo" | "confermato" | "in_produzione" | "pronto_consegna" | "in_posa" | "collaudo" | "chiuso";
    priority: "low" | "medium" | "high" | "urgent";
    assignedUserIds: string[];
    estimatedStartAt?: number;
    estimatedEndAt?: number;
    valueCents?: number;
    notes: string;
  }) => {
    if (!editingCantiere) return;
    setSaving(true);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
try {
      await updateCantiere({ 
        cantiereId: editingCantiere._id as Id<"cantieri">, // eslint-disable-line @typescript-eslint/no-explicit-any
        ...data,
        clientId: data.clientId as Id<"clients">, // eslint-disable-line @typescript-eslint/no-explicit-any
        quoteId: data.quoteId as Id<"quoteRequests">, // eslint-disable-line @typescript-eslint/no-explicit-any
        assignedUserIds: data.assignedUserIds as unknown as Id<"users">[], // eslint-disable-line @typescript-eslint/no-explicit-any
      });
      setModalOpen(false);
      setEditingCantiere(null);
    } catch (e) {
      showError(e);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (cantiereId: string) => {
    if (!confirm(t("confirmDelete"))) return;
    try {
      await deleteCantiere({ cantiereId: cantiereId as unknown as Id<"cantieri"> });
    } catch (e) {
      showError(e);
    }
  };

  const handleGeneratePin = async (cantiere: Cantiere) => {
    try {
      const result = await generateGuestPin({ cantiereId: cantiere._id as unknown as Id<"cantieri">, expiresInDays: 30 });
      setPinModal({ pin: result.pin, expiresAt: result.expiresAt });
    } catch (e) {
      showError(e);
    }
  };

  const handleRevokePin = async (cantiere: Cantiere) => {
    if (!confirm(t("confirmRevokePin"))) return;
    try {
      await revokeGuestPin({ cantiereId: cantiere._id as unknown as Id<"cantieri"> });
    } catch (e) {
      showError(e);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const cantiereId = active.id as string;
    const newStatus = over.id as (typeof STATUS_CONFIG)[number]["key"];

    const cantiere = cantieri?.find((c) => c._id === cantiereId);
    if (!cantiere || cantiere.status === newStatus) return;

    try {
      await updateCantiere({ cantiereId: cantiereId as Id<"cantieri">, status: newStatus });
      posthog.capture("cantiere_status_changed", {
        cantiere_id: cantiereId,
        previous_status: cantiere.status,
        new_status: newStatus,
      });
    } catch (e) {
      posthog.captureException(e);
      showError(e);
    }
  };

  const openEditModal = (cantiere: Cantiere) => {
    setEditingCantiere(cantiere);
    setModalOpen(true);
  };

  const openNewModal = () => {
    setEditingCantiere(null);
    setModalOpen(true);
  };

  const columns = STATUS_CONFIG.map((s) => ({
    status: s.key,
    cantieri: groupedCantieri()[s.key] || [],
  }));

  return (
    <div className="w-full space-y-6">
      {actionError ? (
        <div
          role="alert"
          className="fixed left-1/2 top-4 z-[100] flex max-w-[90vw] -translate-x-1/2 items-start gap-3 rounded-lg border border-[var(--color-danger)] bg-[var(--color-bg)] px-4 py-3 text-sm text-[var(--color-danger)] shadow-lg"
        >
          <span>{actionError}</span>
          <button type="button" onClick={() => setActionError("")} aria-label="Close" className="font-bold leading-none">
            ×
          </button>
        </div>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[var(--color-text)]">{t("title")}</h1>
          <p className="text-[var(--color-text-secondary)] mt-1">{t("subtitle")}</p>
        </div>
        <button onClick={openNewModal} className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-[var(--color-accent-ink)] flex items-center gap-2">
          <Plus className="w-4 h-4" />
          {t("newCantiere")}
        </button>
      </div>

      <div className="flex gap-4 bg-[var(--color-bg-alt)] border border-[var(--color-border)] rounded-xl p-4 overflow-x-auto">
        <div className="relative min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-secondary)]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-[var(--color-border)] bg-white text-[var(--color-text)] placeholder-[var(--color-text-secondary)]"
          />
        </div>
      </div>

      <div className="overflow-x-auto pb-4">
        <DndContext
          sensors={useSensors(
            useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
            useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
          )}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-3 min-w-max">
            {columns.map((col) => (
            <KanbanColumn
              key={col.status}
              status={col.status}
              cantieri={col.cantieri}
              onEdit={openEditModal}
              onDelete={handleDelete}
              onGeneratePin={handleGeneratePin}
              onRevokePin={handleRevokePin}
              t={t}
              format={format}
            />
          ))}
        </div>
      </DndContext>
    </div>

      {modalOpen ? (
        <CantiereModal
          onClose={() => { setModalOpen(false); setEditingCantiere(null); }}
          onSubmit={editingCantiere ? handleUpdate : handleCreate}
          cantiere={editingCantiere ?? undefined}
          clients={(clients || []) as unknown as Cantiere[]}
          quotes={(quotes || []) as unknown as Array<{ _id: string; leadName: string; clientId?: string }>}
          users={(users || []) as unknown as Cantiere[]}
          saving={saving}
          t={t}
        />
      ) : null}

      {pinModal && (
        <GuestPinModal
          pin={pinModal.pin}
          expiresAt={pinModal.expiresAt}
          onClose={() => setPinModal(null)}
          format={format}
          t={t}
        />
      )}
    </div>
  );
}