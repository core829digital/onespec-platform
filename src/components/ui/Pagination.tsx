"use client";

import { ChevronLeft, ChevronRight, ChevronFirst, ChevronLast } from "lucide-react";
import { usePagination, PaginationConfig } from "@/hooks/usePagination";

interface PaginationProps {
  totalItems: number;
  config?: PaginationConfig;
  onPageChange?: (page: number, itemsPerPage: number) => void;
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
    goToPage: goToPageRaw,
    setItemsPerPage,
    pageNumbers,
  } = pagination;

  // Wrap every page-changing action so a consumer passing onPageChange (e.g. to
  // re-slice an already-fetched array) is notified with the target page and
  // the current page size as plain numbers — not a snapshot of the `pagination`
  // object, which is stale right after calling the raw async setters below.
  const goToPage = (page: number) => {
    goToPageRaw(page);
    onPageChange?.(Math.max(1, Math.min(page, totalPages)), itemsPerPage);
  };
  const nextPage = () => goToPage(currentPage + 1);
  const prevPage = () => goToPage(currentPage - 1);
  const firstPage = () => goToPage(1);
  const lastPage = () => goToPage(totalPages);

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
              const next = parseInt(e.target.value, 10);
              setItemsPerPage(next);
              onPageChange?.(1, next);
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
          className="p-2 rounded border border-[var(--color-border)] bg-[var(--color-bg)] transition-colors disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[var(--color-bg-alt)] hover:border-[var(--color-mint)] disabled:hover:bg-[var(--color-bg)] disabled:hover:border-[var(--color-border)]"
          aria-label="Prima pagina"
        >
          <ChevronFirst className="w-4 h-4" />
        </button>
        <button
          onClick={prevPage}
          disabled={currentPage === 1}
          className="p-2 rounded border border-[var(--color-border)] bg-[var(--color-bg)] transition-colors disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[var(--color-bg-alt)] hover:border-[var(--color-mint)] disabled:hover:bg-[var(--color-bg)] disabled:hover:border-[var(--color-border)]"
          aria-label="Pagina precedente"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-1 mx-2">
          {pageNumbers.map((page: number | "ellipsis", idx: number) => (
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
          className="p-2 rounded border border-[var(--color-border)] bg-[var(--color-bg)] transition-colors disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[var(--color-bg-alt)] hover:border-[var(--color-mint)] disabled:hover:bg-[var(--color-bg)] disabled:hover:border-[var(--color-border)]"
          aria-label="Pagina successiva"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
        <button
          onClick={lastPage}
          disabled={currentPage === totalPages}
          className="p-2 rounded border border-[var(--color-border)] bg-[var(--color-bg)] transition-colors disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[var(--color-bg-alt)] hover:border-[var(--color-mint)] disabled:hover:bg-[var(--color-bg)] disabled:hover:border-[var(--color-border)]"
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