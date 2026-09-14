"use client";

import { useCallback, useMemo, useState } from "react";

export interface PaginationConfig {
  itemsPerPage: number;
  maxPageButtons?: number;
}

export interface PaginationState {
  currentPage: number;
  totalItems: number;
  itemsPerPage: number;
}

export interface PaginationActions {
  goToPage: (page: number) => void;
  nextPage: () => void;
  prevPage: () => void;
  firstPage: () => void;
  lastPage: () => void;
  setItemsPerPage: (count: number) => void;
}

export function usePagination(
  totalItems: number,
  config: PaginationConfig = { itemsPerPage: 10 }
): PaginationState & PaginationActions {
  const { itemsPerPage: initialItemsPerPage, maxPageButtons = 5 } = config;
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPageState] = useState(initialItemsPerPage);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(totalItems / itemsPerPage)),
    [totalItems, itemsPerPage]
  );

  const paginatedItems = useMemo(() => ({
    start: (currentPage - 1) * itemsPerPage,
    end: Math.min(currentPage * itemsPerPage, totalItems),
    currentPage,
    totalPages,
    itemsPerPage,
    totalItems,
  }), [currentPage, itemsPerPage, totalItems, totalPages]);

  const goToPage = useCallback((page: number) => {
    const clampedPage = Math.max(1, Math.min(page, totalPages));
    setCurrentPage(clampedPage);
  }, [totalPages]);

  const nextPage = useCallback(() => {
    goToPage(currentPage + 1);
  }, [currentPage, goToPage]);

  const prevPage = useCallback(() => {
    goToPage(currentPage - 1);
  }, [currentPage, goToPage]);

  const firstPage = useCallback(() => {
    goToPage(1);
  }, [goToPage]);

  const lastPage = useCallback(() => {
    goToPage(totalPages);
  }, [totalPages, goToPage]);

  const setItemsPerPage = useCallback((count: number) => {
    setItemsPerPageState(count);
    setCurrentPage(1);
  }, []);

  const pageNumbers = useMemo(() => {
    const pages: (number | "ellipsis")[] = [];
    if (totalPages <= maxPageButtons) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      const half = Math.floor(maxPageButtons / 2);
      let start = Math.max(1, currentPage - half);
      let end = Math.min(totalPages, start + maxPageButtons - 1);
      if (end - start + 1 < maxPageButtons) {
        start = Math.max(1, end - maxPageButtons + 1);
      }
      for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= start && i <= end)) {
          pages.push(i);
        } else if (pages[pages.length - 1] !== "ellipsis") {
          pages.push("ellipsis");
        }
      }
    }
    return pages;
  }, [currentPage, totalPages, maxPageButtons]);

  return {
    ...paginatedItems,
    goToPage,
    nextPage,
    prevPage,
    firstPage,
    lastPage,
    setItemsPerPage: setItemsPerPage,
    pageNumbers,
  };
}