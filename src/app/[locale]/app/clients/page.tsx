"use client";

import { useState, useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import { useTranslations, useFormatter } from "next-intl";
import { api } from "@/convex/_generated/api";
import { Link } from "@/i18n/navigation";
import type { Id } from "@/convex/_generated/dataModel";
import {
  Plus,
  Search,
  Filter,
  User,
  Building,
  Mail,
  Phone,
  MapPin,
  Tag,
  MoreVertical,
  Edit,
  Trash2,
  Activity,
  ArrowUpRight,
  X,
  ChevronDown,
} from "lucide-react";
import { EmptyState } from "@/components/app-shell/empty-state";
import { useFriendlyError } from "@/lib/use-friendly-error";

const STATUS_LABELS = {
  lead: "Lead",
  prospect: "Prospect",
  active: "Attivo",
  inactive: "Inattivo",
  lost: "Perso",
} as const;

const TYPE_LABELS = {
  private: "Privato",
  company: "Azienda",
  developer: "Costruttore",
  architect: "Architetto",
  contractor: "Impresa",
} as const;

const STATUS_COLORS = {
  lead: "bg-blue-100 text-blue-700",
  prospect: "bg-amber-100 text-amber-700",
  active: "bg-emerald-100 text-emerald-700",
  inactive: "bg-gray-100 text-gray-700",
  lost: "bg-red-100 text-red-700",
};

function ClientRow({
  client,
  onEdit,
  onDelete,
  format,
  t,
}: {
  client: {
    _id: string;
    name: string;
    contactName?: string;
    email?: string;
    phone?: string;
    status: string;
    type: string;
    tags?: string[];
    updatedAt: number;
  };
  onEdit: () => void;
  onDelete: () => void;
  format: ReturnType<typeof useFormatter>;
  t: (key: string) => string;
}) {
  return (
    <tr className="border-t border-[var(--color-border)] hover:bg-[var(--color-bg-alt)] transition-colors">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
            client.type === "company" || client.type === "developer"
              ? "bg-blue-100 text-blue-700"
              : client.type === "architect"
              ? "bg-purple-100 text-purple-700"
              : client.type === "contractor"
              ? "bg-orange-100 text-orange-700"
              : "bg-gray-100 text-gray-700"
          }`}>
            {client.type === "company" || client.type === "developer" ? (
              <Building className="w-5 h-5" />
            ) : client.type === "architect" ? (
              <User className="w-5 h-5" />
            ) : client.type === "contractor" ? (
              <MapPin className="w-5 h-5" />
            ) : (
              <User className="w-5 h-5" />
            )}
          </div>
          <div>
            <Link
              href={`/app/clients/${client._id}`}
              className="font-medium text-[var(--color-text)] hover:text-[var(--color-mint)] hover:underline"
            >
              {client.name}
            </Link>
            {client.contactName && (
              <p className="text-sm text-[var(--color-text-secondary)]">{client.contactName}</p>
            )}
          </div>
        </div>
      </td>
      <td className="px-4 py-3 hidden md:table-cell">
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[client.status as keyof typeof STATUS_COLORS] || "bg-gray-100 text-gray-700"}`}>
          {STATUS_LABELS[client.status as keyof typeof STATUS_LABELS] || client.status}
        </span>
      </td>
      <td className="px-4 py-3 hidden lg:table-cell">
        <span className="text-sm text-[var(--color-text-secondary)]">
          {TYPE_LABELS[client.type as keyof typeof TYPE_LABELS] || client.type}
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="space-y-1 text-sm">
          {client.email && (
            <div className="flex items-center gap-1 text-[var(--color-text-secondary)]">
              <Mail className="w-3.5 h-3.5" />
              <span>{client.email}</span>
            </div>
          )}
          {client.phone && (
            <div className="flex items-center gap-1 text-[var(--color-text-secondary)]">
              <Phone className="w-3.5 h-3.5" />
              <span>{client.phone}</span>
            </div>
          )}
        </div>
      </td>
      <td className="px-4 py-3 hidden xl:table-cell">
        <div className="flex flex-wrap gap-1">
          {(client.tags || []).slice(0, 3).map((tag: string, i: number) => (
            <span key={i} className="inline-flex items-center px-2 py-0.5 rounded text-xs text-[var(--color-text-secondary)] bg-[var(--color-bg-alt)] border border-[var(--color-border)]">
              {tag}
            </span>
          ))}
          {(client.tags || []).length > 3 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs text-[var(--color-text-secondary)] bg-[var(--color-bg-alt)] border border-[var(--color-border)]">
              +{(client.tags || []).length - 3}
            </span>
          )}
        </div>
      </td>
      <td className="px-4 py-3 text-right text-[var(--color-text-secondary)]">
        {format.dateTime(new Date(client.updatedAt), { dateStyle: "short" })}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={onEdit}
            className="p-2 rounded-lg hover:bg-[var(--color-bg-alt)] text-[var(--color-text-secondary)] transition-colors"
            title={t("edit")}
          >
            <Edit className="w-4 h-4" />
          </button>
          <button
            onClick={onDelete}
            className="p-2 rounded-lg hover:bg-red-50 text-red-500 transition-colors"
            title={t("delete")}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}

function ClientModal({
  isOpen,
  onClose,
  onSubmit,
  client,
  saving,
  t,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    name: string;
    contactName: string;
    email: string;
    phone: string;
    billingAddress: string;
    billingCity: string;
    billingPostalCode: string;
    billingCountry: string;
    siteAddress: string;
    siteCity: string;
    sitePostalCode: string;
    siteCountry: string;
    vatNumber: string;
    fiscalCode: string;
    type: "private" | "company" | "developer" | "architect" | "contractor";
    tags: string;
    source: string;
    notes: string;
    assignedToUserId?: string;
    status: "lead" | "prospect" | "active" | "inactive" | "lost";
  }) => void;
  client?: {
    _id: string;
    name: string;
    contactName?: string;
    email?: string;
    phone?: string;
    billingAddress?: string;
    billingCity?: string;
    billingPostalCode?: string;
    billingCountry?: string;
    siteAddress?: string;
    siteCity?: string;
    sitePostalCode?: string;
    siteCountry?: string;
    vatNumber?: string;
    fiscalCode?: string;
    type: string;
    tags?: string[];
    source?: string;
    notes?: string;
    assignedToUserId?: string;
    status: string;
  };
  saving: boolean;
  t: (key: string) => string;
}) {
  const [formData, setFormData] = useState<{
    name: string;
    contactName: string;
    email: string;
    phone: string;
    billingAddress: string;
    billingCity: string;
    billingPostalCode: string;
    billingCountry: string;
    siteAddress: string;
    siteCity: string;
    sitePostalCode: string;
    siteCountry: string;
    vatNumber: string;
    fiscalCode: string;
    type: string;
    tags: string;
    source: string;
    notes: string;
    assignedToUserId: string;
    status: string;
  }>({
    name: "",
    contactName: "",
    email: "",
    phone: "",
    billingAddress: "",
    billingCity: "",
    billingPostalCode: "",
    billingCountry: "IT",
    siteAddress: "",
    siteCity: "",
    sitePostalCode: "",
    siteCountry: "IT",
    vatNumber: "",
    fiscalCode: "",
    type: "private",
    tags: "",
    source: "",
    notes: "",
    assignedToUserId: "",
    status: "lead",
  });

  if (client) {
    setFormData({
      name: client.name,
      contactName: client.contactName || "",
      email: client.email || "",
      phone: client.phone || "",
      billingAddress: client.billingAddress || "",
      billingCity: client.billingCity || "",
      billingPostalCode: client.billingPostalCode || "",
      billingCountry: client.billingCountry || "IT",
      siteAddress: client.siteAddress || "",
      siteCity: client.siteCity || "",
      sitePostalCode: client.sitePostalCode || "",
      siteCountry: client.siteCountry || "IT",
      vatNumber: client.vatNumber || "",
      fiscalCode: client.fiscalCode || "",
      type: client.type,
      tags: (client.tags || []).join(", "),
      source: client.source || "",
      notes: client.notes || "",
      assignedToUserId: client.assignedToUserId || "",
      status: client.status,
    });
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      ...formData,
      tags: formData.tags,
      assignedToUserId: formData.assignedToUserId || undefined,
      type: formData.type as "private" | "company" | "developer" | "architect" | "contractor",
      status: formData.status as "lead" | "prospect" | "active" | "inactive" | "lost",
    };
    onSubmit(data);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)] sticky top-0 bg-white z-10">
          <h2 className="text-lg font-semibold">{client ? t("editClient") : t("newClient")}</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-[var(--color-bg-alt)]">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
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
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                {t("contactName")}
              </label>
              <input
                type="text"
                value={formData.contactName}
                onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                className="w-full rounded-lg border border-[var(--color-border)] bg-transparent px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                {t("type")}
              </label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                className="w-full rounded-lg border border-[var(--color-border)] bg-transparent px-3 py-2"
              >
                <option value="private">{TYPE_LABELS.private}</option>
                <option value="company">{TYPE_LABELS.company}</option>
                <option value="developer">{TYPE_LABELS.developer}</option>
                <option value="architect">{TYPE_LABELS.architect}</option>
                <option value="contractor">{TYPE_LABELS.contractor}</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                {t("status")}
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full rounded-lg border border-[var(--color-border)] bg-transparent px-3 py-2"
              >
                <option value="lead">{STATUS_LABELS.lead}</option>
                <option value="prospect">{STATUS_LABELS.prospect}</option>
                <option value="active">{STATUS_LABELS.active}</option>
                <option value="inactive">{STATUS_LABELS.inactive}</option>
                <option value="lost">{STATUS_LABELS.lost}</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                {t("email")}
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full rounded-lg border border-[var(--color-border)] bg-transparent px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                {t("phone")}
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full rounded-lg border border-[var(--color-border)] bg-transparent px-3 py-2"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                {t("billingAddress")}
              </label>
              <input
                type="text"
                value={formData.billingAddress}
                onChange={(e) => setFormData({ ...formData, billingAddress: e.target.value })}
                className="w-full rounded-lg border border-[var(--color-border)] bg-transparent px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                {t("billingCity")}
              </label>
              <input
                type="text"
                value={formData.billingCity}
                onChange={(e) => setFormData({ ...formData, billingCity: e.target.value })}
                className="w-full rounded-lg border border-[var(--color-border)] bg-transparent px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                {t("billingPostalCode")}
              </label>
              <input
                type="text"
                value={formData.billingPostalCode}
                onChange={(e) => setFormData({ ...formData, billingPostalCode: e.target.value })}
                className="w-full rounded-lg border border-[var(--color-border)] bg-transparent px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                {t("billingCountry")}
              </label>
              <input
                type="text"
                value={formData.billingCountry}
                onChange={(e) => setFormData({ ...formData, billingCountry: e.target.value })}
                className="w-full rounded-lg border border-[var(--color-border)] bg-transparent px-3 py-2"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                {t("siteAddress")}
              </label>
              <input
                type="text"
                value={formData.siteAddress}
                onChange={(e) => setFormData({ ...formData, siteAddress: e.target.value })}
                className="w-full rounded-lg border border-[var(--color-border)] bg-transparent px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                {t("siteCity")}
              </label>
              <input
                type="text"
                value={formData.siteCity}
                onChange={(e) => setFormData({ ...formData, siteCity: e.target.value })}
                className="w-full rounded-lg border border-[var(--color-border)] bg-transparent px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                {t("sitePostalCode")}
              </label>
              <input
                type="text"
                value={formData.sitePostalCode}
                onChange={(e) => setFormData({ ...formData, sitePostalCode: e.target.value })}
                className="w-full rounded-lg border border-[var(--color-border)] bg-transparent px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                {t("siteCountry")}
              </label>
              <input
                type="text"
                value={formData.siteCountry}
                onChange={(e) => setFormData({ ...formData, siteCountry: e.target.value })}
                className="w-full rounded-lg border border-[var(--color-border)] bg-transparent px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                {t("vatNumber")}
              </label>
              <input
                type="text"
                value={formData.vatNumber}
                onChange={(e) => setFormData({ ...formData, vatNumber: e.target.value })}
                className="w-full rounded-lg border border-[var(--color-border)] bg-transparent px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                {t("fiscalCode")}
              </label>
              <input
                type="text"
                value={formData.fiscalCode}
                onChange={(e) => setFormData({ ...formData, fiscalCode: e.target.value })}
                className="w-full rounded-lg border border-[var(--color-border)] bg-transparent px-3 py-2"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                {t("tags")}
              </label>
              <input
                type="text"
                value={formData.tags}
                onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                placeholder="tag1, tag2, tag3"
                className="w-full rounded-lg border border-[var(--color-border)] bg-transparent px-3 py-2"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                {t("source")}
              </label>
              <input
                type="text"
                value={formData.source}
                onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                className="w-full rounded-lg border border-[var(--color-border)] bg-transparent px-3 py-2"
              />
            </div>
            <div className="md:col-span-2">
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
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm font-medium"
            >
              {t("cancel")}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-[var(--color-accent-ink)] disabled:opacity-50"
            >
              {saving ? t("saving") : t("save")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ClientsPage() {
  const t = useTranslations("clients");
  const tf = useFriendlyError();
  const [actionError, setActionError] = useState("");
  const showError = (e: unknown) => {
    setActionError(tf(e));
    setTimeout(() => setActionError(""), 8000);
  };
  const format = useFormatter();
  const tenant = useQuery(api.tenants.getMyTenant);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [modalOpen, setModalOpen] = useState(false);
const [editingClient, setEditingClient] = useState<
  | {
      _id: string;
      name: string;
      contactName?: string;
      email?: string;
      phone?: string;
      billingAddress?: string;
      billingCity?: string;
      billingPostalCode?: string;
      billingCountry?: string;
      siteAddress?: string;
      siteCity?: string;
      sitePostalCode?: string;
      siteCountry?: string;
      vatNumber?: string;
      fiscalCode?: string;
      type: "private" | "company" | "developer" | "architect" | "contractor";
      tags?: string[];
      source?: string;
      notes?: string;
      assignedToUserId?: string;
      status: "lead" | "prospect" | "active" | "inactive" | "lost";
    }
  | undefined>(undefined);
  const [saving, setSaving] = useState(false);

  const clients = useQuery(
    api.clients.listClients,
    tenant ? { 
      tenantId: tenant._id, 
      status: statusFilter !== "all" ? statusFilter as "lead" | "prospect" | "active" | "inactive" | "lost" : undefined, 
      search: search || undefined 
    } : "skip",
  );

  const createClient = useMutation(api.clients.createClient);
  const updateClient = useMutation(api.clients.updateClient);
  const deleteClient = useMutation(api.clients.deleteClient);

  const handleCreate = async (data: {
    name: string;
    contactName: string;
    email: string;
    phone: string;
    billingAddress: string;
    billingCity: string;
    billingPostalCode: string;
    billingCountry: string;
    siteAddress: string;
    siteCity: string;
    sitePostalCode: string;
    siteCountry: string;
    vatNumber: string;
    fiscalCode: string;
    type: string;
    tags: string;
    source: string;
    notes: string;
    assignedToUserId?: string;
    status: string;
  }) => {
    setSaving(true);
    try {
      await createClient({ 
        tenantId: tenant!._id, 
        ...data, 
        tags: data.tags.split(",").map((t) => t.trim()).filter(Boolean),
        type: data.type as "private" | "company" | "developer" | "architect" | "contractor",
        status: data.status as "lead" | "prospect" | "active" | "inactive" | "lost",
        assignedToUserId: data.assignedToUserId as Id<"users"> | undefined,
      });
      setModalOpen(false);
      setEditingClient(undefined);
    } catch (e) {
      showError(e);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (data: {
    name: string;
    contactName: string;
    email: string;
    phone: string;
    billingAddress: string;
    billingCity: string;
    billingPostalCode: string;
    billingCountry: string;
    siteAddress: string;
    siteCity: string;
    sitePostalCode: string;
    siteCountry: string;
    vatNumber: string;
    fiscalCode: string;
    type: string;
    tags: string;
    source: string;
    notes: string;
    assignedToUserId?: string;
    status: string;
  }) => {
    if (!editingClient) return;
    setSaving(true);
    try {
      await updateClient({
        clientId: editingClient._id as Id<"clients">,
        ...data,
        tags: data.tags.split(",").map((t) => t.trim()).filter(Boolean),
        type: data.type as "private" | "company" | "developer" | "architect" | "contractor",
        status: data.status as "lead" | "prospect" | "active" | "inactive" | "lost",
        assignedToUserId: data.assignedToUserId as Id<"users"> | undefined,
      });
      setModalOpen(false);
      setEditingClient(undefined);
    } catch (e) {
      showError(e);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (clientId: string) => {
    if (!confirm(t("confirmDelete"))) return;
    try {
      await deleteClient({ clientId: clientId as Id<"clients"> });
    } catch (e) {
      showError(e);
    }
  };

  const openEditModal = (client: {
    _id: string;
    name: string;
    contactName?: string;
    email?: string;
    phone?: string;
    billingAddress?: string;
    billingCity?: string;
    billingPostalCode?: string;
    billingCountry?: string;
    siteAddress?: string;
    siteCity?: string;
    sitePostalCode?: string;
    siteCountry?: string;
    vatNumber?: string;
    fiscalCode?: string;
    type: "private" | "company" | "developer" | "architect" | "contractor";
    tags?: string[];
    source?: string;
    notes?: string;
    assignedToUserId?: string;
    status: "lead" | "prospect" | "active" | "inactive" | "lost";
  }) => {
    setEditingClient(client);
    setModalOpen(true);
  };

  const openNewModal = () => {
    setEditingClient(undefined);
    setModalOpen(true);
  };

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
          {t("newClient")}
        </button>
      </div>

      <div className="flex flex-wrap gap-4 bg-[var(--color-bg-alt)] border border-[var(--color-border)] rounded-xl p-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-secondary)]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-[var(--color-border)] bg-white text-[var(--color-text)] placeholder-[var(--color-text-secondary)]"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-secondary)]" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full pl-10 pr-10 py-2 rounded-lg border border-[var(--color-border)] bg-white text-[var(--color-text)] appearance-none"
          >
            <option value="all">{t("allStatus")}</option>
            <option value="lead">{STATUS_LABELS.lead}</option>
            <option value="prospect">{STATUS_LABELS.prospect}</option>
            <option value="active">{STATUS_LABELS.active}</option>
            <option value="inactive">{STATUS_LABELS.inactive}</option>
            <option value="lost">{STATUS_LABELS.lost}</option>
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-secondary)] pointer-events-none" />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-[var(--color-border)]">
        {clients === undefined ? (
          <div className="divide-y divide-[var(--color-border)]">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="px-4 py-4 animate-pulse">
                <div className="h-5 w-48 rounded bg-[var(--color-border)]" />
                <div className="h-4 w-32 rounded bg-[var(--color-border)] mt-2" />
              </div>
            ))}
          </div>
        ) : clients.length === 0 ? (
          <EmptyState title={t("noClients")} hint={t("noClientsHint")} action={
            <button onClick={openNewModal} className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-[var(--color-accent-ink)]">
              {t("newClient")}
            </button>
          } />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[var(--color-bg-alt)] text-xs text-[var(--color-text-secondary)] uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3 text-left">{t("client")}</th>
                  <th className="px-4 py-3 text-left hidden md:table-cell">{t("status")}</th>
                  <th className="px-4 py-3 text-left hidden lg:table-cell">{t("type")}</th>
                  <th className="px-4 py-3 text-left">{t("contacts")}</th>
                  <th className="px-4 py-3 text-left hidden xl:table-cell">{t("tags")}</th>
                  <th className="px-4 py-3 text-right">{t("updated")}</th>
                  <th className="px-4 py-3 text-right">{t("actions")}</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((client) => (
                  <ClientRow
                    key={client._id}
                    client={client}
                    onEdit={() => openEditModal(client)}
                    onDelete={() => handleDelete(client._id)}
                    format={format}
                    t={t}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ClientModal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setEditingClient(undefined); }}
        onSubmit={editingClient ? handleUpdate : handleCreate}
        client={editingClient}
        saving={saving}
        t={t}
      />
    </div>
  );
}