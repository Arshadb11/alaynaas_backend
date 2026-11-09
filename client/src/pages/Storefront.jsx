import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { toast } from '../components/ui/Toast';
import { usePermission } from '../hooks/usePermission';
import { useBranding } from '../context/BrandingContext';
import {
  HiOutlineSpeakerphone,
  HiOutlineSave,
  HiOutlinePlus,
  HiOutlineTrash,
  HiOutlineArrowUp,
  HiOutlineArrowDown,
  HiOutlineRefresh,
  HiOutlineTemplate,
  HiOutlinePhotograph,
  HiOutlineDocumentText,
} from 'react-icons/hi';
import HeroSliderManager from '../components/storefront/HeroSliderManager';
import HouseDisciplinesManager from '../components/storefront/HouseDisciplinesManager';
import PagesManager from '../components/storefront/PagesManager';
import JournalManager from '../components/storefront/JournalManager';
import ContactManager from '../components/storefront/ContactManager';
import FaqManager from '../components/storefront/FaqManager';
import { STOREFRONT_PAGES } from '../config/storefrontPages';

/**
 * STOREFRONT CONTENT MODULE
 *
 * Home for everything that shapes what customers see on the storefront but is not
 * a product/catalog record. Add a new sub-module by appending an entry to SECTIONS
 * (id, label, icon, component) - the tab bar and routing need no other change.
 */

const MAX_ITEMS = 10;
const MAX_LEN = 120;


/* ───────────── Sub-module: Announcement Bar (pre-header marquee) ───────────── */
function AnnouncementBar() {
  const canUpdate = usePermission('settings.update');
  const { refreshBranding } = useBranding();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [speed, setSpeed] = useState(48);
  const [items, setItems] = useState([]);
  const [freeOver, setFreeOver] = useState(0);
  const [shippingFee, setShippingFee] = useState(0);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/settings');
      const flat = data.data?.flat || {};
      setEnabled(flat.marquee_enabled !== false);
      setSpeed(Number(flat.marquee_speed) || 48);
      setItems(Array.isArray(flat.marquee_items) ? flat.marquee_items : []);
      setFreeOver(Number(flat.shipping_free_over) || 0);
      setShippingFee(Number(flat.shipping_fee) || 0);
    } catch {
      toast.error('Failed to load announcement bar settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const update = (i, patch) => setItems((prev) => prev.map((m, idx) => (idx === i ? { ...m, ...patch } : m)));
  const remove = (i) => setItems((prev) => prev.filter((_, idx) => idx !== i));
  const add = () => setItems((prev) => (prev.length >= MAX_ITEMS ? prev : [...prev, { en: '', ar: '', active: true, link_en: '', link_ar: '', url: '' }]));
  const move = (i, dir) => setItems((prev) => {
    const j = i + dir;
    if (j < 0 || j >= prev.length) return prev;
    const next = [...prev];
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  });

  const handleSave = async () => {
    if (items.some((m) => !m.en.trim())) {
      toast.warning('Every message needs an English text (or remove the empty row)');
      return;
    }
    if (items.some((m) => (m.link_en || m.link_ar) && !(m.url || '').trim())) {
      toast.warning('A message has link text but no link - add the page/URL or clear the link text');
      return;
    }
    if (items.some((m) => (m.url || '').trim() && !/^(\/(?!\/)|https?:\/\/)/i.test(m.url.trim()))) {
      toast.warning('Links must start with / (a page on your site) or https://');
      return;
    }
    try {
      setSaving(true);
      await api.put('/settings', {
        marquee_enabled: enabled,
        marquee_speed: speed,
        marquee_items: items,
      });
      toast.success('Announcement bar saved - live on the storefront');
      refreshBranding();
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save announcement bar');
    } finally {
      setSaving(false);
    }
  };

  // Same token substitution the storefront performs, so the preview matches.
  const preview = (s) => String(s || '')
    .replace('{free_over}', `AED ${freeOver}`)
    .replace('{shipping_fee}', `AED ${shippingFee}`);
  const previewItems = items.filter((m) => m.active !== false && m.en.trim());

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center gap-3 text-surface-500">
        <HiOutlineRefresh className="w-5 h-5 animate-spin text-primary-500" />
        <span className="text-sm">Loading announcement bar…</span>
      </div>
    );
  }

  const inputCls = 'w-full px-3 py-2 rounded-lg text-sm border border-surface-300 dark:border-surface-700 bg-white dark:bg-surface-900 text-surface-900 dark:text-surface-100 disabled:opacity-60';
  const iconBtn = 'p-1.5 rounded-lg border border-surface-300 dark:border-surface-700 text-surface-600 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-800 disabled:opacity-40 transition';

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h3 className="text-base font-bold text-surface-900 dark:text-surface-100">Announcement Bar (Pre-Header)</h3>
          <p className="text-xs text-surface-500 dark:text-surface-400 mt-1">
            The scrolling strip above the storefront header. Use <code className="font-mono">{'{free_over}'}</code> and{' '}
            <code className="font-mono">{'{shipping_fee}'}</code> to insert live values from Shipping settings.
          </p>
        </div>
        {canUpdate && (
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="py-2 px-4 rounded-lg text-sm font-medium bg-primary-600 hover:bg-primary-700 text-white flex items-center gap-2 disabled:opacity-50 transition"
          >
            <HiOutlineSave className="w-4 h-4" />
            {saving ? 'Saving…' : 'Save Announcement Bar'}
          </button>
        )}
      </div>

      {/* Live preview */}
      <div className="rounded-xl overflow-hidden border border-surface-200 dark:border-surface-800">
        <p className="px-4 py-2 text-[11px] uppercase tracking-wider text-surface-500 bg-surface-50 dark:bg-surface-850">Preview</p>
        {enabled && previewItems.length > 0 ? (
          <div className="bg-[#0b0a09] text-[#e9e2d6] py-2.5 px-4 flex items-center gap-6 overflow-x-auto whitespace-nowrap text-[11px] uppercase tracking-[0.2em]">
            {previewItems.map((m, i) => (
              <span key={i} className="flex items-center gap-6">
                <span>
                  {preview(m.en)}
                  {m.url && (m.link_en || '').trim() && (
                    <span className="ml-2 underline underline-offset-4 text-primary-300">{m.link_en}</span>
                  )}
                </span>
                <span className="w-1 h-1 rotate-45 bg-primary-400 inline-block" />
              </span>
            ))}
          </div>
        ) : (
          <p className="px-4 py-4 text-sm text-surface-500">The bar is hidden on the storefront.</p>
        )}
      </div>

      {/* Global options */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label className="flex items-center justify-between gap-3 p-4 rounded-xl border border-surface-200 dark:border-surface-800">
          <span>
            <span className="block text-sm font-semibold text-surface-900 dark:text-surface-100">Show announcement bar</span>
            <span className="block text-xs text-surface-500">Turn off to remove the strip and its spacing.</span>
          </span>
          <input type="checkbox" className="w-5 h-5 accent-primary-600" checked={enabled} disabled={!canUpdate} onChange={(e) => setEnabled(e.target.checked)} />
        </label>
        <label className="p-4 rounded-xl border border-surface-200 dark:border-surface-800 block">
          <span className="block text-sm font-semibold text-surface-900 dark:text-surface-100">Scroll duration (seconds)</span>
          <span className="block text-xs text-surface-500 mb-2">One full loop. Higher is slower (10–300).</span>
          <input type="number" min="10" max="300" className={inputCls} value={speed} disabled={!canUpdate} onChange={(e) => setSpeed(e.target.value === '' ? '' : Number(e.target.value))} />
        </label>
      </div>

      {/* Messages */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-surface-900 dark:text-surface-100">Messages ({items.length}/{MAX_ITEMS})</h4>
          {canUpdate && (
            <button type="button" onClick={add} disabled={items.length >= MAX_ITEMS} className="text-xs font-medium flex items-center gap-1.5 text-primary-600 hover:text-primary-700 disabled:opacity-40">
              <HiOutlinePlus className="w-4 h-4" /> Add message
            </button>
          )}
        </div>

        <datalist id="mq-pages">
          {STOREFRONT_PAGES.map((p) => <option key={p.path} value={p.path}>{p.label}</option>)}
        </datalist>

        {items.length === 0 && (
          <p className="text-sm text-surface-500 p-4 rounded-xl border border-dashed border-surface-300 dark:border-surface-700">
            No messages yet - the storefront will fall back to its built-in messages.
          </p>
        )}

        {items.map((m, i) => (
          <div key={i} className="p-4 rounded-xl border border-surface-200 dark:border-surface-800 bg-surface-50/50 dark:bg-surface-850 grid grid-cols-1 lg:grid-cols-[1fr_1fr_auto] gap-3 items-start">
            <label className="block">
              <span className="block text-[11px] uppercase tracking-wider text-surface-500 mb-1">English</span>
              <input className={inputCls} maxLength={MAX_LEN} value={m.en} disabled={!canUpdate} onChange={(e) => update(i, { en: e.target.value })} placeholder="e.g. Free delivery over {free_over}" />
            </label>
            <label className="block">
              <span className="block text-[11px] uppercase tracking-wider text-surface-500 mb-1">Arabic</span>
              <input dir="rtl" className={inputCls} maxLength={MAX_LEN} value={m.ar} disabled={!canUpdate} onChange={(e) => update(i, { ar: e.target.value })} placeholder="يظهر عند اختيار العربية" />
            </label>
            <div className="flex items-center gap-2 lg:pt-6">
              <label className="flex items-center gap-1.5 text-xs text-surface-600 dark:text-surface-300">
                <input type="checkbox" className="accent-primary-600" checked={m.active !== false} disabled={!canUpdate} onChange={(e) => update(i, { active: e.target.checked })} />
                Active
              </label>
              <button type="button" className={iconBtn} disabled={!canUpdate || i === 0} onClick={() => move(i, -1)} title="Move up"><HiOutlineArrowUp className="w-4 h-4" /></button>
              <button type="button" className={iconBtn} disabled={!canUpdate || i === items.length - 1} onClick={() => move(i, 1)} title="Move down"><HiOutlineArrowDown className="w-4 h-4" /></button>
              <button type="button" className={`${iconBtn} hover:!text-red-500`} disabled={!canUpdate} onClick={() => remove(i)} title="Delete"><HiOutlineTrash className="w-4 h-4" /></button>
            </div>

            {/* Optional call-to-action link */}
            <div className="lg:col-span-3 grid grid-cols-1 lg:grid-cols-[1fr_1fr_1.4fr] gap-3 pt-3 border-t border-surface-200 dark:border-surface-800">
              <label className="block">
                <span className="block text-[11px] uppercase tracking-wider text-surface-500 mb-1">Link text (English)</span>
                <input className={inputCls} maxLength={30} value={m.link_en || ''} disabled={!canUpdate} onChange={(e) => update(i, { link_en: e.target.value })} placeholder="e.g. Explore, Shop Now" />
              </label>
              <label className="block">
                <span className="block text-[11px] uppercase tracking-wider text-surface-500 mb-1">Link text (Arabic)</span>
                <input dir="rtl" className={inputCls} maxLength={30} value={m.link_ar || ''} disabled={!canUpdate} onChange={(e) => update(i, { link_ar: e.target.value })} placeholder="استكشف" />
              </label>
              <label className="block">
                <span className="block text-[11px] uppercase tracking-wider text-surface-500 mb-1">Link to (page or URL)</span>
                <input list="mq-pages" className={inputCls} maxLength={300} value={m.url || ''} disabled={!canUpdate} onChange={(e) => update(i, { url: e.target.value })} placeholder="/discover or https://..." />
              </label>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ───────────── Module registry: add future sub-modules here ───────────── */
const SECTIONS = [
  { id: 'hero', label: 'Hero Slider', icon: HiOutlinePhotograph, component: HeroSliderManager },
  { id: 'disciplines', label: 'House Disciplines', icon: HiOutlineTemplate, component: HouseDisciplinesManager },
  { id: 'journal', label: 'Journal', icon: HiOutlineDocumentText, component: JournalManager },
  { id: 'contact', label: 'Contact', icon: HiOutlineSpeakerphone, component: ContactManager },
  { id: 'faq', label: 'Product FAQ', icon: HiOutlineSpeakerphone, component: FaqManager },
  { id: 'pages', label: 'Pages', icon: HiOutlineDocumentText, component: PagesManager },
  { id: 'announcement', label: 'Announcement Bar', icon: HiOutlineSpeakerphone, component: AnnouncementBar },
];

export default function Storefront() {
  const [active, setActive] = useState(SECTIONS[0].id);
  const Section = SECTIONS.find((s) => s.id === active)?.component || AnnouncementBar;

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto space-y-6">
      <div>
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary-500">
          <HiOutlineTemplate className="w-4 h-4" /> Storefront Content
        </p>
        <h1 className="text-2xl font-bold text-surface-900 dark:text-white">Storefront</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400">Control the extra content customers see around your products.</p>
      </div>

      <div className="flex gap-2 border-b border-surface-200 dark:border-surface-800 overflow-x-auto">
        {SECTIONS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActive(id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition ${
              active === id
                ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                : 'border-transparent text-surface-500 hover:text-surface-800 dark:hover:text-surface-200'
            }`}
          >
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      <div className="p-5 sm:p-6 rounded-2xl border border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900">
        <Section />
      </div>
    </div>
  );
}
