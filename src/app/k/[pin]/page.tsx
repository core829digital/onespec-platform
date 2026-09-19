import type { Metadata } from "next";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { notFound } from "next/navigation";
import { CantiereGuestView } from "@/components/cantieri/CantiereGuestView";

export const revalidate = 60;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ pin: string }>;
}): Promise<Metadata> {
  const { pin } = await params;
  const result = await fetchQuery(api.cantieri.getCantiereByGuestPin, { pin });
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
  const result = await fetchQuery(api.cantieri.getCantiereByGuestPin, { pin });
  if (!result || "error" in result) notFound();
  const cantiere = result.cantiere;

  return <CantiereGuestView cantiere={cantiere} pin={pin} />;
}