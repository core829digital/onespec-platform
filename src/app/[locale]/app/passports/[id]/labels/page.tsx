"use client";

import { use, useEffect, useState } from "react";
import { useQuery } from "convex/react";
import QRCode from "qrcode";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

type Row = { token: string; label: string; qr: string };

export default function PassportLabelsPage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>;
}) {
  const { id } = use(params);
  const passport = useQuery(api.passports.get, {
    passportId: id as Id<"serramentoPassports">,
  });
  const siblings = useQuery(
    api.passports.listByQuote,
    passport?.quoteId ? { quoteId: passport.quoteId } : "skip",
  );

  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    const list =
      siblings && siblings.length > 0
        ? siblings
        : passport
          ? [passport]
          : [];
    if (list.length === 0) return;
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    Promise.all(
      list.map(async (p) => ({
        token: p.publicToken,
        label: p.label,
        qr: await QRCode.toDataURL(`${origin}/f/${p.publicToken}`, { margin: 0, width: 240 }),
      })),
    ).then(setRows);
  }, [passport, siblings]);

  if (!passport) return <div className="p-10 text-sm text-zinc-500">Caricamento…</div>;

  return (
    <div className="mx-auto max-w-[210mm] bg-white p-6 text-zinc-900 print:p-0">
      <style>{`
        @media print {
          @page { size: A4; margin: 10mm; }
          .no-print { display: none !important; }
        }
      `}</style>
      <div className="no-print mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold">Etichette QR · {passport.customerName}</h1>
          <p className="text-sm text-zinc-500">{rows.length} etichette · taglio 25×25 mm</p>
        </div>
        <button
          onClick={() => window.print()}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white"
        >
          Stampa
        </button>
      </div>

      <div className="grid grid-cols-6 gap-[3mm] print:gap-[2mm]">
        {rows.map((r) => (
          <div
            key={r.token}
            className="flex flex-col items-center border border-zinc-200 p-[2mm] text-center"
            style={{ width: "30mm" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={r.qr} alt={r.label} style={{ width: "22mm", height: "22mm" }} />
            <div className="mt-[1mm] w-full truncate text-[6px] font-medium leading-tight">
              {r.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
