"use client";

import { useState } from "react";

interface SupplierItem {
  id: string;
  supplier: string;
  product: string;
  qty: number;
  price: number;
  total: number;
}

interface MultiSupplierTableProps {
  items: SupplierItem[];
  onItemsChange: (items: SupplierItem[]) => void;
  suppliers: Array<{ name: string; color: string }>;
  readOnly?: boolean;
}

const SUPPLIER_COLORS = [
  "bg-blue-600",
  "bg-amber-500",
  "bg-red-600",
  "bg-emerald-600",
  "bg-violet-600",
  "bg-orange-600",
] as const;

export function MultiSupplierTable({
  items,
  onItemsChange,
  suppliers,
  readOnly = false,
}: MultiSupplierTableProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, { qty: string; price: string }>>({});

  const handleQtyChange = (id: string, qty: string) => {
    const num = Math.max(1, parseInt(qty) || 1);
    setEditValues((prev) => ({ ...prev, [id]: { ...prev[id], qty: String(num) } }));
  };

  const handlePriceChange = (id: string, price: string) => {
    const num = Math.max(0, parseFloat(price) || 0);
    setEditValues((prev) => ({ ...prev, [id]: { ...prev[id], price: String(num) } }));
  };

  const saveEdit = (id: string) => {
    const vals = editValues[id];
    if (!vals) return;
    onItemsChange(
      items.map((item) =>
        item.id === id
          ? { ...item, qty: parseInt(vals.qty) || 1, price: Math.round(parseFloat(vals.price) || 0) }
          : item
      )
    );
    setEditingId(null);
    setEditValues((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const cancelEdit = (id: string) => {
    setEditingId(null);
    setEditValues((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const addItem = () => {
    const newItem = {
      id: `item_${Date.now()}`,
      supplier: suppliers[0]?.name || "",
      product: "",
      qty: 1,
      price: 0,
      total: 0,
    };
    onItemsChange([...items, newItem]);
  };

  const removeItem = (id: string) => {
    onItemsChange(items.filter((i) => i.id !== id));
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold">Articoli Multi-Fornitore</h3>
        {!readOnly && (
          <button
            onClick={addItem}
            className="px-3 py-1.5 rounded-lg text-sm font-medium bg-zinc-900 text-white hover:bg-zinc-800"
          >
            + Aggiungi articolo
          </button>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border border-[var(--color-border)]">
        <table className="w-full text-sm">
          <thead className="bg-[var(--color-muted)] text-xs text-[var(--color-muted-fg)]">
            <tr>
              <th className="px-3 py-2 text-left">Fornitore</th>
              <th className="px-3 py-2 text-left">Prodotto</th>
              <th className="px-3 py-2 text-right">Qtà</th>
              <th className="px-3 py-2 text-right">Prezzo unit.</th>
              <th className="px-3 py-2 text-right">Totale</th>
              <th className="px-3 py-2 text-right"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const isEditing = editingId === item.id;
              const vals = editValues[item.id] || { qty: String(item.qty), price: String(item.price) };
              const supplierIdx = suppliers.findIndex((s) => s.name === item.supplier);
              const colorClass = SUPPLIER_COLORS[supplierIdx % SUPPLIER_COLORS.length];

              return (
                <tr key={item.id} className={`border-t border-[var(--color-border)] ${isEditing ? "bg-zinc-50" : ""}`}>
                  <td className="px-3 py-2">
                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${colorClass} text-white`}>
                      <span className="w-2 h-2 rounded-full"></span>
                      {item.supplier}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    {isEditing ? (
                      <input
                        type="text"
                        value={item.product}
                        onChange={(e) => setEditValues((prev) => ({ ...prev, [item.id]: { ...vals, product: e.target.value } }))}
                        className="w-full rounded border border-[var(--color-border)] bg-transparent px-2 py-1 text-sm"
                      />
                    ) : (
                      <span>{item.product || "—"}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {isEditing ? (
                      <input
                        type="number"
                        min="1"
                        value={vals.qty}
                        onChange={(e) => handleQtyChange(item.id, e.target.value)}
                        className="w-20 rounded border border-[var(--color-border)] bg-transparent px-2 py-1 text-sm text-right"
                      />
                    ) : (
                      <span className="font-mono">{item.qty}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {isEditing ? (
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={vals.price}
                        onChange={(e) => handlePriceChange(item.id, e.target.value)}
                        className="w-24 rounded border border-[var(--color-border)] bg-transparent px-2 py-1 text-sm text-right"
                      />
                    ) : (
                      <span className="font-mono">{Number(item.price).toLocaleString("it-IT")}€</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right font-mono font-semibold">
                    {(item.qty * item.price).toLocaleString("it-IT")}€
                  </td>
                  <td className="px-3 py-2 text-right">
                    {isEditing ? (
                      <div className="flex gap-1 justify-end">
                        <button
                          onClick={() => saveEdit(item.id)}
                          className="px-2 py-1 rounded text-xs bg-emerald-600 text-white hover:bg-emerald-700"
                        >
                          Salva
                        </button>
                        <button
                          onClick={() => cancelEdit(item.id)}
                          className="px-2 py-1 rounded text-xs border border-[var(--color-border)] hover:bg-zinc-100"
                        >
                          Annulla
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-1 justify-end">
                        {!readOnly && (
                          <button
                            onClick={() => setEditingId(item.id)}
                            className="px-2 py-1 rounded text-xs bg-zinc-100 hover:bg-zinc-200 text-zinc-700"
                          >
                            Modifica
                          </button>
                        )}
                        <button
                          onClick={() => removeItem(item.id)}
                          disabled={readOnly}
                          className="px-2 py-1 rounded text-xs bg-red-100 text-red-700 hover:bg-red-200 disabled:opacity-50"
                        >
                          Rimuovi
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
            {items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-[var(--color-muted-fg)]">
                  Nessun articolo. Clicca &ldquo;Aggiungi articolo&rdquo; per iniziare.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end pt-3">
        <div className="text-right">
          <span className="text-sm text-[var(--color-muted-fg)]">Totale materiali: </span>
          <span className="font-bold text-lg">
            {items.reduce((sum, i) => sum + i.qty * i.price, 0).toLocaleString("it-IT")}€
          </span>
        </div>
      </div>
    </div>
  );
}