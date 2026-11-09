import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { toast } from '../components/ui/Toast';
import { usePermission } from '../hooks/usePermission';
import {
  HiOutlineCheck, HiOutlineX, HiOutlineTrash, HiOutlineSearch, HiOutlineStar,
  HiOutlinePencil, HiOutlineExternalLink,
} from 'react-icons/hi';

/**
 * PRODUCT REVIEWS (moderation)
 * Shoppers submit reviews on the storefront product page. They stay "pending" until approved here.
 * Only approved reviews are shown on the storefront.
 */

import { STOREFRONT_ORIGIN } from '../config/env';
const TABS = [
  { id: 'pending', label: 'Pending' },
  { id: 'approved', label: 'Approved' },
  { id: 'rejected', label: 'Rejected' },
  { id: '', label: 'All' },
];

const inputCls = 'w-full px-3 py-2 rounded-lg text-sm border border-surface-300 dark:border-surface-700 bg-white dark:bg-surface-900 text-surface-900 dark:text-surface-100';
const badge = {
  pending: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  approved: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
};

function Stars({ value }) {
  return (
    <span className="inline-flex" aria-label={`${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <HiOutlineStar key={n} className={`w-4 h-4 ${n <= value ? 'text-amber-500 fill-amber-400' : 'text-surface-300'}`} style={n <= value ? { fill: 'currentColor' } : undefined} />
      ))}
    </span>
  );
}

function EditModal({ review, onClose, onSave }) {
  const [f, setF] = useState({ name: review.name, title: review.title || '', body: review.body, rating: review.rating });
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  const submit = async () => {
    setSaving(true);
    try { await onSave(review.id, { ...f, rating: Number(f.rating) }); onClose(); } finally { setSaving(false); }
  };
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-xl bg-white dark:bg-surface-900 p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-semibold text-surface-900 dark:text-surface-100">Edit review</h3>
        <input className={inputCls} value={f.name} onChange={set('name')} placeholder="Name" />
        <select className={inputCls} value={f.rating} onChange={set('rating')}>
          {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} star{n > 1 ? 's' : ''}</option>)}
        </select>
        <input className={inputCls} value={f.title} onChange={set('title')} placeholder="Title (optional)" />
        <textarea className={inputCls} rows={6} value={f.body} onChange={set('body')} />
        <div className="flex justify-end gap-2">
          <button type="button" className="px-4 py-2 text-sm rounded-lg border border-surface-300 dark:border-surface-700" onClick={onClose}>Cancel</button>
          <button type="button" className="btn-primary text-sm" disabled={saving} onClick={submit}>{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
    </div>
  );
}

export default function Reviews() {
  const canUpdate = usePermission('products.update');
  const [status, setStatus] = useState('pending');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ reviews: [], total: 0, limit: 20, counts: { pending: 0, approved: 0, rejected: 0 } });
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const { data: res } = await api.get('/reviews', { params: { status: status || undefined, q: q || undefined, page } });
      setData(res.data);
    } catch {
      toast.error('Failed to load reviews');
    } finally {
      setLoading(false);
    }
  }, [status, q, page]);

  useEffect(() => { const t = setTimeout(load, q ? 300 : 0); return () => clearTimeout(t); }, [load, q]);

  const update = async (id, body) => {
    try {
      await api.put(`/reviews/${id}`, body);
      toast.success(body.status ? `Review ${body.status}` : 'Review updated');
      load();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Update failed');
      throw e;
    }
  };

  const remove = async (r) => {
    if (!window.confirm(`Delete the review by ${r.name}? This cannot be undone.`)) return;
    try {
      await api.delete(`/reviews/${r.id}`);
      toast.success('Review deleted');
      load();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Delete failed');
    }
  };

  const pages = Math.max(1, Math.ceil(data.total / data.limit));
  const countFor = (id) => (id ? data.counts[id] : data.counts.pending + data.counts.approved + data.counts.rejected);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-surface-900 dark:text-surface-100">Product Reviews</h1>
        <p className="text-sm text-surface-500">Approve reviews to show them on the product page. Rejected and pending reviews are never public.</p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 border-b border-surface-200 dark:border-surface-800">
          {TABS.map((t) => (
            <button key={t.id || 'all'} type="button" onClick={() => { setStatus(t.id); setPage(1); }}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition ${status === t.id ? 'border-primary-500 text-primary-600 dark:text-primary-400' : 'border-transparent text-surface-500 hover:text-surface-800 dark:hover:text-surface-200'}`}>
              {t.label} <span className="ml-1 text-xs opacity-70">({countFor(t.id)})</span>
            </button>
          ))}
        </div>
        <div className="relative">
          <HiOutlineSearch className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
          <input className={`${inputCls} pl-9 w-64`} placeholder="Search name, email, product…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-surface-500">Loading…</p>
      ) : data.reviews.length === 0 ? (
        <div className="rounded-xl border border-dashed border-surface-300 dark:border-surface-700 p-10 text-center text-sm text-surface-500">
          No reviews here.
        </div>
      ) : (
        <ul className="space-y-3">
          {data.reviews.map((r) => (
            <li key={r.id} className="rounded-xl border border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Stars value={r.rating} />
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium capitalize ${badge[r.status]}`}>{r.status}</span>
                    <a href={`${STOREFRONT_ORIGIN}/fragrance/${r.product_slug}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-primary-600 hover:underline">
                      {r.product_name} <HiOutlineExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                  {r.title && <p className="mt-2 font-medium text-surface-900 dark:text-surface-100">{r.title}</p>}
                  <p className="mt-1 text-sm text-surface-700 dark:text-surface-300 whitespace-pre-line break-words">{r.body}</p>
                  <p className="mt-2 text-xs text-surface-500">
                    {r.name} · {r.email} · {new Date(r.created_at).toLocaleString()}
                  </p>
                </div>
                {canUpdate && (
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {r.status !== 'approved' && (
                      <button type="button" onClick={() => update(r.id, { status: 'approved' })} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs bg-emerald-600 text-white hover:bg-emerald-700">
                        <HiOutlineCheck className="w-4 h-4" /> Approve
                      </button>
                    )}
                    {r.status !== 'rejected' && (
                      <button type="button" onClick={() => update(r.id, { status: 'rejected' })} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs border border-surface-300 dark:border-surface-700 text-surface-700 dark:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-800">
                        <HiOutlineX className="w-4 h-4" /> Reject
                      </button>
                    )}
                    <button type="button" title="Edit" onClick={() => setEditing(r)} className="p-2 rounded-lg border border-surface-300 dark:border-surface-700 text-surface-600 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-800">
                      <HiOutlinePencil className="w-4 h-4" />
                    </button>
                    <button type="button" title="Delete" onClick={() => remove(r)} className="p-2 rounded-lg border border-surface-300 dark:border-surface-700 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20">
                      <HiOutlineTrash className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-center gap-3 text-sm">
          <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1.5 rounded-lg border border-surface-300 dark:border-surface-700 disabled:opacity-40">Previous</button>
          <span className="text-surface-500">Page {page} of {pages}</span>
          <button type="button" disabled={page >= pages} onClick={() => setPage((p) => p + 1)} className="px-3 py-1.5 rounded-lg border border-surface-300 dark:border-surface-700 disabled:opacity-40">Next</button>
        </div>
      )}

      {editing && <EditModal review={editing} onClose={() => setEditing(null)} onSave={update} />}
    </div>
  );
}
