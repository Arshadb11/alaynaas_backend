import { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import { toast } from '../ui/Toast';
import { usePermission } from '../../hooks/usePermission';
import { useBranding } from '../../context/BrandingContext';
import { STOREFRONT_ORIGIN } from '../../config/env';
import { HiOutlineSave, HiOutlineTrash, HiOutlineGift, HiOutlineSearch, HiOutlinePlus } from 'react-icons/hi';

/**
 * GIFTS MANAGER (Storefront sub-module)
 * The Gift Majlis page (/gifts): free gifts (FOC) won in four quick ways.
 * Flow: Claimed → Approved → Shipped → Delivered (or Rejected). Nothing ships until the team approves it.
 */

const KEYS = ['gifts_enabled', 'gifts_daily_limit', 'gifts_delivery_en', 'gifts_delivery_ar'];
const STATUS = {
  claimed: ['New', 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'],
  approved: ['Approved', 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300'],
  shipped: ['Shipped', 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300'],
  delivered: ['Delivered', 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'],
  rejected: ['Rejected', 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'],
  revealed: ['Not claimed', 'bg-surface-100 text-surface-600 dark:bg-surface-800 dark:text-surface-300'],
};
const MODE = { gift: 'Received a gift', sender: 'Sent a gift (thank-you)', dune: 'Dig the Dune', emirates: 'Seven Emirates', key: 'Golden Key' };
const EMIRATE = { abu_dhabi: 'Abu Dhabi', dubai: 'Dubai', sharjah: 'Sharjah', ajman: 'Ajman', umm_al_quwain: 'Umm Al Quwain', ras_al_khaimah: 'Ras Al Khaimah', fujairah: 'Fujairah' };

const inputCls = 'w-full px-3 py-2 rounded-lg text-sm border border-surface-300 dark:border-surface-700 bg-white dark:bg-surface-900 text-surface-900 dark:text-surface-100 disabled:opacity-60';
const labelCls = 'block text-[11px] uppercase tracking-wider text-surface-500 mb-1';
const cardCls = 'rounded-xl border border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900 p-4';

function Field({ label, hint, children, className = '' }) {
  return (
    <label className={`block ${className}`}>
      <span className={labelCls}>{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-surface-500 mt-1">{hint}</span>}
    </label>
  );
}

function Settings({ canUpdate, today }) {
  const { refreshBranding } = useBranding();
  const [v, setV] = useState(Object.fromEntries(KEYS.map((k) => [k, ''])));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/settings').then(({ data }) => {
      const f = data.data?.flat || {};
      setV(Object.fromEntries(KEYS.map((k) => [k, k === 'gifts_enabled' ? f[k] !== false : (f[k] ?? '')])));
    }).catch(() => toast.error('Failed to load gift settings'));
  }, []);

  const set = (k) => (e) => setV((s) => ({ ...s, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const save = async () => {
    if (!(parseInt(v.gifts_daily_limit, 10) >= 0)) return toast.error('Daily limit must be a number');
    try {
      setSaving(true);
      await api.put('/settings', Object.fromEntries(KEYS.map((k) => [k, k === 'gifts_enabled' ? Boolean(v[k]) : String(v[k] ?? '').trim()])));
      toast.success('Gift settings saved');
      refreshBranding?.();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to save gift settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={cardCls}>
      <div className="flex items-center justify-between mb-3 gap-3">
        <div>
          <h3 className="text-sm font-semibold text-surface-900 dark:text-surface-100">Gift Majlis: free gifts</h3>
          <p className="text-xs text-surface-500">
            Visitors win a free gift in four quick ways at{' '}
            <a className="text-primary-600 hover:underline" href={`${STOREFRONT_ORIGIN}/gifts`} target="_blank" rel="noreferrer">{STOREFRONT_ORIGIN.replace(/^https?:\/\//, '')}/gifts</a>.
            One gift per UAE mobile number. Nothing is sent until you approve it below.
          </p>
        </div>
        {canUpdate && (
          <button type="button" onClick={save} disabled={saving} className="btn-primary inline-flex items-center gap-2 text-sm shrink-0">
            <HiOutlineSave className="w-4 h-4" /> {saving ? 'Saving…' : 'Save'}
          </button>
        )}
      </div>
      <label className="inline-flex items-center gap-2 text-sm text-surface-800 dark:text-surface-200 mb-3">
        <input type="checkbox" disabled={!canUpdate} checked={Boolean(v.gifts_enabled)} onChange={set('gifts_enabled')} /> Gift page is live on the website
      </label>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Field label="Gifts per 24 hours" hint={today ? `${today.left} of ${today.limit} left right now` : 'All four ways together. 0 pauses new gifts.'}>
          <input className={inputCls} inputMode="numeric" disabled={!canUpdate} value={v.gifts_daily_limit} onChange={set('gifts_daily_limit')} />
        </Field>
        <Field label="Delivery note (English)" className="md:col-span-2" hint="Shown under the claim form.">
          <input className={inputCls} disabled={!canUpdate} value={v.gifts_delivery_en} onChange={set('gifts_delivery_en')} />
        </Field>
        <Field label="Delivery note (Arabic)" className="md:col-span-3">
          <input className={inputCls} dir="rtl" disabled={!canUpdate} value={v.gifts_delivery_ar} onChange={set('gifts_delivery_ar')} />
        </Field>
      </div>
    </div>
  );
}

const blankPrize = { name_en: '', name_ar: '', weight: 10, stock: '', active: true };

function PrizeRow({ p, canUpdate, totalWeight, onChanged }) {
  const [v, setV] = useState({ ...p, stock: p.stock ?? '' });
  const dirty = ['name_en', 'name_ar', 'weight', 'stock', 'active'].some((k) => String(v[k] ?? '') !== String((k === 'stock' ? p.stock ?? '' : p[k]) ?? ''));
  const set = (k) => (e) => setV((s) => ({ ...s, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const chance = v.active && totalWeight ? Math.round((Number(v.weight) / totalWeight) * 1000) / 10 : 0;

  const save = async () => {
    const body = { name_en: v.name_en, name_ar: v.name_ar, weight: parseInt(v.weight, 10) || 0, stock: String(v.stock).trim() === '' ? null : parseInt(v.stock, 10) || 0, active: Boolean(v.active), sort: p.sort || 0 };
    try {
      if (p.id) await api.put(`/gifts/prizes/${p.id}`, body); else await api.post('/gifts/prizes', body);
      toast.success('Prize saved');
      onChanged();
    } catch (e) { toast.error(e.response?.data?.details?.[0]?.message || e.response?.data?.error || 'Failed to save prize'); }
  };
  const remove = async () => {
    if (!p.id) return onChanged();
    if (!window.confirm(`Delete prize "${p.name_en}"?`)) return;
    try { await api.delete(`/gifts/prizes/${p.id}`); onChanged(); } catch (e) { toast.error(e.response?.data?.error || 'Failed to delete'); }
  };

  return (
    <div className="grid grid-cols-12 gap-2 items-start py-2 border-t border-surface-200 dark:border-surface-800 first:border-t-0">
      <input className={`${inputCls} col-span-12 md:col-span-4`} placeholder="Prize (English)" disabled={!canUpdate} value={v.name_en} onChange={set('name_en')} />
      <input className={`${inputCls} col-span-12 md:col-span-3`} dir="rtl" placeholder="الجائزة (عربي)" disabled={!canUpdate} value={v.name_ar} onChange={set('name_ar')} />
      <label className="col-span-4 md:col-span-1"><span className="sr-only">Weight</span><input className={inputCls} inputMode="numeric" title="Weight: higher = more often" disabled={!canUpdate} value={v.weight} onChange={set('weight')} /></label>
      <label className="col-span-4 md:col-span-1"><span className="sr-only">Stock</span><input className={inputCls} inputMode="numeric" placeholder="∞" title="Stock left (empty = unlimited)" disabled={!canUpdate} value={v.stock} onChange={set('stock')} /></label>
      <div className="col-span-4 md:col-span-3 flex items-center gap-2 text-xs text-surface-600 dark:text-surface-300">
        <label className="inline-flex items-center gap-1"><input type="checkbox" disabled={!canUpdate} checked={Boolean(v.active)} onChange={set('active')} /> On</label>
        <span className="tabular-nums" title="Chance of winning this prize">{chance}%</span>
        {p.id && <span className="text-surface-500" title="Claimed so far">· {p.given} given</span>}
        {canUpdate && (dirty || !p.id) && <button type="button" onClick={save} className="ml-auto text-primary-600 font-medium hover:underline">Save</button>}
        {canUpdate && <button type="button" onClick={remove} className={`${dirty || !p.id ? '' : 'ml-auto'} text-red-600`} aria-label="Delete prize"><HiOutlineTrash className="w-4 h-4" /></button>}
      </div>
    </div>
  );
}

function Prizes({ canUpdate }) {
  const [items, setItems] = useState([]);
  const [adding, setAdding] = useState(false);
  const load = useCallback(() => {
    api.get('/gifts/prizes').then(({ data }) => setItems(data.data || [])).catch(() => toast.error('Failed to load prizes'));
    setAdding(false);
  }, []);
  useEffect(() => { load(); }, [load]);
  const totalWeight = items.filter((p) => p.active && (p.stock === null || p.stock > 0)).reduce((s, p) => s + p.weight, 0);

  return (
    <div className={cardCls}>
      <div className="flex items-center justify-between mb-1 gap-3">
        <h3 className="text-sm font-semibold text-surface-900 dark:text-surface-100">What people can win</h3>
        {canUpdate && !adding && (
          <button type="button" onClick={() => setAdding(true)} className="inline-flex items-center gap-1 text-xs text-primary-600 font-medium hover:underline"><HiOutlinePlus className="w-4 h-4" /> Add prize</button>
        )}
      </div>
      <p className="text-[11px] text-surface-500 mb-2">
        <b>Weight</b>: higher means won more often (the % shows the real chance). <b>Stock</b>: how many are left, empty means unlimited.
        A prize with stock 0 stops appearing. Keep at least one unlimited prize so nobody is left without a gift.
      </p>
      <div className="hidden md:grid grid-cols-12 gap-2 text-[11px] uppercase tracking-wider text-surface-500 pb-1">
        <span className="col-span-4">Prize (English)</span><span className="col-span-3">Arabic</span><span className="col-span-1">Weight</span><span className="col-span-1">Stock</span><span className="col-span-3">Chance</span>
      </div>
      {items.map((p) => <PrizeRow key={`${p.id}-${p.weight}-${p.stock}-${p.active}-${p.name_en}`} p={p} canUpdate={canUpdate} totalWeight={totalWeight} onChanged={load} />)}
      {adding && <PrizeRow p={blankPrize} canUpdate={canUpdate} totalWeight={totalWeight + 10} onChanged={load} />}
    </div>
  );
}

function waLink(item) {
  const digits = String(item.phone || '').replace(/\D/g, '');
  const ar = item.lang === 'ar';
  const prize = item.prize_en;
  const text = item.mode === 'sender'
    ? (ar
      ? `مرحبًا ${item.name}، معك عطور عاليناء. شكرًا لإهدائك ${item.to_name || ''}، وقد استلم هديته. لك منا هدية أيضًا! أرسل لنا عنوانك (الإمارة والمنطقة) لنوصلها لك مجانًا.`
      : `Hello ${item.name}, this is ALAYNAA'S Parfums. Thank you for sending a gift to ${item.to_name || 'your loved one'}, they've claimed it. You have a gift from us too! Please send your address (emirate and area) and we'll deliver it free.`)
    : (ar
      ? `مرحبًا ${item.name}، معك عطور عاليناء. هديتك المجانية جاهزة: ${prize}. نؤكد التوصيل إلى: ${item.address || ''}، ${EMIRATE[item.emirate] || ''}. هل هذا العنوان صحيح؟`
      : `Hello ${item.name}, this is ALAYNAA'S Parfums. Your free gift is ready: ${prize}. We'll deliver to: ${item.address || ''}, ${EMIRATE[item.emirate] || ''}. Is that address correct?`);
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

function Claim({ item, canUpdate, onChanged }) {
  const [note, setNote] = useState(item.admin_note || '');
  const update = async (body) => {
    try { await api.put(`/gifts/${item.id}`, body); onChanged(); } catch (e) { toast.error(e.response?.data?.error || 'Failed to update'); }
  };
  const remove = async () => {
    if (!window.confirm(`Delete this gift${item.name ? ` for ${item.name}` : ''}?`)) return;
    try { await api.delete(`/gifts/${item.id}`); onChanged(); } catch (e) { toast.error(e.response?.data?.error || 'Failed to delete'); }
  };
  const next = { claimed: ['approved', 'Approve'], approved: ['shipped', 'Mark shipped'], shipped: ['delivered', 'Mark delivered'] }[item.status];

  return (
    <div className="mt-2 rounded-lg bg-surface-50 dark:bg-surface-800 p-3 text-sm space-y-3">
      <div className="grid md:grid-cols-2 gap-3 text-xs">
        <div className="space-y-0.5">
          <p><span className="text-surface-500">Prize:</span> <b>{item.prize_en}</b></p>
          <p><span className="text-surface-500">Won by:</span> {MODE[item.mode] || item.mode}{item.choice ? ` · chose ${EMIRATE[item.choice] || item.choice}` : ''}</p>
          <p><span className="text-surface-500">Address:</span> {item.address ? `${item.address}, ${EMIRATE[item.emirate] || ''}` : <i>Ask on WhatsApp</i>}</p>
          <p><span className="text-surface-500">Language:</span> {item.lang === 'ar' ? 'Arabic' : 'English'}</p>
        </div>
        {(item.mode === 'gift' || item.mode === 'sender') && (
          <div className="space-y-0.5">
            <p><span className="text-surface-500">Gift {item.ref_code}:</span> from {item.from_name} to {item.to_name}</p>
            {item.message && <p className="italic">“{item.message}”</p>}
          </div>
        )}
      </div>
      <div>
        <span className={labelCls}>Team note</span>
        <textarea className={inputCls} rows={2} disabled={!canUpdate} value={note} onChange={(e) => setNote(e.target.value)} onBlur={() => note !== (item.admin_note || '') && update({ admin_note: note })} placeholder="e.g. Confirmed on WhatsApp, courier Thursday" />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {item.phone && <a href={waLink(item)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-600 text-white hover:bg-emerald-700">WhatsApp {item.name?.split(' ')[0]}</a>}
        {canUpdate && next && <button type="button" onClick={() => update({ status: next[0] })} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-primary-600 text-white">{next[1]}</button>}
        {canUpdate && (
          <select className="ml-auto px-2 py-1 rounded-lg text-xs border border-surface-300 dark:border-surface-700 bg-white dark:bg-surface-900" value={item.status} onChange={(e) => update({ status: e.target.value })}>
            {Object.entries(STATUS).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}
          </select>
        )}
        {canUpdate && <button type="button" onClick={remove} className="inline-flex items-center gap-1 text-xs text-red-600 hover:underline"><HiOutlineTrash className="w-3.5 h-3.5" /> Delete</button>}
      </div>
    </div>
  );
}

function Claims({ canUpdate, onToday }) {
  const [data, setData] = useState({ items: [], total: 0, counts: {}, byMode: {}, sent: 0 });
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const { data: d } = await api.get('/gifts', { params: { status: status || undefined, q: q || undefined, limit: 100 } });
      setData(d.data);
      onToday?.(d.data.today);
    } catch {
      toast.error('Failed to load gifts');
    } finally {
      setLoading(false);
    }
  }, [status, q, onToday]);
  useEffect(() => { const t = setTimeout(load, q ? 300 : 0); return () => clearTimeout(t); }, [load, q]);

  const c = data.counts || {};
  const all = (c.claimed || 0) + (c.approved || 0) + (c.shipped || 0) + (c.delivered || 0) + (c.rejected || 0);
  const tabs = [
    ['', `All claims (${all})`], ['claimed', `New (${c.claimed || 0})`], ['approved', `Approved (${c.approved || 0})`],
    ['shipped', `Shipped (${c.shipped || 0})`], ['delivered', `Delivered (${c.delivered || 0})`], ['rejected', 'Rejected'], ['revealed', `Not claimed (${c.revealed || 0})`],
  ];
  const m = data.byMode || {};

  return (
    <div className={cardCls}>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <h3 className="text-sm font-semibold text-surface-900 dark:text-surface-100 inline-flex items-center gap-2"><HiOutlineGift className="w-4 h-4" /> Gift claims</h3>
        <label className="relative">
          <HiOutlineSearch className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-surface-400" />
          <input className={`${inputCls} pl-8 py-1.5 w-56`} placeholder="Name, phone or gift code" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
      </div>
      <p className="text-xs text-surface-500 mb-3">
        Which way people chose: Send a gift {(m.gift || 0) + (m.sender || 0)} (gifts sealed: {data.sent}) · Dig the Dune {m.dune || 0} · Seven Emirates {m.emirates || 0} · Golden Key {m.key || 0}
      </p>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {tabs.map(([k, label]) => (
          <button key={k} type="button" onClick={() => { setStatus(k); setOpen(null); }}
            className={`px-3 py-1 rounded-lg text-xs border ${status === k ? 'bg-primary-600 text-white border-primary-600' : 'border-surface-300 dark:border-surface-700 text-surface-600 dark:text-surface-300'}`}>{label}</button>
        ))}
      </div>
      {loading ? <p className="text-sm text-surface-500">Loading…</p> : data.items.length === 0 ? (
        <p className="text-sm text-surface-500">Nothing here yet.</p>
      ) : (
        <ul className="divide-y divide-surface-200 dark:divide-surface-800">
          {data.items.map((it) => {
            const [label, cls] = STATUS[it.status] || STATUS.revealed;
            return (
              <li key={it.id} className="py-2">
                <button type="button" onClick={() => setOpen(open === it.id ? null : it.id)} className="w-full text-left flex items-start justify-between gap-3">
                  <span className="min-w-0">
                    <span className="text-sm font-medium text-surface-900 dark:text-surface-100">
                      {it.name || <span className="italic text-surface-500">Not claimed yet</span>}
                      {it.phone && <span className="font-normal text-surface-500"> · +{it.phone}</span>}
                      {it.emirate && <span className="font-normal text-surface-500"> · {EMIRATE[it.emirate]}</span>}
                    </span>
                    <span className="block text-xs text-surface-500 truncate">{it.prize_en} · {MODE[it.mode] || it.mode}</span>
                  </span>
                  <span className="flex flex-col items-end gap-1 shrink-0">
                    <span className={`px-2 py-0.5 rounded text-[11px] ${cls}`}>{label}</span>
                    <span className="text-[11px] text-surface-500 whitespace-nowrap">{new Date(it.claimed_at || it.created_at).toLocaleString()}</span>
                  </span>
                </button>
                {open === it.id && <Claim item={it} canUpdate={canUpdate} onChanged={load} />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default function GiftsManager() {
  const canUpdate = usePermission('settings.update');
  const [today, setToday] = useState(null);
  return (
    <div className="space-y-4">
      <Settings canUpdate={canUpdate} today={today} />
      <Prizes canUpdate={canUpdate} />
      <Claims canUpdate={canUpdate} onToday={setToday} />
    </div>
  );
}
