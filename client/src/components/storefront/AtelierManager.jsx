import { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import { toast } from '../ui/Toast';
import { usePermission } from '../../hooks/usePermission';
import { useBranding } from '../../context/BrandingContext';
import { STOREFRONT_ORIGIN } from '../../config/env';
import { HiOutlineSave, HiOutlineTrash, HiOutlineSparkles, HiOutlineExternalLink, HiOutlineSearch } from 'react-icons/hi';

/**
 * ATELIER MANAGER (Storefront sub-module)
 * Settings for the Atelier page (/atelier): customers answer a few questions and receive their
 * Crown Ritual, a layering of real products (oil + perfume + bakhoor) with three more matches.
 * Ordering the whole ritual takes the discount below; the order note tells the team to add the gift.
 */

const KEYS = ['atelier_enabled', 'atelier_ritual_discount', 'atelier_gift_en', 'atelier_gift_ar'];
const STATUS = {
  created: ['Created', 'bg-surface-100 text-surface-600 dark:bg-surface-800 dark:text-surface-300'],
  reserved: ['Reserved', 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'],
  contacted: ['Contacted', 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300'],
  ordered: ['Ordered', 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'],
  gift_given: ['Gift given', 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300'],
  archived: ['Archived', 'bg-surface-100 text-surface-500 dark:bg-surface-800 dark:text-surface-400'],
};
const ANSWER_LABELS = {
  who: 'For', mood: 'Mood', place: 'Place', occasion: 'Occasion', loves: 'Loves', avoid: 'Avoids', intensity: 'Intensity (1-5)',
};

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

function Settings({ canUpdate }) {
  const { refreshBranding } = useBranding();
  const [v, setV] = useState(Object.fromEntries(KEYS.map((k) => [k, ''])));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/settings').then(({ data }) => {
      const f = data.data?.flat || {};
      setV(Object.fromEntries(KEYS.map((k) => [k, k === 'atelier_enabled' ? f[k] !== false : (f[k] ?? '')])));
    }).catch(() => toast.error('Failed to load Atelier settings'));
  }, []);

  const set = (k) => (e) => setV((s) => ({ ...s, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const save = async () => {
    const d = String(v.atelier_ritual_discount ?? '').trim();
    if (d && !(Number(d) >= 0 && Number(d) <= 50)) return toast.error('Ritual discount must be a number from 0 to 50');
    try {
      setSaving(true);
      await api.put('/settings', Object.fromEntries(KEYS.map((k) => [k, k === 'atelier_enabled' ? Boolean(v[k]) : String(v[k] ?? '').trim()])));
      toast.success('Atelier settings saved');
      refreshBranding?.();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to save Atelier settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={cardCls}>
      <div className="flex items-center justify-between mb-3 gap-3">
        <div>
          <h3 className="text-sm font-semibold text-surface-900 dark:text-surface-100">Atelier: the Crown Ritual</h3>
          <p className="text-xs text-surface-500">
            Customers answer a few questions at{' '}
            <a className="text-primary-600 hover:underline" href={`${STOREFRONT_ORIGIN}/atelier`} target="_blank" rel="noreferrer">{STOREFRONT_ORIGIN.replace(/^https?:\/\//, '')}/atelier</a>{' '}
            and receive their Crown Ritual: an oil, a perfume and bakhoor from your shop that suit them, plus three more matches.
            Products are chosen from their notes and fragrance families, so keep those filled in on each product.
            When the whole ritual is ordered together, the discount below is applied and the order note says to add the gift.
          </p>
        </div>
        {canUpdate && (
          <button type="button" onClick={save} disabled={saving} className="btn-primary inline-flex items-center gap-2 text-sm shrink-0">
            <HiOutlineSave className="w-4 h-4" /> {saving ? 'Saving…' : 'Save'}
          </button>
        )}
      </div>
      <label className="inline-flex items-center gap-2 text-sm text-surface-800 dark:text-surface-200 mb-3">
        <input type="checkbox" disabled={!canUpdate} checked={Boolean(v.atelier_enabled)} onChange={set('atelier_enabled')} /> Atelier page is live on the website
      </label>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Field label="Ritual discount (%)" hint="Off the ritual products when all are ordered together. 0 = no discount.">
          <input className={inputCls} inputMode="decimal" disabled={!canUpdate} value={v.atelier_ritual_discount} onChange={set('atelier_ritual_discount')} />
        </Field>
        <Field label="Gift with the ritual (English)" className="md:col-span-3" hint="Shown under the ritual on the result page. Leave empty to hide.">
          <input className={inputCls} disabled={!canUpdate} value={v.atelier_gift_en} onChange={set('atelier_gift_en')} />
        </Field>
        <Field label="Gift with the ritual (Arabic)" className="md:col-span-3">
          <input className={inputCls} dir="rtl" disabled={!canUpdate} value={v.atelier_gift_ar} onChange={set('atelier_gift_ar')} />
        </Field>
      </div>
    </div>
  );
}

function waLink(item) {
  const digits = String(item.phone || '').replace(/\D/g, '');
  const name = item.formula?.name || {};
  const text = item.lang === 'ar'
    ? `مرحبًا ${item.name}، معك عطور عاليناء. شكرًا لتركيب عطرك «${name.ar}» (${item.code}). يسعدنا تجهيزه لك، ومعه هديتك المجانية.`
    : `Hello ${item.name}, this is ALAYNAA'S Parfums. Thank you for composing "${name.en}" (${item.code}). We'd love to prepare it for you, together with your complimentary gift.`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

function Lead({ item, canUpdate, onChanged }) {
  const [note, setNote] = useState(item.admin_note || '');
  const f = item.formula || {};
  const [label, cls] = STATUS[item.status] || STATUS.created;

  const update = async (body) => {
    try {
      await api.put(`/atelier/${item.id}`, body);
      onChanged();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to update');
    }
  };
  const remove = async () => {
    if (!window.confirm(`Delete creation ${item.code}${item.name ? ` (${item.name})` : ''}?`)) return;
    try { await api.delete(`/atelier/${item.id}`); onChanged(); } catch (e) { toast.error(e.response?.data?.error || 'Failed to delete'); }
  };

  return (
    <div className="mt-2 rounded-lg bg-surface-50 dark:bg-surface-800 p-3 text-sm space-y-3">
      <div className="grid md:grid-cols-2 gap-3">
        <div>
          <p className="font-semibold text-surface-900 dark:text-surface-100">{f.name?.en} <span className="font-normal text-surface-500" dir="rtl">· {f.name?.ar}</span></p>
          <p className="text-xs text-surface-500">{(f.accords || []).slice(0, 3).map((a) => a.en).join(', ')}{item.label_name ? ` · Name on the bottle: "${item.label_name}"` : ''}</p>
          <p className="text-xs text-surface-500 mt-1">Open the result page to see the ritual and matches.</p>
        </div>
        <div className="text-xs space-y-0.5">
          {Object.entries(ANSWER_LABELS).map(([k, l]) => {
            const val = item.answers?.[k];
            const txt = Array.isArray(val) ? val.join(', ') : val;
            return txt ? <p key={k}><span className="text-surface-500">{l}:</span> {String(txt).replace(/_/g, ' ')}</p> : null;
          })}
          {item.email && <p><span className="text-surface-500">Email:</span> {item.email}</p>}
        </div>
      </div>
      <div>
        <span className={labelCls}>Team note</span>
        <textarea className={inputCls} rows={2} disabled={!canUpdate} value={note} onChange={(e) => setNote(e.target.value)} onBlur={() => note !== (item.admin_note || '') && update({ admin_note: note })} placeholder="e.g. Called, wants 50ml, delivery Friday" />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {item.phone && (
          <a href={waLink(item)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-600 text-white hover:bg-emerald-700">WhatsApp {item.name?.split(' ')[0]}</a>
        )}
        <a href={`${STOREFRONT_ORIGIN}/atelier/${item.code}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary-600 hover:underline"><HiOutlineExternalLink className="w-3.5 h-3.5" /> View result page</a>
        <span className={`ml-auto px-2 py-0.5 rounded text-[11px] ${cls}`}>{label}</span>
        {canUpdate && (
          <select className="px-2 py-1 rounded-lg text-xs border border-surface-300 dark:border-surface-700 bg-white dark:bg-surface-900" value={item.status} onChange={(e) => update({ status: e.target.value })}>
            {Object.entries(STATUS).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}
          </select>
        )}
        {canUpdate && <button type="button" onClick={remove} className="inline-flex items-center gap-1 text-xs text-red-600 hover:underline"><HiOutlineTrash className="w-3.5 h-3.5" /> Delete</button>}
      </div>
    </div>
  );
}

function Leads({ canUpdate }) {
  const [data, setData] = useState({ items: [], total: 0, counts: {} });
  const [status, setStatus] = useState('all');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const { data: d } = await api.get('/atelier', { params: { status: status || undefined, q: q || undefined, limit: 100 } });
      setData(d.data);
    } catch {
      toast.error('Failed to load Atelier leads');
    } finally {
      setLoading(false);
    }
  }, [status, q]);
  useEffect(() => { const t = setTimeout(load, q ? 300 : 0); return () => clearTimeout(t); }, [load, q]);

  const c = data.counts || {};
  const leads = (c.reserved || 0) + (c.contacted || 0) + (c.ordered || 0) + (c.gift_given || 0);
  const tabs = [
    ['all', `All creations (${leads + (c.created || 0)})`], ['ordered', `Ordered (${c.ordered || 0})`], ['gift_given', 'Gift given'],
    ...(c.reserved || c.contacted ? [['', `Old reservations (${(c.reserved || 0) + (c.contacted || 0)})`]] : []),
    ['archived', 'Archived'],
  ];

  return (
    <div className={cardCls}>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h3 className="text-sm font-semibold text-surface-900 dark:text-surface-100 inline-flex items-center gap-2"><HiOutlineSparkles className="w-4 h-4" /> Creations</h3>
        <label className="relative">
          <HiOutlineSearch className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-surface-400" />
          <input className={`${inputCls} pl-8 py-1.5 w-56`} placeholder="Code, name or phone" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
      </div>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {tabs.map(([k, label]) => (
          <button key={k} type="button" onClick={() => { setStatus(k); setOpen(null); }}
            className={`px-3 py-1 rounded-lg text-xs border ${status === k ? 'bg-primary-600 text-white border-primary-600' : 'border-surface-300 dark:border-surface-700 text-surface-600 dark:text-surface-300'}`}>{label}</button>
        ))}
      </div>
      <p className="text-[11px] text-surface-500 mb-2">Every result people created. A creation turns "Ordered" by itself when its whole ritual is ordered, and the order number is added to its note.</p>
      {loading ? <p className="text-sm text-surface-500">Loading…</p> : data.items.length === 0 ? (
        <p className="text-sm text-surface-500">Nothing here yet.</p>
      ) : (
        <ul className="divide-y divide-surface-200 dark:divide-surface-800">
          {data.items.map((it) => {
            const [label, cls] = STATUS[it.status] || STATUS.created;
            return (
              <li key={it.id} className="py-2">
                <button type="button" onClick={() => setOpen(open === it.id ? null : it.id)} className="w-full text-left flex items-start justify-between gap-3">
                  <span className="min-w-0">
                    <span className="text-sm font-medium text-surface-900 dark:text-surface-100">
                      <span className="font-mono text-xs text-surface-500 mr-2">{it.code}</span>
                      {it.name || <span className="italic text-surface-500">Anonymous</span>}
                      {it.phone && <span className="font-normal text-surface-500"> · {it.phone}</span>}
                      {it.size && <span className="font-normal text-surface-500"> · {it.size}ml</span>}
                    </span>
                    <span className="block text-xs text-surface-500 truncate">{it.formula?.name?.en} · {(it.formula?.accords || []).slice(0, 3).map((a) => a.en).join(', ')}</span>
                  </span>
                  <span className="flex flex-col items-end gap-1 shrink-0">
                    <span className={`px-2 py-0.5 rounded text-[11px] ${cls}`}>{label}</span>
                    <span className="text-[11px] text-surface-500 whitespace-nowrap">{new Date(it.reserved_at || it.created_at).toLocaleString()}</span>
                  </span>
                </button>
                {open === it.id && <Lead item={it} canUpdate={canUpdate} onChanged={load} />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default function AtelierManager() {
  const canUpdate = usePermission('settings.update');
  return (
    <div className="space-y-4">
      <Settings canUpdate={canUpdate} />
      <Leads canUpdate={canUpdate} />
    </div>
  );
}
