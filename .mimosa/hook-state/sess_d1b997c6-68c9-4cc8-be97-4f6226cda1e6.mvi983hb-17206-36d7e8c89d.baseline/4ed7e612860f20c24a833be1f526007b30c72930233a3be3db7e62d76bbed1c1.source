import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getLegalDoc, LEGAL_DOCS } from "@/content/legal";
import { LegalDocView } from "@/components/legal/legal-doc";
import { LegalFooter } from "@/components/legal/legal-footer";

export function generateStaticParams() {
  return LEGAL_DOCS.map((d) => ({ slug: d.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const doc = getLegalDoc(slug);
  return doc ? { title: `${doc.title} — OneSpec`, description: doc.summary } : {};
}

export default async function LegalDocPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const doc = getLegalDoc(slug);
  if (!doc) notFound();

  return (
    <div className="min-h-dvh bg-[var(--color-bg)] text-[var(--color-text)]">
      <LegalDocView doc={doc} />
      <LegalFooter />
    </div>
  );
}
