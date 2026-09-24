import type { Metadata } from "next";
import { fetchMutation } from "convex/nextjs";
import { headers } from "next/headers";
import { api } from "@/convex/_generated/api";
import { notFound } from "next/navigation";
import { CantiereGuestView } from "@/components/cantieri/CantiereGuestView";

async function clientIp(): Promise<string | undefined> {
  const h = await headers();
  return (h.get("x-forwarded-for") || "").split(",")[0].trim() || h.get("x-real-ip") || undefined;
}

export async function generateMetadata(): Promise<Metadata> {
  // No PIN lookup here on purpose: a lookup would burn 2x rate-limit tokens
  // per pageload (metadata + page each call getCantiereByGuestPin).
  return {
    title: "Cantiere condiviso — OneSpec",
    description: `Visualizzazione cantiere condivisa via PIN`,
    robots: { index: false, follow: false },
  };
}

export default async function CantiereGuestPage({
  params,
}: {
  params: Promise<{ pin: string }>;
}) {
  const { pin } = await params;
  const result = await fetchMutation(api.cantieri.getCantiereByGuestPin, { pin, ip: await clientIp() });
  if (!result || "error" in result) notFound();
  const cantiere = result.cantiere;

  return <CantiereGuestView cantiere={cantiere} pin={pin} />;
}