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
