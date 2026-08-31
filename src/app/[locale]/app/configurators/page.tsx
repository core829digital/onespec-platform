"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function ConfiguratorsPage() {
  const tenant = useQuery(api.tenants.getMyTenant);
  const configurators = useQuery(
    api.configurators.listConfigurators,
    tenant ? { tenantId: tenant._id } : "skip",
  );
  const createConfigurator = useMutation(api.configurators.createConfigurator);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!tenant || !name.trim()) return;
    setCreating(true);
    setError("");
    try {
      await createConfigurator({ tenantId: tenant._id, name: name.trim() });
      setName("");
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "Errore nella creazione");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-[var(--color-text)]">Configuratori</h1>
        <p className="text-[var(--color-text-secondary)] mt-2">
          Gestisci i configuratori embeddabili per il tuo sito
        </p>
      </div>

      <form onSubmit={handleCreate} className="flex gap-2 max-w-md">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nome nuovo configuratore"
          disabled={creating}
        />
        <Button type="submit" disabled={creating || !name.trim()}>
          {creating ? "Creazione..." : "Nuovo"}
        </Button>
      </form>
      {error && <p className="text-[var(--color-danger)] text-sm">{error}</p>}

      <div className="bg-[var(--color-bg-alt)] border border-[var(--color-border)] rounded-lg divide-y divide-[var(--color-border)]">
        {configurators === undefined ? (
          <div className="px-6 py-8 text-center text-[var(--color-text-secondary)]">Caricamento...</div>
        ) : configurators.length === 0 ? (
          <div className="px-6 py-8 text-center text-[var(--color-text-secondary)]">
            Nessun configuratore. Creane uno per iniziare.
          </div>
        ) : (
          configurators.map((c) => (
            <div key={c._id} className="px-6 py-4 flex items-center justify-between">
              <div>
                <p className="font-medium text-[var(--color-text)]">{c.name}</p>
                <p className="text-sm text-[var(--color-text-secondary)]">
                  <span className="capitalize">{c.status}</span> · /w/{c.publicId}
                </p>
              </div>
              <Link
                href={`/app/configurators/${c._id}`}
                className="text-[var(--color-mint)] text-sm hover:underline"
              >
                Modifica
              </Link>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
