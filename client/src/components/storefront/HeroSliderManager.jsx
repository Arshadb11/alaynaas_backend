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
 * HERO SLIDER MANAGER (Storefront sub-module)
 *
 * Edits the `hero_slides` + `hero_interval` settings that drive the homepage slider.
 * The server re-validates and sanitizes everything on save (see _sanitizeHeroSlides).
 */

const MAX_SLIDES = 8;
const API_ORIGIN = import.meta.env.VITE_API_ORIGIN || 'http://localhost:3000'; // serves /uploads/*
const STOREFRONT_ORIGIN = import.meta.env.VITE_STOREFRONT_URL || 'http://localhost:3001'; // serves /images/*

const blankSlide = () => ({
  img: '', pos: '50% 50%', active: true, start_at: '', end_at: '',
  kick_en: '', kick_ar: '', l1_en: '', l1_ar: '', l2_en: '', l2_ar: '', sub_en: '', sub_ar: '',
  alt_en: '', alt_ar: '', href: '', cta_en: '', cta_ar: '', href2: '', cta2_en: '', cta2_ar: '',
});

/** Resolve a stored image path to something the admin browser can display. */
const previewSrc = (img) => {
  if (!img) return '';
  if (/^https?:\/\//i.test(img)) return img;
  return `${img.startsWith('/images/') ? STOREFRONT_ORIGIN : API_ORIGIN}${img}`;
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

export default function HeroSliderManager() {
  const canUpdate = usePermission('settings.update');
  const { refreshBranding } = useBranding();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingIdx, setUploadingIdx] = useState(null);
  const [slides, setSlides] = useState([]);
  const [interval, setIntervalSec] = useState(7);
  const fileRef = useRef(null);
  const uploadIdx = useRef(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/settings');
      const flat = data.data?.flat || {};
      setSlides(Array.isArray(flat.hero_slides) ? flat.hero_slides.map((s) => ({ ...blankSlide(), ...s })) : []);
      setIntervalSec(Number(flat.hero_interval) || 7);
    } catch {
      toast.error('Failed to load hero slider settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const update = (i, patch) => setSlides((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  const remove = (i) => setSlides((prev) => prev.filter((_, idx) => idx !== i));
  const add = () => setSlides((prev) => (prev.length >= MAX_SLIDES ? prev : [...prev, blankSlide()]));
  const move = (i, dir) => setSlides((prev) => {
    const j = i + dir;
    if (j < 0 || j >= prev.length) return prev;
    const next = [...prev];
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  });

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
    fd.append('key', 'hero_slide');
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

  /** Clicking the preview sets the focal point (object-position) used to crop on narrow screens. */
  const setFocus = (i, e) => {
    if (!canUpdate) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = Math.round(((e.clientX - r.left) / r.width) * 100);
    const y = Math.round(((e.clientY - r.top) / r.height) * 100);
    update(i, { pos: `${Math.min(100, Math.max(0, x))}% ${Math.min(100, Math.max(0, y))}%` });
  };

  const validate = () => {
    for (let i = 0; i < slides.length; i++) {
      const s = slides[i];
      const n = i + 1;
      if (!s.img) return `Slide ${n}: upload an image`;
      if (!s.l1_en.trim()) return `Slide ${n}: the English headline (line 1) is required`;
      if (s.href && !/^(\/(?!\/)|https?:\/\/|#[\w-]+$)/i.test(s.href.trim())) return `Slide ${n}: button link must start with / or https://`;
      if (s.href2 && !/^(\/(?!\/)|https?:\/\/|#[\w-]+$)/i.test(s.href2.trim())) return `Slide ${n}: second button link must start with / or https://`;
      if (s.href && !s.cta_en.trim()) return `Slide ${n}: add the English text for the button`;
      if (s.href2 && !s.cta2_en.trim()) return `Slide ${n}: add the English text for the second button`;
      if (s.start_at && s.end_at && s.start_at > s.end_at) return `Slide ${n}: the end date is before the start date`;
    }
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
      await api.put('/settings', { hero_slides: slides, hero_interval: interval });
      toast.success('Hero slider saved - live on the storefront');
      refreshBranding();
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save hero slider');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center gap-3 text-surface-500">
        <HiOutlineRefresh className="w-5 h-5 animate-spin text-primary-500" />
        <span className="text-sm">Loading hero slider.</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h3 className="text-base font-bold text-surface-900 dark:text-surface-100">Hero Slider (Homepage)</h3>
          <p className="text-xs text-surface-500 dark:text-surface-400 mt-1 max-w-2xl">
            The big banner at the top of the homepage. The first active slide carries the page&apos;s main heading, so make it your most important message. Recommended image: landscape, 2400 × 1350 px or larger, under 10 MB.
          </p>
        </div>
        {canUpdate && (
          <button type="button" onClick={handleSave} disabled={saving} className="py-2 px-4 rounded-lg text-sm font-medium bg-primary-600 hover:bg-primary-700 text-white flex items-center gap-2 disabled:opacity-50 transition">
            {saving ? <HiOutlineRefresh className="w-4 h-4 animate-spin" /> : <HiOutlineSave className="w-4 h-4" />} Save changes
          </button>
        )}
      </div>

      <label className="p-4 rounded-xl border border-surface-200 dark:border-surface-800 block max-w-sm">
        <span className="block text-sm font-semibold text-surface-900 dark:text-surface-100">Seconds per slide</span>
        <span className="block text-xs text-surface-500 mb-2">How long each slide stays before moving on (3-20).</span>
        <input type="number" min="3" max="20" className={inputCls} value={interval} disabled={!canUpdate} onChange={(e) => setIntervalSec(e.target.value === '' ? '' : Number(e.target.value))} />
      </label>

      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleFile} />
      <datalist id="hero-pages">
        {STOREFRONT_PAGES.map((p) => <option key={p.path} value={p.path}>{p.label}</option>)}
      </datalist>

      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-surface-900 dark:text-surface-100">Slides ({slides.length}/{MAX_SLIDES})</h4>
        {canUpdate && (
          <button type="button" onClick={add} disabled={slides.length >= MAX_SLIDES} className="text-xs font-medium flex items-center gap-1.5 text-primary-600 hover:text-primary-700 disabled:opacity-40">
            <HiOutlinePlus className="w-4 h-4" /> Add slide
          </button>
        )}
      </div>

      {slides.length === 0 && (
        <p className="text-sm text-surface-500 p-4 rounded-xl border border-dashed border-surface-300 dark:border-surface-700">
          No slides yet - the storefront will fall back to its built-in slides.
        </p>
      )}

      {slides.map((s, i) => (
        <div key={i} className={`rounded-xl border bg-surface-50/50 dark:bg-surface-850 p-4 space-y-4 ${s.active ? 'border-surface-200 dark:border-surface-800' : 'border-dashed border-surface-300 dark:border-surface-700 opacity-75'}`}>
          {/* Header row */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <span className="text-sm font-semibold text-surface-900 dark:text-surface-100">
              Slide {i + 1} {i === 0 && <span className="ml-2 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary-100 dark:bg-primary-950/50 text-primary-700 dark:text-primary-300">Main heading</span>}
            </span>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1.5 text-xs text-surface-600 dark:text-surface-300">
                <input type="checkbox" className="accent-primary-600" checked={s.active !== false} disabled={!canUpdate} onChange={(e) => update(i, { active: e.target.checked })} /> Active
              </label>
              <button type="button" className={iconBtn} disabled={!canUpdate || i === 0} onClick={() => move(i, -1)} title="Move up"><HiOutlineArrowUp className="w-4 h-4" /></button>
              <button type="button" className={iconBtn} disabled={!canUpdate || i === slides.length - 1} onClick={() => move(i, 1)} title="Move down"><HiOutlineArrowDown className="w-4 h-4" /></button>
              <button type="button" className={`${iconBtn} hover:!text-red-500`} disabled={!canUpdate} onClick={() => remove(i)} title="Delete slide"><HiOutlineTrash className="w-4 h-4" /></button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-5">
            {/* Image + focal point */}
            <div className="space-y-2">
              <div
                className={`relative aspect-video rounded-lg overflow-hidden bg-surface-100 dark:bg-surface-900 border border-dashed border-surface-300 dark:border-surface-700 ${s.img && canUpdate ? 'cursor-crosshair' : ''}`}
                onClick={(e) => s.img && setFocus(i, e)}
                title={s.img ? 'Click to set the focus point' : undefined}
              >
                {s.img ? (
                  <>
                    <img src={previewSrc(s.img)} alt="" className="w-full h-full object-cover" style={{ objectPosition: s.pos }} />
                    <span className="absolute w-4 h-4 -ml-2 -mt-2 rounded-full border-2 border-white bg-primary-500/70 shadow pointer-events-none" style={{ left: s.pos.split(' ')[0], top: s.pos.split(' ')[1] }} />
                  </>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-surface-400 text-xs gap-1">
                    <HiOutlinePhotograph className="w-6 h-6" /> No image
                  </div>
                )}
              </div>
              <button type="button" disabled={!canUpdate || uploadingIdx !== null} onClick={() => pickImage(i)} className="w-full text-xs font-medium py-2 rounded-lg border border-surface-300 dark:border-surface-700 text-surface-700 dark:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-800 flex items-center justify-center gap-1.5 disabled:opacity-50 transition">
                <HiOutlineUpload className="w-4 h-4" /> {uploadingIdx === i ? 'Uploading.' : s.img ? 'Replace image' : 'Upload image'}
              </button>
              {s.img && <p className="text-[11px] text-surface-500">Click the picture to choose which part stays visible on phones (focus {s.pos}).</p>}
            </div>

            {/* Text fields */}
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Field label="Small label (English)"><input className={inputCls} maxLength={80} disabled={!canUpdate} value={s.kick_en} onChange={(e) => update(i, { kick_en: e.target.value })} placeholder="e.g. Discovery & Travel Sets" /></Field>
                <Field label="Small label (Arabic)"><input dir="rtl" className={inputCls} maxLength={80} disabled={!canUpdate} value={s.kick_ar} onChange={(e) => update(i, { kick_ar: e.target.value })} /></Field>
                <Field label="Headline line 1 (English) *"><input className={inputCls} maxLength={60} disabled={!canUpdate} value={s.l1_en} onChange={(e) => update(i, { l1_en: e.target.value })} placeholder="Start small." /></Field>
                <Field label="Headline line 1 (Arabic)"><input dir="rtl" className={inputCls} maxLength={60} disabled={!canUpdate} value={s.l1_ar} onChange={(e) => update(i, { l1_ar: e.target.value })} /></Field>
                <Field label="Headline line 2 (English)"><input className={inputCls} maxLength={60} disabled={!canUpdate} value={s.l2_en} onChange={(e) => update(i, { l2_en: e.target.value })} placeholder="Choose well." /></Field>
                <Field label="Headline line 2 (Arabic)"><input dir="rtl" className={inputCls} maxLength={60} disabled={!canUpdate} value={s.l2_ar} onChange={(e) => update(i, { l2_ar: e.target.value })} /></Field>
                <Field label="Short description (English)"><textarea rows={2} className={inputCls} maxLength={220} disabled={!canUpdate} value={s.sub_en} onChange={(e) => update(i, { sub_en: e.target.value })} placeholder="Optional one-sentence supporting text" /></Field>
                <Field label="Short description (Arabic)"><textarea dir="rtl" rows={2} className={inputCls} maxLength={220} disabled={!canUpdate} value={s.sub_ar} onChange={(e) => update(i, { sub_ar: e.target.value })} /></Field>
                <Field label="Image description for Google (English)"><input className={inputCls} maxLength={160} disabled={!canUpdate} value={s.alt_en} onChange={(e) => update(i, { alt_en: e.target.value })} placeholder="Describe the photo (defaults to the headline)" /></Field>
                <Field label="Image description for Google (Arabic)"><input dir="rtl" className={inputCls} maxLength={160} disabled={!canUpdate} value={s.alt_ar} onChange={(e) => update(i, { alt_ar: e.target.value })} /></Field>
              </div>

              {/* Buttons */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-3 border-t border-surface-200 dark:border-surface-800">
                <Field label="Main button text (English)"><input className={inputCls} maxLength={40} disabled={!canUpdate} value={s.cta_en} onChange={(e) => update(i, { cta_en: e.target.value })} placeholder="Shop the sets" /></Field>
                <Field label="Main button text (Arabic)"><input dir="rtl" className={inputCls} maxLength={40} disabled={!canUpdate} value={s.cta_ar} onChange={(e) => update(i, { cta_ar: e.target.value })} /></Field>
                <Field label="Main button links to"><input list="hero-pages" className={inputCls} maxLength={300} disabled={!canUpdate} value={s.href} onChange={(e) => update(i, { href: e.target.value })} placeholder="/fragrances/sets or https://..." /></Field>
                <Field label="Second button text (English)"><input className={inputCls} maxLength={40} disabled={!canUpdate} value={s.cta2_en} onChange={(e) => update(i, { cta2_en: e.target.value })} placeholder="Optional" /></Field>
                <Field label="Second button text (Arabic)"><input dir="rtl" className={inputCls} maxLength={40} disabled={!canUpdate} value={s.cta2_ar} onChange={(e) => update(i, { cta2_ar: e.target.value })} /></Field>
                <Field label="Second button links to"><input list="hero-pages" className={inputCls} maxLength={300} disabled={!canUpdate} value={s.href2} onChange={(e) => update(i, { href2: e.target.value })} placeholder="Optional" /></Field>
              </div>

              {/* Schedule */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-3 border-t border-surface-200 dark:border-surface-800">
                <Field label="Show from (optional)"><input type="date" className={inputCls} disabled={!canUpdate} value={s.start_at} onChange={(e) => update(i, { start_at: e.target.value })} /></Field>
                <Field label="Show until (optional)"><input type="date" className={inputCls} disabled={!canUpdate} value={s.end_at} onChange={(e) => update(i, { end_at: e.target.value })} /></Field>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
