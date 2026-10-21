import type { Metadata } from "next";
import { fetchQuery } from "convex/nextjs";
import { notFound } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { InstallerJob } from "./client";

export const dynamic = "force-dynamic";

// Neutral on purpose: the market (and so the language) is only known after
// the token lookup, which the page does once.
export function generateMetadata(): Metadata {
  return { title: "OneSpec", robots: { index: false } };
}

export default async function InstallerPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!/^[A-Za-z0-9]{8,32}$/.test(token)) notFound();

  const data = await fetchQuery(api.inspections.getByInstallerToken, { token });
  if (!data) notFound();

  return <InstallerJob token={token} initial={data} />;
}
