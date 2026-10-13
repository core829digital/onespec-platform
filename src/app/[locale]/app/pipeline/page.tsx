"use client";

import { useMemo, useState } from "react";
import { useMutation } from "convex/react";
import { useQuery } from "@/lib/convex-query";
import { api } from "@/convex/_generated/api";
import { useRouter } from "@/i18n/navigation";
import { useFriendlyError } from "@/lib/use-friendly-error";
import { useLocale, useTranslations } from "next-intl";
import {
  DndContext, DragOverlay, pointerWithin, rectIntersection, useDraggable, useDroppable,
  type CollisionDetection, type DragEndEvent, type DragStartEvent,
} from "@dnd-kit/core";
import { GripVertical } from "lucide-react";
import { guardedListeners, useBoardSensors, useDropAnimation, type DragListeners } from "@/components/dnd/kit";

const COLUMNS = ["new", "contacted", "quoted", "won", "lost"] as const;
type Col = (typeof COLUMNS)[number];

type Req = {
  _id: string;
  _creationTime: number;
  leadName: string;
  leadCompany?: string;
  priceCents: number;
  status: string;
};

export default function PipelinePage() {
  const t = useTranslations("pipeline");
  const tReq = useTranslations("requests");
  const locale = useLocale();
  const tf = useFriendlyError();
  const LABEL: Record<Col, string> = {
    new: tReq("statusNew"),
    contacted: tReq("statusContacted"),
    quoted: tReq("statusQuoted"),
    won: tReq("statusWon"),
    lost: tReq("statusLost"),
  };
  const eur = (c: number) =>
    `€${(c / 100).toLocaleString(locale, { maximumFractionDigits: 0 })}`;
  const router = useRouter();
  const tenant = useQuery(api.tenants.getMyTenant);
  const requests = useQuery(
    api.quotes.listRequests,
    tenant ? { tenantId: tenant._id, limit: 200 } : "skip",
  ) as Req[] | undefined;
  const updateStatus = useMutation(api.quotes.updateStatus);

  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useBoardSensors();
  const dropAnimation = useDropAnimation();
  const [pending, setPending] = useState<Record<string, Col>>({});
  const [err, setErr] = useState("");

  const board = useMemo(() => {
    const b: Record<Col, Req[]> = { new: [], contacted: [], quoted: [], won: [], lost: [] };
    for (const r of requests ?? []) {
      const col = (pending[r._id] ?? r.status) as Col;
      if (col in b) b[col].push(r);
    }
    return b;
  }, [requests, pending]);

  async function move(id: string, to: Col, from: string) {
    if (to === from) return;
    setPending((p) => ({ ...p, [id]: to }));
    setErr("");
    try {
      await updateStatus({ quoteId: id as never, status: to });
    } catch (e) {
      setPending((p) => {
        const n = { ...p };
        delete n[id];
        return n;
      });
      setErr(tf(e));
    }
  }

  if (requests === undefined) {
    return <p className="text-[var(--color-text-secondary)]">{t("loading")}</p>;
  }

  const curOf = (r: Req) => (pending[r._id] ?? r.status) as Col;
  const activeReq = activeId ? (requests ?? []).find((r) => r._id === activeId) : undefined;
  // A column is wide; the pointer inside it decides. Falls back to overlap so a drop near an edge still lands.
  const collision: CollisionDetection = (args) => {
    const hits = pointerWithin(args);
    return hits.length ? hits : rectIntersection(args);
  };

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }
  function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const card = (requests ?? []).find((r) => r._id === String(e.active.id));
    const to = e.over ? (String(e.over.id) as Col) : null;
    if (card && to && COLUMNS.includes(to)) void move(card._id, to, curOf(card));
  }

  const announcements = {
    onDragStart: ({ active }: { active: { id: string | number } }) => {
      const r = requests?.find((x) => x._id === String(active.id));
      return t("dndPickedUp", { name: r?.leadName ?? "" });
    },
    onDragOver: () => undefined,
    onDragEnd: ({ active, over }: { active: { id: string | number }; over: { id: string | number } | null }) => {
      const r = requests?.find((x) => x._id === String(active.id));
      return over && r ? t("dndMovedTo", { name: r.leadName, column: LABEL[String(over.id) as Col] ?? "" }) : "";
    },
    onDragCancel: ({ active }: { active: { id: string | number } }) => {
      const r = requests?.find((x) => x._id === String(active.id));
      return t("dndCancelled", { name: r?.leadName ?? "" });
    },
  };

  return (
    <div className="space-y-4">
      <div className="os-rise">
        <h1 className="text-2xl sm:text-3xl font-bold text-[var(--color-text)]">{t("title")}</h1>
        <p className="text-[var(--color-text-secondary)] mt-1">
          {t("subtitle")}
        </p>
      </div>
      {err ? <p className="text-sm text-[var(--color-danger)]">{err}</p> : null}

      <DndContext
        sensors={sensors}
        collisionDetection={collision}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={() => setActiveId(null)}
        accessibility={{ announcements, screenReaderInstructions: { draggable: t("dndHint") } }}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-4">
          {COLUMNS.map((col, ci) => (
            <PipelineColumn key={col} col={col} index={ci} label={LABEL[col]} cards={board[col]} eur={eur} empty={t("empty")}>
              {board[col].map((c) => (
                <PipelineCard
                  key={c._id}
                  c={c}
                  cur={curOf(c)}
                  eur={eur}
                  LABEL={LABEL}
                  onMove={move}
                  onOpen={() => router.push(`/app/requests/${c._id}`)}
                  t={t}
                />
              ))}
            </PipelineColumn>
          ))}
        </div>
        <DragOverlay dropAnimation={dropAnimation}>
          {activeReq ? <PipelineCardView c={activeReq} cur={curOf(activeReq)} eur={eur} LABEL={LABEL} overlay t={t} /> : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

type T = ReturnType<typeof useTranslations>;

function PipelineColumn({
  col, index, label, cards, eur, empty, children,
}: {
  col: Col; index: number; label: string; cards: Req[]; eur: (c: number) => string; empty: string; children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: col });
  const total = cards.reduce((s, c) => s + c.priceCents, 0);
  return (
    <section
      ref={setNodeRef}
      style={{ "--i": index } as React.CSSProperties}
      className={`os-rise os-droppable rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-alt)] flex flex-col min-h-[160px] ${isOver ? "os-drop-over" : ""}`}
      aria-label={label}
    >
      <header className="px-3 py-2 border-b border-[var(--color-border)]">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-[var(--color-text)]">{label}</span>
          <span className="text-xs text-[var(--color-text-secondary)] tabular-nums">{cards.length}</span>
        </div>
        <p className="text-xs text-[var(--color-text-secondary)] tabular-nums mt-0.5">{eur(total)}</p>
      </header>
      <div className="p-2 space-y-2 flex-1">
        {children}
        {cards.length === 0 ? <p className="text-xs text-[var(--color-text-secondary)] px-1 py-4 text-center">{empty}</p> : null}
      </div>
    </section>
  );
}

function PipelineCard(props: {
  c: Req; cur: Col; eur: (c: number) => string; LABEL: Record<Col, string>;
  onMove: (id: string, to: Col, from: string) => void; onOpen: () => void; t: T;
}) {
  const { setNodeRef, listeners, isDragging } = useDraggable({ id: props.c._id });
  return (
    <PipelineCardView
      {...props}
      innerRef={setNodeRef}
      dragProps={guardedListeners(listeners as DragListeners)}
      isDragging={isDragging}
    />
  );
}

function PipelineCardView({
  c, cur, eur, LABEL, onMove, onOpen, t, innerRef, dragProps, isDragging, overlay,
}: {
  c: Req; cur: Col; eur: (c: number) => string; LABEL: Record<Col, string>;
  onMove?: (id: string, to: Col, from: string) => void; onOpen?: () => void; t: T;
  innerRef?: (el: HTMLElement | null) => void; dragProps?: Record<string, unknown>; isDragging?: boolean; overlay?: boolean;
}) {
  const idx = COLUMNS.indexOf(cur);
  return (
    <article
      ref={innerRef}
      {...dragProps}
      tabIndex={overlay ? -1 : 0}
      onKeyDown={(e) => {
        if (!onMove || e.target !== e.currentTarget) return;
        if (e.key === "ArrowRight" && idx < COLUMNS.length - 1) onMove(c._id, COLUMNS[idx + 1], cur);
        if (e.key === "ArrowLeft" && idx > 0) onMove(c._id, COLUMNS[idx - 1], cur);
        if (e.key === "Enter") onOpen?.();
      }}
      className={`os-draggable os-float rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-2.5 text-sm cursor-grab focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-mint)]/50 ${isDragging ? "os-drag-source" : ""} ${overlay ? "os-dragging" : ""}`}
    >
      <div className="flex items-start justify-between gap-1">
        <button type="button" onClick={onOpen} className="font-medium text-[var(--color-text)] hover:underline text-left">
          {c.leadName}
        </button>
        <GripVertical className="h-4 w-4 shrink-0 text-[var(--color-text-secondary)]" aria-hidden="true" />
      </div>
      {c.leadCompany ? <p className="text-xs text-[var(--color-text-secondary)] truncate">{c.leadCompany}</p> : null}
      <p className="text-xs text-[var(--color-text)] tabular-nums mt-1">{eur(c.priceCents)}</p>
      <div className="mt-2 flex items-center gap-1">
        <button
          type="button"
          disabled={idx === 0}
          onClick={() => onMove?.(c._id, COLUMNS[idx - 1], cur)}
          aria-label={t("prevPhase")}
          className="rounded border border-[var(--color-border)] px-1.5 text-xs text-[var(--color-text-secondary)] disabled:opacity-30"
        >
          ←
        </button>
        <select
          value={cur}
          onChange={(e) => onMove?.(c._id, e.target.value as Col, cur)}
          className="flex-1 rounded border border-[var(--color-border)] bg-[var(--color-bg-alt)] px-1.5 py-1 text-xs text-[var(--color-text)]"
          aria-label={t("phaseOf", { name: c.leadName })}
        >
          {COLUMNS.map((s) => (
            <option key={s} value={s}>
              {LABEL[s]}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={idx === COLUMNS.length - 1}
          onClick={() => onMove?.(c._id, COLUMNS[idx + 1], cur)}
          aria-label={t("nextPhase")}
          className="rounded border border-[var(--color-border)] px-1.5 text-xs text-[var(--color-text-secondary)] disabled:opacity-30"
        >
          →
        </button>
      </div>
    </article>
  );
}
