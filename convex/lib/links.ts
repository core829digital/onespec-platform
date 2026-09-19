/**
 * Client / cantiere linkage — the "one client, everywhere" backbone.
 *
 * Every record that can belong to a client/cantiere (quotes, surveys,
 * inspections, installation dossiers) resolves its links through here, so
 * that:
 *  1. a caller can never link a record to ANOTHER tenant's client/cantiere
 *     (the raw `v.id("clients")` validator only proves the id exists, not
 *     that it is theirs);
 *  2. a cantiere implies its client (and a mismatching pair is rejected);
 *  3. every link leaves a line in the client's activity timeline.
 */

import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

export interface ResolvedLinks {
  clientId: Id<"clients"> | undefined;
  cantiereId: Id<"cantieri"> | undefined;
  client: Doc<"clients"> | null;
  cantiere: Doc<"cantieri"> | null;
}

export async function resolveLinks(
  ctx: QueryCtx | MutationCtx,
  tenantId: Id<"tenants">,
  input: { clientId?: Id<"clients">; cantiereId?: Id<"cantieri"> },
): Promise<ResolvedLinks> {
  let clientId = input.clientId;
  let cantiere: Doc<"cantieri"> | null = null;

  if (input.cantiereId) {
    cantiere = await ctx.db.get(input.cantiereId);
    if (!cantiere || cantiere.tenantId !== tenantId) throw new ConvexError("CANTIERE_NOT_FOUND");
    if (clientId && cantiere.clientId && cantiere.clientId !== clientId) {
      throw new ConvexError("CANTIERE_CLIENT_MISMATCH");
    }
    clientId = clientId ?? cantiere.clientId;
  }

  let client: Doc<"clients"> | null = null;
  if (clientId) {
    client = await ctx.db.get(clientId);
    if (!client || client.tenantId !== tenantId) throw new ConvexError("CLIENT_NOT_FOUND");
  }

  return { clientId, cantiereId: input.cantiereId, client, cantiere };
}

type ActivityType = "survey" | "quote" | "installation" | "inspection";

/** Append a system line to the client's timeline. No-op when unlinked. */
export async function logClientActivity(
  ctx: MutationCtx,
  args: {
    tenantId: Id<"tenants">;
    clientId: Id<"clients"> | undefined;
    userId: Id<"users">;
    type: ActivityType;
    title: string;
    relatedTable: string;
    relatedId: string;
  },
): Promise<void> {
  if (!args.clientId) return;
  await ctx.db.insert("clientActivities", {
    tenantId: args.tenantId,
    clientId: args.clientId,
    userId: args.userId,
    type: args.type,
    title: args.title,
    relatedTable: args.relatedTable,
    relatedId: args.relatedId,
    createdAt: Date.now(),
  });
}

/** Lightweight summaries — never ship photo/signature payloads to a folder view. */
export interface RelatedRecords {
  quotes: Array<{
    _id: Id<"quoteRequests">;
    leadName: string;
    priceCents: number;
    status: string;
    publicId: string;
    signedAt: number | undefined;
    createdAt: number;
  }>;
  surveys: Array<{
    _id: Id<"siteSurveys">;
    customerName: string;
    status: string;
    openingsCount: number;
    createdAt: number;
  }>;
  inspections: Array<{
    _id: Id<"inspectionReports">;
    customerName: string;
    status: string;
    createdAt: number;
  }>;
  installations: Array<{
    _id: Id<"installationDossiers">;
    jobType: string;
    nodeType: string;
    createdAt: number;
  }>;
}

const RELATED_LIMIT = 100;

/**
 * Everything in the platform tied to one client OR one cantiere — the data
 * behind the client/cantiere "folder" pages. Uses the by_client/by_cantiere
 * indexes (the real FK), never a heuristic like matching e-mail addresses.
 */
export async function listRelated(
  ctx: QueryCtx,
  key: { clientId: Id<"clients"> } | { cantiereId: Id<"cantieri"> },
): Promise<RelatedRecords> {
  const byClient = "clientId" in key;
  const [quotes, surveys, inspections, installations] = await Promise.all([
    byClient
      ? ctx.db.query("quoteRequests").withIndex("by_client", (q) => q.eq("clientId", key.clientId)).order("desc").take(RELATED_LIMIT)
      : ctx.db.query("quoteRequests").withIndex("by_cantiere", (q) => q.eq("cantiereId", key.cantiereId)).order("desc").take(RELATED_LIMIT),
    byClient
      ? ctx.db.query("siteSurveys").withIndex("by_client", (q) => q.eq("clientId", key.clientId)).order("desc").take(RELATED_LIMIT)
      : ctx.db.query("siteSurveys").withIndex("by_cantiere", (q) => q.eq("cantiereId", key.cantiereId)).order("desc").take(RELATED_LIMIT),
    byClient
      ? ctx.db.query("inspectionReports").withIndex("by_client", (q) => q.eq("clientId", key.clientId)).order("desc").take(RELATED_LIMIT)
      : ctx.db.query("inspectionReports").withIndex("by_cantiere", (q) => q.eq("cantiereId", key.cantiereId)).order("desc").take(RELATED_LIMIT),
    byClient
      ? ctx.db.query("installationDossiers").withIndex("by_client", (q) => q.eq("clientId", key.clientId)).order("desc").take(RELATED_LIMIT)
      : ctx.db.query("installationDossiers").withIndex("by_cantiere", (q) => q.eq("cantiereId", key.cantiereId)).order("desc").take(RELATED_LIMIT),
  ]);

  return {
    quotes: quotes.map((r) => ({
      _id: r._id,
      leadName: r.leadName,
      priceCents: r.priceCents,
      status: r.status,
      publicId: r.publicId,
      signedAt: r.signedAt,
      createdAt: r._creationTime,
    })),
    surveys: surveys.map((r) => ({
      _id: r._id,
      customerName: r.customerName,
      status: r.status,
      openingsCount: r.openings.length,
      createdAt: r._creationTime,
    })),
    inspections: inspections.map((r) => ({
      _id: r._id,
      customerName: r.customerName,
      status: r.status,
      createdAt: r._creationTime,
    })),
    installations: installations.map((r) => ({
      _id: r._id,
      jobType: r.jobType,
      nodeType: r.nodeType,
      createdAt: r._creationTime,
    })),
  };
}
