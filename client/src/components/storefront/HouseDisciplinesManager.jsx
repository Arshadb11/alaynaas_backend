import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../../services/api';
import { toast } from '../ui/Toast';
import { usePermission } from '../../hooks/usePermission';
import { useBranding } from '../../context/BrandingContext';
import { STOREFRONT_PAGES } from '../../config/storefrontPages';
import {
  HiOutlineSave,
  HiOutlinePlus,
  HiOutlineTrash,
  HiOutlineArrowUp,
  HiOutlineArrowDown,
  HiOutlineRefresh,
  HiOutlineUpload,
  HiOutlinePhotograph,
} from 'react-icons/hi';

/**
 * HOUSE DISCIPLINES MANAGER (Storefront sub-module)
 *
 * Edits the `house_disciplines` setting that drives the homepage "House Disciplines" section:
 * section heading texts + a list of category cards (category, image, texts, link).
 * The server re-validates and sanitizes everything on save (see _sanitizeHouseDisciplines).
 */

const MAX_ITEMS = 8;
const API_ORIGIN = import.meta.env.VITE_API_ORIGIN || 'http://localhost:3000';
const STOREFRONT_ORIGIN = import.meta.env.VITE_STOREFRONT_URL || 'http://localhost:3001';

const blankItem = () => ({
  category_slug: '', active: true, img: '', href: '',
  tagline_en: '', tagline_ar: '', title_en: '', title_ar: '', desc_en: '', desc_ar: '', cta_en: '', cta_ar: '',
});
const blankHead = () => ({ kicker_en: '', kicker_ar: '', heading_en: '', heading_ar: '', sub_en: '', sub_ar: '' });

const previewSrc = (img) => {
  if (!img) return '';
  if (/^https?:\/\//i.test(img)) return img;
  if (img.startsWith('/images/')) return `${STOREFRONT_ORIGIN}${img}`;
  if (img.startsWith('/')) return `${API_ORIGIN}${img}`;
  return `${API_ORIGIN}/uploads/${img}`;
};

const inputCls = 'w-full px-3 py-2 rounded-lg text-sm border border-surface-300 dark:border-surface-700 bg-white dark:bg-surface-900 text-surface-900 dark:text-surface-100 disabled:opacity-60';
const iconBtn = 'p-1.5 rounded-lg border border-surface-300 dark:border-surface-700 text-surface-600 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-800 disabled:opacity-40 transition';
const labelCls = 'block text-[11px] uppercase tracking-wider text-surface-500 mb-1';

function Field({ label, children }) {
  return (
    <label className="block">
      <span className={labelCls}>{label}</span>
      {children}
    </label>
  );
}

export default function HouseDisciplinesManager() {
  const canUpdate = usePermission('settings.update');
  const { refreshBranding } = useBranding();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingIdx, setUploadingIdx] = useState(null);
  const [head, setHead] = useState(blankHead());
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const fileRef = useRef(null);
  const uploadIdx = useRef(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [s, c] = await Promise.all([api.get('/settings'), api.get('/catalog/categories?flat=true')]);
      const hd = s.data.data?.flat?.house_disciplines || {};
      setHead({ ...blankHead(), ...hd });
      setItems(Array.isArray(hd.items) ? hd.items.map((i) => ({ ...blankItem(), ...i })) : []);
      setCategories(c.data?.data || []);
    } catch {
      toast.error('Failed to load House Disciplines settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const update = (i, patch) => setItems((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  const remove = (i) => setItems((prev) => prev.filter((_, idx) => idx !== i));
  const add = () => setItems((prev) => (prev.length >= MAX_ITEMS ? prev : [...prev, blankItem()]));
  const move = (i, dir) => setItems((prev) => {
    const j = i + dir;
    if (j < 0 || j >= prev.length) return prev;
    const next = [...prev];
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  });

  const catOf = (slug) => categories.find((c) => c.slug === slug);

  const pickImage = (i) => {
    uploadIdx.current = i;
    if (fileRef.current) {
      fileRef.current.value = '';
      fileRef.current.click();
    }
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    const i = uploadIdx.current;
    if (!file || i === null) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.warning('Image is larger than 10 MB. Please use a smaller file.');
      return;
    }
    const fd = new FormData();
    fd.append('file', file);
    fd.append('key', 'house_discipline');
    try {
      setUploadingIdx(i);
      const { data } = await api.post('/settings/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      if (data.data?.url) {
        update(i, { img: data.data.url });
        toast.success('Image uploaded - remember to Save');
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to upload image');
    } finally {
      setUploadingIdx(null);
    }
  };

  const validate = () => {
    for (let i = 0; i < items.length; i++) {
      const s = items[i];
      const n = i + 1;
      if (!s.category_slug) return `Card ${n}: choose a category`;
      if (s.href && !/^(\/(?!\/)|https?:\/\/)/i.test(s.href.trim())) return `Card ${n}: link must start with / or https://`;
    }
    const slugs = items.map((s) => s.category_slug);
    if (new Set(slugs).size !== slugs.length) return 'The same category is used on more than one card';
    return null;
  };

  const handleSave = async () => {
    const problem = validate();
    if (problem) {
      toast.warning(problem);
      return;
    }
    try {
      setSaving(true);
      await api.put('/settings', { house_disciplines: { ...head, items } });
      toast.success('House Disciplines saved - live on the storefront');
      refreshBranding();
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save House Disciplines');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center gap-3 text-surface-500">
        <HiOutlineRefresh className="w-5 h-5 animate-spin text-primary-500" />
        <span className="text-sm">Loading House Disciplines.</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h3 className="text-base font-bold text-surface-900 dark:text-surface-100">House Disciplines (Homepage)</h3>
          <p className="text-xs text-surface-500 dark:text-surface-400 mt-1 max-w-2xl">
            The row of category cards on the homepage. Pick which categories appear, their order, image, text and link. Anything left empty falls back to the category&apos;s own name, image and page. Recommended image: portrait 4:5, 1200 × 1500 px.
          </p>
        </div>
        {canUpdate && (
          <button type="button" onClick={handleSave} disabled={saving} className="py-2 px-4 rounded-lg text-sm font-medium bg-primary-600 hover:bg-primary-700 text-white flex items-center gap-2 disabled:opacity-50 transition">
            {saving ? <HiOutlineRefresh className="w-4 h-4 animate-spin" /> : <HiOutlineSave className="w-4 h-4" />} Save changes
          </button>
        )}
      </div>

      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleFile} />
      <datalist id="hd-pages">
        {STOREFRONT_PAGES.map((p) => <option key={p.path} value={p.path}>{p.label}</option>)}
        {categories.map((c) => <option key={c.slug} value={`/shop/${c.slug}`}>{c.name}</option>)}
      </datalist>

      {/* Section heading */}
      <div className="rounded-xl border border-surface-200 dark:border-surface-800 p-4 space-y-3">
        <h4 className="text-sm font-semibold text-surface-900 dark:text-surface-100">Section heading</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Small label (English)"><input className={inputCls} maxLength={80} disabled={!canUpdate} value={head.kicker_en} onChange={(e) => setHead({ ...head, kicker_en: e.target.value })} placeholder="Disciplines of Scent" /></Field>
          <Field label="Small label (Arabic)"><input dir="rtl" className={inputCls} maxLength={80} disabled={!canUpdate} value={head.kicker_ar} onChange={(e) => setHead({ ...head, kicker_ar: e.target.value })} /></Field>
          <Field label="Heading (English)"><input className={inputCls} maxLength={100} disabled={!canUpdate} value={head.heading_en} onChange={(e) => setHead({ ...head, heading_en: e.target.value })} placeholder="The House Disciplines" /></Field>
          <Field label="Heading (Arabic)"><input dir="rtl" className={inputCls} maxLength={100} disabled={!canUpdate} value={head.heading_ar} onChange={(e) => setHead({ ...head, heading_ar: e.target.value })} /></Field>
          <Field label="Intro text (English)"><textarea rows={2} className={inputCls} maxLength={300} disabled={!canUpdate} value={head.sub_en} onChange={(e) => setHead({ ...head, sub_en: e.target.value })} /></Field>
          <Field label="Intro text (Arabic)"><textarea dir="rtl" rows={2} className={inputCls} maxLength={300} disabled={!canUpdate} value={head.sub_ar} onChange={(e) => setHead({ ...head, sub_ar: e.target.value })} /></Field>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-surface-900 dark:text-surface-100">Cards ({items.length}/{MAX_ITEMS})</h4>
        {canUpdate && (
          <button type="button" onClick={add} disabled={items.length >= MAX_ITEMS} className="text-xs font-medium flex items-center gap-1.5 text-primary-600 hover:text-primary-700 disabled:opacity-40">
            <HiOutlinePlus className="w-4 h-4" /> Add card
          </button>
        )}
      </div>

      {items.length === 0 && (
        <p className="text-sm text-surface-500 p-4 rounded-xl border border-dashed border-surface-300 dark:border-surface-700">
          No cards yet - the homepage section will be hidden.
        </p>
      )}

      {items.map((s, i) => {
        const cat = catOf(s.category_slug);
        const shownImg = s.img || cat?.image || '';
        return (
          <div key={i} className={`rounded-xl border bg-surface-50/50 dark:bg-surface-850 p-4 space-y-4 ${s.active ? 'border-surface-200 dark:border-surface-800' : 'border-dashed border-surface-300 dark:border-surface-700 opacity-75'}`}>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <span className="text-sm font-semibold text-surface-900 dark:text-surface-100">Card {i + 1}{cat ? ` · ${cat.name}` : ''}</span>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1.5 text-xs text-surface-600 dark:text-surface-300">
                  <input type="checkbox" className="accent-primary-600" checked={s.active !== false} disabled={!canUpdate} onChange={(e) => update(i, { active: e.target.checked })} /> Active
                </label>
                <button type="button" className={iconBtn} disabled={!canUpdate || i === 0} onClick={() => move(i, -1)} title="Move up"><HiOutlineArrowUp className="w-4 h-4" /></button>
                <button type="button" className={iconBtn} disabled={!canUpdate || i === items.length - 1} onClick={() => move(i, 1)} title="Move down"><HiOutlineArrowDown className="w-4 h-4" /></button>
                <button type="button" className={`${iconBtn} hover:!text-red-500`} disabled={!canUpdate} onClick={() => remove(i)} title="Delete card"><HiOutlineTrash className="w-4 h-4" /></button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-5">
              <div className="space-y-2">
                <div className="relative aspect-[4/5] rounded-lg overflow-hidden bg-surface-100 dark:bg-surface-900 border border-dashed border-surface-300 dark:border-surface-700">
                  {shownImg ? (
                    <img src={previewSrc(shownImg)} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-surface-400 text-xs gap-1">
                      <HiOutlinePhotograph className="w-6 h-6" /> No image
                    </div>
                  )}
                </div>
                <button type="button" disabled={!canUpdate || uploadingIdx !== null} onClick={() => pickImage(i)} className="w-full text-xs font-medium py-2 rounded-lg border border-surface-300 dark:border-surface-700 text-surface-700 dark:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-800 flex items-center justify-center gap-1.5 disabled:opacity-50 transition">
                  <HiOutlineUpload className="w-4 h-4" /> {uploadingIdx === i ? 'Uploading.' : s.img ? 'Replace image' : 'Upload image'}
                </button>
                {s.img ? (
                  <button type="button" disabled={!canUpdate} onClick={() => update(i, { img: '' })} className="w-full text-[11px] text-surface-500 hover:text-red-500">Use the category image instead</button>
                ) : (
                  <p className="text-[11px] text-surface-500">Using the category&apos;s own image{cat?.image ? '' : ' (none set)'}.</p>
                )}
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Field label="Category *">
                    <select className={inputCls} disabled={!canUpdate} value={s.category_slug} onChange={(e) => update(i, { category_slug: e.target.value })}>
                      <option value="">Select a category</option>
                      {categories.map((c) => <option key={c.id} value={c.slug}>{c.name}</option>)}
                    </select>
                  </Field>
                  <Field label="Link (optional)"><input list="hd-pages" className={inputCls} maxLength={300} disabled={!canUpdate} value={s.href} onChange={(e) => update(i, { href: e.target.value })} placeholder={s.category_slug ? `/shop/${s.category_slug} (default)` : '/shop/...'} /></Field>
                  <Field label="Title (English)"><input className={inputCls} maxLength={80} disabled={!canUpdate} value={s.title_en} onChange={(e) => update(i, { title_en: e.target.value })} placeholder={cat?.name || 'Defaults to the category name'} /></Field>
                  <Field label="Title (Arabic)"><input dir="rtl" className={inputCls} maxLength={80} disabled={!canUpdate} value={s.title_ar} onChange={(e) => update(i, { title_ar: e.target.value })} placeholder={cat?.name_ar || ''} /></Field>
                  <Field label="Small line (English)"><input className={inputCls} maxLength={80} disabled={!canUpdate} value={s.tagline_en} onChange={(e) => update(i, { tagline_en: e.target.value })} placeholder="e.g. Signature Scent · 100ml" /></Field>
                  <Field label="Small line (Arabic)"><input dir="rtl" className={inputCls} maxLength={80} disabled={!canUpdate} value={s.tagline_ar} onChange={(e) => update(i, { tagline_ar: e.target.value })} /></Field>
                  <Field label="Description (English)"><textarea rows={3} className={inputCls} maxLength={260} disabled={!canUpdate} value={s.desc_en} onChange={(e) => update(i, { desc_en: e.target.value })} /></Field>
                  <Field label="Description (Arabic)"><textarea dir="rtl" rows={3} className={inputCls} maxLength={260} disabled={!canUpdate} value={s.desc_ar} onChange={(e) => update(i, { desc_ar: e.target.value })} /></Field>
                  <Field label="Button text (English)"><input className={inputCls} maxLength={40} disabled={!canUpdate} value={s.cta_en} onChange={(e) => update(i, { cta_en: e.target.value })} placeholder="Explore" /></Field>
                  <Field label="Button text (Arabic)"><input dir="rtl" className={inputCls} maxLength={40} disabled={!canUpdate} value={s.cta_ar} onChange={(e) => update(i, { cta_ar: e.target.value })} /></Field>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
