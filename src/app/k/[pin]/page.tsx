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

export async function generateMetadata({
  params,
}: {
  params: Promise<{ pin: string }>;
}): Promise<Metadata> {
  const { pin } = await params;
  const result = await fetchMutation(api.cantieri.getCantiereByGuestPin, { pin, ip: await clientIp() });
  if (!result || "error" in result) return { title: "OneSpec — Cantiere non trovato" };
  const cantiere = result.cantiere;
  return {
    title: `Cantiere ${cantiere.name} — OneSpec`,
    description: `Visualizzazione cantiere condivisa via PIN`,
    openGraph: { title: `Cantiere ${cantiere.name}`, type: "website" },
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