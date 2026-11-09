import { HiOutlineTrash, HiOutlineRefresh, HiOutlineExclamation, HiOutlineX } from 'react-icons/hi';

/** Must match TRASH_RETENTION_DAYS in server/src/jobs/trashPurge.js */
export const TRASH_RETENTION_DAYS = 5;

/** Whole days left before a trashed item is automatically deleted. */
export function trashDaysLeft(deletedAt) {
  if (!deletedAt) return TRASH_RETENTION_DAYS;
  const elapsedMs = Date.now() - new Date(deletedAt).getTime();
  return Math.max(0, Math.ceil(TRASH_RETENTION_DAYS - elapsedMs / 86400000));
}

/** Small "N days left" pill for rows in the Trash view. */
export function TrashCountdown({ deletedAt }) {
  const days = trashDaysLeft(deletedAt);
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${
        days <= 1
          ? 'bg-red-50 text-red-600 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800/60'
          : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/60'
      }`}
    >
      {days === 0 ? 'Deleting soon' : `${days} day${days === 1 ? '' : 's'} left`}
    </span>
  );
}

/** Active | Trash segmented switch. */
export function TrashViewTabs({ showTrash, onChange, trashCount, canViewTrash = true }) {
  if (!canViewTrash) return null;
  const base = 'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5';
  const on = 'bg-white dark:bg-surface-700 text-purple-600 dark:text-purple-400 shadow-sm';
  const off = 'text-surface-500 hover:text-surface-700 dark:hover:text-surface-200';
  return (
    <div className="inline-flex bg-surface-100 dark:bg-surface-800 p-1 rounded-xl">
      <button type="button" onClick={() => onChange(false)} className={`${base} ${!showTrash ? on : off}`}>
        Active
      </button>
      <button type="button" onClick={() => onChange(true)} className={`${base} ${showTrash ? on : off}`}>
        <HiOutlineTrash className="w-3.5 h-3.5" /> Trash
        {trashCount > 0 && (
          <span className="min-w-4 h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold inline-flex items-center justify-center">
            {trashCount}
          </span>
        )}
      </button>
    </div>
  );
}

/** Info banner shown at the top of the Trash view. */
export function TrashBanner() {
  return (
    <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 text-xs text-amber-800 dark:text-amber-300">
      <HiOutlineExclamation className="w-4 h-4 shrink-0 mt-0.5" />
      <span>
        Items in Trash are <strong>permanently deleted automatically after {TRASH_RETENTION_DAYS} days</strong>. Restore
        anything you want to keep.
      </span>
    </div>
  );
}

/** Floating bar shown while rows are selected. */
export function BulkActionBar({ count, showTrash, busy, onTrash, onRestore, onPurge, onClear }) {
  if (count === 0) return null;
  const btn = 'px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50 transition-all active:scale-95';
  return (
    <div className="sticky top-2 z-30 flex flex-wrap items-center gap-2 px-4 py-2.5 rounded-xl bg-surface-900 dark:bg-surface-800 text-white shadow-xl border border-surface-700 animate-fade-in">
      <span className="text-xs font-semibold mr-auto">{count} selected</span>
      {showTrash ? (
        <>
          <button type="button" disabled={busy} onClick={onRestore} className={`${btn} bg-emerald-600 hover:bg-emerald-500`}>
            <HiOutlineRefresh className="w-4 h-4" /> Restore
          </button>
          <button type="button" disabled={busy} onClick={onPurge} className={`${btn} bg-red-600 hover:bg-red-500`}>
            <HiOutlineTrash className="w-4 h-4" /> Delete permanently
          </button>
        </>
      ) : (
        <button type="button" disabled={busy} onClick={onTrash} className={`${btn} bg-red-600 hover:bg-red-500`}>
          <HiOutlineTrash className="w-4 h-4" /> Move to Trash
        </button>
      )}
      <button type="button" onClick={onClear} className="p-1.5 rounded-lg hover:bg-white/10" title="Clear selection">
        <HiOutlineX className="w-4 h-4" />
      </button>
    </div>
  );
}

/** Simple confirmation dialog for destructive actions. */
export function ConfirmDialog({ open, title, message, confirmLabel, danger = true, busy, onConfirm, onCancel }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onCancel}>
      <div
        className="w-full max-w-sm rounded-2xl bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-700 shadow-2xl p-5 space-y-3"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <h3 className="text-base font-bold text-surface-900 dark:text-white">{title}</h3>
        <p className="text-xs text-surface-500 dark:text-surface-400 leading-relaxed">{message}</p>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onCancel} className="btn-secondary text-xs">
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className={`px-4 py-2 rounded-xl text-xs font-semibold text-white disabled:opacity-50 ${
              danger ? 'bg-red-600 hover:bg-red-500' : 'bg-purple-600 hover:bg-purple-500'
            }`}
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
