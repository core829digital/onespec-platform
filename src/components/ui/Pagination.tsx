"use client";

import { ChevronLeft, ChevronRight, ChevronFirst, ChevronLast } from "lucide-react";
import { usePagination, PaginationConfig } from "@/hooks/usePagination";

interface PaginationProps {
  totalItems: number;
  config?: PaginationConfig;
  onPageChange?: (page: number, pageInfo: ReturnType<typeof usePagination>) => void;
  className?: string;
  showItemsPerPage?: boolean;
  itemsPerPageOptions?: number[];
  t?: {
    page?: string;
    of?: string;
    itemsPerPage?: string;
    items?: string;
    showing?: string;
    to?: string;
    results?: string;
  };
}

export function Pagination({
  totalItems,
  config = {},
  onPageChange,
  className = "",
  showItemsPerPage = true,
  itemsPerPageOptions = [10, 25, 50, 100],
  t = {},
}: PaginationProps) {
  const pagination = usePagination(totalItems, config);
  const {
    currentPage,
    totalPages,
    itemsPerPage,
    totalItems: total,
    goToPage,
    nextPage,
    prevPage,
    firstPage,
    lastPage,
    setItemsPerPage,
    pageNumbers,
  } = pagination;

  if (totalPages <= 1 && !showItemsPerPage) return null;

  const labels = {
    page: t.page || "Pagina",
    of: t.of || "di",
    itemsPerPage: t.itemsPerPage || "Elementi per pagina",
    items: t.items || "elementi",
    showing: t.showing || "Mostra",
    to: t.to || "a",
    results: t.results || "risultati",
  };

  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, total);

  return (
    <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 ${className}`}>
      <div className="flex items-center gap-3">
        <div className="text-sm text-[var(--color-text-secondary)]">
          {labels.showing} <span className="font-medium">{startItem}</span> {labels.to}{" "}
          <span className="font-medium">{endItem}</span> {labels.of}{" "}
          <span className="font-medium">{total}</span> {labels.results}
        </div>
        {showItemsPerPage && (
          <select
            value={itemsPerPage}
            onChange={(e) => {
              const value = parseInt(e.target.value, 10);
              // Find the pagination context to call setItemsPerPage
              // We'll handle this via a custom event or context
            }}
            className="ml-4 px-2 py-1 text-sm border border-[var(--color-border)] rounded bg-[var(--color-bg)]"
          >
            {itemsPerPageOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt} {labels.itemsPerPage}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={firstPage}
          disabled={currentPage === 1}
          className="p-2 rounded border border-[var(--color-border)] bg-[var(--color-bg)] disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[var(--color-bg-alt)]"
          aria-label="Prima pagina"
        >
          <ChevronFirst className="w-4 h-4" />
        </button>
        <button
          onClick={prevPage}
          disabled={currentPage === 1}
          className="p-2 rounded border border-[var(--color-border)] bg-[var(--color-bg)] disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[var(--color-bg-alt)]"
          aria-label="Pagina precedente"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-1 mx-2">
          {pageNumbers.map((page, idx) => (
            <button
              key={idx}
              onClick={() => page !== "ellipsis" && goToPage(page as number)}
              disabled={page === "ellipsis" || page === currentPage}
              className={`px-3 py-1.5 text-sm rounded border border-[var(--color-border)] transition-colors ${
                page === "ellipsis"
                  ? "text-[var(--color-text-secondary)] cursor-default bg-transparent border-transparent"
                  : page === currentPage
                  ? "bg-[var(--color-accent)] text-[var(--color-accent-ink)] border-[var(--color-accent)]"
                  : "bg-[var(--color-bg)] text-[var(--color-text)] hover:bg-[var(--color-bg-alt)]"
              }`}
            >
              {page}
            </button>
          ))}
        </div>

        <button
          onClick={nextPage}
          disabled={currentPage === totalPages}
          className="p-2 rounded border border-[var(--color-border)] bg-[var(--color-bg)] disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[var(--color-bg-alt)]"
          aria-label="Pagina successiva"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
        <button
          onClick={lastPage}
          disabled={currentPage === totalPages}
          className="p-2 rounded border border-[var(--color-border)] bg-[var(--color-bg)] disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[var(--color-bg-alt)]"
          aria-label="Ultima pagina"
        >
          <ChevronLast className="w-4 h-4" />
        </button>
      </div>

      <div className="text-sm text-[var(--color-text-secondary)]">
        {labels.page} <span className="font-medium">{currentPage}</span> {labels.of}{" "}
        <span className="font-medium">{totalPages}</span>
      </div>
    </div>
  );
}