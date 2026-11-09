import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { toast } from '../components/ui/Toast';

/**
 * Shared selection + bulk Trash logic for list pages (Products, Orders).
 *
 * @param {object}   opts
 * @param {string}   opts.basePath    API base, e.g. '/products' or '/orders'
 * @param {Array}    opts.items       Rows currently displayed (selection resets when they change)
 * @param {Function} opts.onDone      Called after a bulk action succeeds (refetch the list)
 * @param {object}   [opts.countParams] Extra query params used when counting trashed items
 */
export function useTrashSelection({ basePath, items, onDone, countParams }) {
  const [selected, setSelected] = useState(() => new Set());
  const [busy, setBusy] = useState(false);
  const [trashCount, setTrashCount] = useState(0);

  // Drop the selection whenever the visible rows change (page, filters, view switch)
  useEffect(() => {
    setSelected(new Set());
  }, [items]);

  const refreshTrashCount = useCallback(async () => {
    try {
      const { data } = await api.get(basePath, { params: { ...countParams, trashed: true, limit: 1, page: 1 } });
      setTrashCount(data?.pagination?.total || 0);
    } catch {
      // The badge is cosmetic – never block the page on it
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [basePath, JSON.stringify(countParams)]);

  useEffect(() => {
    refreshTrashCount();
  }, [refreshTrashCount, items]);

  const toggle = (id) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const allSelected = items.length > 0 && items.every((i) => selected.has(i.id));
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(items.map((i) => i.id)));
  const clear = () => setSelected(new Set());

  /** Run a bulk action ('trash' | 'restore' | 'purge') on the given ids. */
  const run = async (action, ids = [...selected]) => {
    if (!ids.length) return;
    setBusy(true);
    try {
      const { data } = await api.post(`${basePath}/bulk/${action}`, { ids });
      const r = data?.data || {};
      if (action === 'trash') toast.success(`${r.trashed ?? ids.length} moved to Trash`);
      if (action === 'restore') toast.success(`${r.restored ?? ids.length} restored`);
      if (action === 'purge') {
        toast.success(`${r.purged ?? 0} permanently deleted`);
        if (r.blocked) toast.error(`${r.blocked} kept in Trash because they are used in order history`);
      }
      clear();
      await onDone?.();
      refreshTrashCount();
    } catch (err) {
      toast.error(err.response?.data?.error || err.response?.data?.message || `Failed to ${action}`);
    } finally {
      setBusy(false);
    }
  };

  return { selected, toggle, allSelected, toggleAll, clear, run, busy, trashCount };
}
