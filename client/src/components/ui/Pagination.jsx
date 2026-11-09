import {
  HiOutlineChevronLeft,
  HiOutlineChevronRight,
  HiOutlineChevronDoubleLeft,
  HiOutlineChevronDoubleRight,
} from 'react-icons/hi';

/**
 * Reusable Luxury Pagination Component
 * 
 * Props:
 * - page: Current active page (1-based)
 * - totalPages: Total number of pages
 * - totalItems: Total number of items across all pages
 * - itemsPerPage: Items displayed per page
 * - onPageChange: (newPage: number) => void
 * - onItemsPerPageChange: (newLimit: number) => void (optional)
 * - itemsPerPageOptions: number[] (default: [12, 24, 48])
 * - label: string (e.g. 'notes', 'families', 'items')
 */
export default function Pagination({
  page = 1,
  totalPages = 1,
  totalItems = 0,
  itemsPerPage = 12,
  onPageChange,
  onItemsPerPageChange,
  itemsPerPageOptions = [12, 24, 48],
  label = 'items',
}) {
  if (totalItems === 0) return null;

  const start = Math.min((page - 1) * itemsPerPage + 1, totalItems);
  const end = Math.min(page * itemsPerPage, totalItems);

  // Generate visible page numbers
  const getPageNumbers = () => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    if (page <= 4) {
      return [1, 2, 3, 4, 5, '...', totalPages];
    }

    if (page >= totalPages - 3) {
      return [1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }

    return [1, '...', page - 1, page, page + 1, '...', totalPages];
  };

  const pages = getPageNumbers();

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-surface-200 dark:border-surface-800 text-xs select-none">
      {/* Left: Summary text */}
      <div className="flex items-center gap-3 text-surface-500 dark:text-surface-400">
        <span>
          Showing <span className="font-semibold text-surface-900 dark:text-white">{start}</span> to{' '}
          <span className="font-semibold text-surface-900 dark:text-white">{end}</span> of{' '}
          <span className="font-semibold text-purple-600 dark:text-purple-400">{totalItems}</span> {label}
        </span>

        {/* Per page selector */}
        {onItemsPerPageChange && (
          <div className="flex items-center gap-1.5 ml-2 pl-3 border-l border-surface-200 dark:border-surface-700">
            <span className="text-[11px] text-surface-400">Per page:</span>
            <select
              value={itemsPerPage}
              onChange={(e) => {
                onItemsPerPageChange(Number(e.target.value));
                if (onPageChange) onPageChange(1);
              }}
              className="bg-surface-100 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-lg py-1 px-2 text-xs text-surface-700 dark:text-surface-200 focus:outline-none focus:ring-1 focus:ring-purple-500 cursor-pointer"
            >
              {itemsPerPageOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Right: Controls & Page buttons */}
      <div className="flex items-center gap-1">
        {/* First Page */}
        <button
          onClick={() => onPageChange(1)}
          disabled={page <= 1}
          className="p-1.5 rounded-lg border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-surface-500 hover:text-surface-900 dark:hover:text-white hover:bg-surface-50 dark:hover:bg-surface-700 disabled:opacity-30 disabled:pointer-events-none transition-colors"
          title="First Page"
        >
          <HiOutlineChevronDoubleLeft className="w-3.5 h-3.5" />
        </button>

        {/* Previous Page */}
        <button
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page <= 1}
          className="p-1.5 rounded-lg border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-surface-500 hover:text-surface-900 dark:hover:text-white hover:bg-surface-50 dark:hover:bg-surface-700 disabled:opacity-30 disabled:pointer-events-none transition-colors"
          title="Previous Page"
        >
          <HiOutlineChevronLeft className="w-3.5 h-3.5" />
        </button>

        {/* Mobile page indicator */}
        <span className="sm:hidden px-2 text-surface-600 dark:text-surface-300 font-medium">
          {page} / {totalPages}
        </span>

        {/* Numeric page pills on tablet & desktop */}
        <div className="hidden sm:flex items-center gap-1 mx-1">
          {pages.map((p, idx) => {
            if (p === '...') {
              return (
                <span
                  key={`ellipsis-${idx}`}
                  className="px-2 py-1 text-surface-400 select-none cursor-default font-mono"
                >
                  …
                </span>
              );
            }

            const isActive = p === page;

            return (
              <button
                key={p}
                onClick={() => onPageChange(p)}
                className={`min-w-[28px] h-7 px-2 rounded-lg font-medium text-xs transition-all ${
                  isActive
                    ? 'bg-purple-600 text-white font-bold shadow-sm shadow-purple-500/30'
                    : 'text-surface-600 dark:text-surface-300 hover:bg-purple-50 dark:hover:bg-surface-800 hover:text-purple-600 dark:hover:text-purple-400'
                }`}
              >
                {p}
              </button>
            );
          })}
        </div>

        {/* Next Page */}
        <button
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
          className="p-1.5 rounded-lg border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-surface-500 hover:text-surface-900 dark:hover:text-white hover:bg-surface-50 dark:hover:bg-surface-700 disabled:opacity-30 disabled:pointer-events-none transition-colors"
          title="Next Page"
        >
          <HiOutlineChevronRight className="w-3.5 h-3.5" />
        </button>

        {/* Last Page */}
        <button
          onClick={() => onPageChange(totalPages)}
          disabled={page >= totalPages}
          className="p-1.5 rounded-lg border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-surface-500 hover:text-surface-900 dark:hover:text-white hover:bg-surface-50 dark:hover:bg-surface-700 disabled:opacity-30 disabled:pointer-events-none transition-colors"
          title="Last Page"
        >
          <HiOutlineChevronDoubleRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
