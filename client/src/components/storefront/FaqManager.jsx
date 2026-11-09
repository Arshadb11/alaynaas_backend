import { useState, useEffect } from 'react';
import api from '../../services/api';
import { toast } from '../ui/Toast';
import { usePermission } from '../../hooks/usePermission';
import { useBranding } from '../../context/BrandingContext';
import { HiOutlineSave, HiOutlineTrash, HiOutlinePlus, HiOutlineChevronUp, HiOutlineChevronDown } from 'react-icons/hi';

/**
 * PRODUCT FAQ (Storefront sub-module)
 * Questions shown at the bottom of every product page (English + Arabic).
 * Tokens {delivery_days}, {free_over}, {refund_days}, {shipping_fee} are replaced with the live settings.
 */

const inputCls = 'w-full px-3 py-2 rounded-lg text-sm border border-surface-300 dark:border-surface-700 bg-white dark:bg-surface-900 text-surface-900 dark:text-surface-100 disabled:opacity-60';
const labelCls = 'block text-[11px] uppercase tracking-wider text-surface-500 mb-1';
const empty = () => ({ q_en: '', q_ar: '', a_en: '', a_ar: '' });

export default function FaqManager() {
  const canUpdate = usePermission('settings.update');
  const { refreshBranding } = useBranding();
  const [items, setItems] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/settings').then(({ data }) => {
      const f = data.data?.flat || {};
      let v = f.product_faq;
      if (typeof v === 'string') { try { v = JSON.parse(v); } catch { v = []; } }
      setItems(Array.isArray(v) ? v : []);
    }).catch(() => toast.error('Failed to load FAQ'));
  }, []);

  const set = (i, k) => (e) => setItems((l) => l.map((x, j) => (j === i ? { ...x, [k]: e.target.value } : x)));
  const move = (i, d) => setItems((l) => {
    const j = i + d;
    if (j < 0 || j >= l.length) return l;
    const c = [...l];
    [c[i], c[j]] = [c[j], c[i]];
    return c;
  });

  const save = async () => {
    const clean = items.map((x) => Object.fromEntries(Object.entries(x).map(([k, v]) => [k, String(v || '').trim()]))).filter((x) => x.q_en && x.a_en);
    if (clean.length !== items.length && !window.confirm('Rows without an English question and answer will be dropped. Continue?')) return;
    try {
      setSaving(true);
      await api.put('/settings', { product_faq: clean });
      setItems(clean);
      toast.success('FAQ saved');
      refreshBranding?.();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to save FAQ');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900 p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-surface-900 dark:text-surface-100">Product page FAQ</h3>
          <p className="text-xs text-surface-500">Shown on every product page. You can use {'{delivery_days}'}, {'{free_over}'}, {'{refund_days}'} and {'{shipping_fee}'}: they follow your delivery and refund settings. The Arabic fields are optional (English is shown if empty).</p>
        </div>
        {canUpdate && (
          <button type="button" onClick={save} disabled={saving} className="btn-primary inline-flex items-center gap-2 text-sm">
            <HiOutlineSave className="w-4 h-4" /> {saving ? 'Saving…' : 'Save FAQ'}
          </button>
        )}
      </div>

      {items.length === 0 && <p className="text-sm text-surface-500 mb-3">No questions yet. The FAQ block is hidden on the website until you add some.</p>}

      <div className="space-y-3">
        {items.map((it, i) => (
          <div key={i} className="rounded-lg border border-surface-200 dark:border-surface-800 p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-surface-600">Question {i + 1}</p>
              {canUpdate && (
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="p-1 text-surface-500 hover:text-surface-900 disabled:opacity-30" aria-label="Move up"><HiOutlineChevronUp className="w-4 h-4" /></button>
                  <button type="button" onClick={() => move(i, 1)} disabled={i === items.length - 1} className="p-1 text-surface-500 hover:text-surface-900 disabled:opacity-30" aria-label="Move down"><HiOutlineChevronDown className="w-4 h-4" /></button>
                  <button type="button" onClick={() => setItems((l) => l.filter((_, j) => j !== i))} className="p-1 text-red-600 hover:text-red-700" aria-label="Delete"><HiOutlineTrash className="w-4 h-4" /></button>
                </div>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="block"><span className={labelCls}>Question (English)</span><input className={inputCls} disabled={!canUpdate} value={it.q_en || ''} onChange={set(i, 'q_en')} /></label>
              <label className="block"><span className={labelCls}>Question (Arabic)</span><input className={inputCls} dir="rtl" disabled={!canUpdate} value={it.q_ar || ''} onChange={set(i, 'q_ar')} /></label>
              <label className="block"><span className={labelCls}>Answer (English)</span><textarea className={inputCls} rows={3} disabled={!canUpdate} value={it.a_en || ''} onChange={set(i, 'a_en')} /></label>
              <label className="block"><span className={labelCls}>Answer (Arabic)</span><textarea className={inputCls} dir="rtl" rows={3} disabled={!canUpdate} value={it.a_ar || ''} onChange={set(i, 'a_ar')} /></label>
            </div>
          </div>
        ))}
      </div>

      {canUpdate && (
        <button type="button" onClick={() => setItems((l) => [...l, empty()])} className="mt-3 inline-flex items-center gap-2 text-sm text-primary-600 hover:underline">
          <HiOutlinePlus className="w-4 h-4" /> Add a question
        </button>
      )}
    </div>
  );
}
