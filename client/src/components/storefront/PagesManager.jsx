import { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import { toast } from '../ui/Toast';
import { usePermission } from '../../hooks/usePermission';
import { useBranding } from '../../context/BrandingContext';
import { HiOutlineSave, HiOutlinePlus, HiOutlineTrash, HiOutlineExternalLink } from 'react-icons/hi';

/**
 * PAGES MANAGER (Storefront sub-module)
 *
 * Manage static pages shown at /policies/<slug> on the storefront (shipping, refund, privacy, terms...).
 * Content is lightweight markdown; tokens like {shipping_fee} are filled with live settings on the storefront.
 */

import { STOREFRONT_ORIGIN } from '../../config/env';

const TOKENS = [
  ['{shipping_fee}', 'Delivery charge'],
  ['{free_over}', 'Free delivery from'],
  ['{delivery_days}', 'Delivery days'],
  ['{refund_days}', 'Refund window (days)'],
  ['{support_email}', 'Support email'],
  ['{support_phone}', 'Support phone'],
  ['{store_name}', 'Store name'],
  ['{store_address}', 'Store address'],
];

const BLANK = {
  id: null, slug: '', titleEn: '', titleAr: '', summaryEn: '', summaryAr: '', metaTitle: '', metaKeywords: '',
  contentEn: '', contentAr: '', isPublished: true, showInFooter: true, sortOrder: 100, isSystem: false,
};

const inputCls = 'w-full px-3 py-2 rounded-lg text-sm border border-surface-300 dark:border-surface-700 bg-white dark:bg-surface-900 text-surface-900 dark:text-surface-100 disabled:opacity-60';
const labelCls = 'block text-[11px] uppercase tracking-wider text-surface-500 mb-1';
const cardCls = 'rounded-xl border border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900 p-4';

function Field({ label, children }) {
  return (
    <label className="block">
      <span className={labelCls}>{label}</span>
      {children}
    </label>
  );
}

const fromRow = (r) => ({
  id: r.id, slug: r.slug, titleEn: r.title_en || '', titleAr: r.title_ar || '',
  summaryEn: r.summary_en || '', summaryAr: r.summary_ar || '',
  metaTitle: r.meta_title || '', metaKeywords: r.meta_keywords || '',
  contentEn: r.content_en || '', contentAr: r.content_ar || '',
  isPublished: !!r.is_published, showInFooter: !!r.show_in_footer,
  sortOrder: r.sort_order ?? 100, isSystem: !!r.is_system,
});

/* Values the policy pages read from settings */
function PolicyValues({ canUpdate }) {
  const { refreshBranding } = useBranding();
  const [v, setV] = useState({ shipping_fee: '', shipping_free_over: '', delivery_days: '', refund_days: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/settings').then(({ data }) => {
      const f = data.data?.flat || {};
      setV({
        shipping_fee: f.shipping_fee ?? '', shipping_free_over: f.shipping_free_over ?? '',
        delivery_days: f.delivery_days ?? '', refund_days: f.refund_days ?? '',
      });
    }).catch(() => toast.error('Failed to load policy values'));
  }, []);

  const save = async () => {
    try {
      setSaving(true);
      await api.put('/settings', {
        shipping_fee: Number(v.shipping_fee) || 0,
        shipping_free_over: Number(v.shipping_free_over) || 0,
        delivery_days: String(v.delivery_days).trim(),
        refund_days: Number(v.refund_days) || 0,
      });
      toast.success('Policy values saved');
      refreshBranding?.();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to save policy values');
    } finally {
      setSaving(false);
    }
  };

  const set = (k) => (e) => setV((s) => ({ ...s, [k]: e.target.value }));
  return (
    <div className={cardCls}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-surface-900 dark:text-surface-100">Policy values</h3>
          <p className="text-xs text-surface-500">Used inside the pages as {'{shipping_fee}'}, {'{free_over}'}, {'{delivery_days}'}, {'{refund_days}'} and by checkout.</p>
        </div>
        {canUpdate && (
          <button type="button" onClick={save} disabled={saving} className="btn-primary inline-flex items-center gap-2 text-sm">
            <HiOutlineSave className="w-4 h-4" /> {saving ? 'Saving…' : 'Save values'}
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Field label="Delivery charge (AED)"><input className={inputCls} type="number" min="0" disabled={!canUpdate} value={v.shipping_fee} onChange={set('shipping_fee')} /></Field>
        <Field label="Free delivery from (AED)"><input className={inputCls} type="number" min="0" disabled={!canUpdate} value={v.shipping_free_over} onChange={set('shipping_free_over')} /></Field>
        <Field label="Delivery days"><input className={inputCls} disabled={!canUpdate} placeholder="2 - 5" value={v.delivery_days} onChange={set('delivery_days')} /></Field>
        <Field label="Refund window (days)"><input className={inputCls} type="number" min="0" disabled={!canUpdate} value={v.refund_days} onChange={set('refund_days')} /></Field>
      </div>
    </div>
  );
}

/* Site-wide default meta tags (used by every page that has no own SEO) */
function SeoDefaults({ canUpdate }) {
  const { refreshBranding } = useBranding();
  const KEYS = ['seo_site_title', 'seo_site_title_ar', 'seo_site_description', 'seo_site_description_ar', 'seo_site_keywords', 'seo_og_image',
    'tracking_ga4_id', 'tracking_gtm_id', 'tracking_meta_pixel_id', 'tracking_google_verification', 'tracking_bing_verification'];
  const [v, setV] = useState(Object.fromEntries(KEYS.map((k) => [k, ''])));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/settings').then(({ data }) => {
      const f = data.data?.flat || {};
      setV(Object.fromEntries(KEYS.map((k) => [k, f[k] ?? ''])));
    }).catch(() => toast.error('Failed to load SEO defaults'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async () => {
    try {
      setSaving(true);
      await api.put('/settings', Object.fromEntries(KEYS.map((k) => [k, String(v[k] ?? '').trim()])));
      toast.success('SEO defaults saved');
      refreshBranding?.();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to save SEO defaults');
    } finally {
      setSaving(false);
    }
  };
  const set = (k) => (e) => setV((s) => ({ ...s, [k]: e.target.value }));
  return (
    <div className={cardCls}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-surface-900 dark:text-surface-100">SEO defaults (meta tags)</h3>
          <p className="text-xs text-surface-500">Site-wide fallback for the home page and any page without its own SEO. Products use the SEO fields on each product; pages use the fields below.</p>
        </div>
        {canUpdate && (
          <button type="button" onClick={save} disabled={saving} className="btn-primary inline-flex items-center gap-2 text-sm">
            <HiOutlineSave className="w-4 h-4" /> {saving ? 'Saving…' : 'Save SEO'}
          </button>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="Default title (English)"><input className={inputCls} disabled={!canUpdate} value={v.seo_site_title} onChange={set('seo_site_title')} placeholder="Store name | Tagline" /></Field>
        <Field label="Default title (Arabic)"><input className={inputCls} dir="rtl" disabled={!canUpdate} value={v.seo_site_title_ar} onChange={set('seo_site_title_ar')} /></Field>
        <Field label="Default description (English)"><textarea className={inputCls} rows={3} maxLength={320} disabled={!canUpdate} value={v.seo_site_description} onChange={set('seo_site_description')} /></Field>
        <Field label="Default description (Arabic)"><textarea className={inputCls} dir="rtl" rows={3} maxLength={320} disabled={!canUpdate} value={v.seo_site_description_ar} onChange={set('seo_site_description_ar')} /></Field>
        <Field label="Default keywords (comma separated)"><input className={inputCls} disabled={!canUpdate} value={v.seo_site_keywords} onChange={set('seo_site_keywords')} /></Field>
        <Field label="Social sharing image (URL or /uploads path)"><input className={inputCls} disabled={!canUpdate} value={v.seo_og_image} onChange={set('seo_og_image')} placeholder="https://…/share.jpg" /></Field>
      </div>
      <div className="mt-5 pt-4 border-t border-surface-200 dark:border-surface-700">
        <h4 className="text-sm font-semibold text-surface-900 dark:text-surface-100">Tracking &amp; search-engine verification</h4>
        <p className="text-xs text-surface-500 mb-3">Paste the IDs only (not the whole script). Leave empty to switch a tool off. Use Google Analytics <b>or</b> Tag Manager, not both. Add-to-cart, product-view and purchase events are sent automatically.</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Field label="Google Analytics 4 ID"><input className={inputCls} disabled={!canUpdate} value={v.tracking_ga4_id} onChange={set('tracking_ga4_id')} placeholder="G-XXXXXXXXXX" /></Field>
          <Field label="Google Tag Manager ID"><input className={inputCls} disabled={!canUpdate} value={v.tracking_gtm_id} onChange={set('tracking_gtm_id')} placeholder="GTM-XXXXXXX" /></Field>
          <Field label="Meta Pixel ID"><input className={inputCls} disabled={!canUpdate} value={v.tracking_meta_pixel_id} onChange={set('tracking_meta_pixel_id')} placeholder="1234567890" /></Field>
          <Field label="Google Search Console token"><input className={inputCls} disabled={!canUpdate} value={v.tracking_google_verification} onChange={set('tracking_google_verification')} placeholder="content value of the meta tag" /></Field>
          <Field label="Bing Webmaster token"><input className={inputCls} disabled={!canUpdate} value={v.tracking_bing_verification} onChange={set('tracking_bing_verification')} placeholder="msvalidate.01 value" /></Field>
        </div>
      </div>
    </div>
  );
}

export default function PagesManager() {
  const canUpdate = usePermission('settings.update');
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(null);
  const [lang, setLang] = useState('en');

  const loadList = useCallback(async () => {
    try {
      const { data } = await api.get('/pages');
      setList(data.data || []);
    } catch {
      toast.error('Failed to load pages');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadList(); }, [loadList]);

  const open = async (id) => {
    try {
      const { data } = await api.get(`/pages/${id}`);
      setForm(fromRow(data.data));
    } catch {
      toast.error('Failed to open page');
    }
  };

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const insertToken = (tok) => {
    const key = lang === 'en' ? 'contentEn' : 'contentAr';
    setForm((f) => ({ ...f, [key]: `${f[key]}${f[key] && !f[key].endsWith(' ') ? ' ' : ''}${tok}` }));
  };

  const save = async () => {
    if (!form.titleEn.trim()) return toast.error('English title is required');
    if (!form.id && !form.slug.trim()) return toast.error('Slug is required');
    const body = {
      slug: form.slug, titleEn: form.titleEn, titleAr: form.titleAr, summaryEn: form.summaryEn, summaryAr: form.summaryAr,
      metaTitle: form.metaTitle, metaKeywords: form.metaKeywords,
      contentEn: form.contentEn, contentAr: form.contentAr, isPublished: form.isPublished,
      showInFooter: form.showInFooter, sortOrder: Number(form.sortOrder) || 0,
    };
    try {
      setSaving(true);
      const { data } = form.id ? await api.put(`/pages/${form.id}`, body) : await api.post('/pages', body);
      setForm(fromRow(data.data));
      toast.success('Page saved');
      loadList();
    } catch (e) {
      const d = e.response?.data;
      toast.error(d?.details?.map((x) => x.message).join(', ') || d?.error || d?.message || 'Failed to save page');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!form?.id || form.isSystem) return;
    if (!window.confirm(`Delete "${form.titleEn}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/pages/${form.id}`);
      toast.success('Page deleted');
      setForm(null);
      loadList();
    } catch (e) {
      toast.error(e.response?.data?.error || e.response?.data?.message || 'Failed to delete page');
    }
  };

  return (
    <div className="space-y-4">
      <PolicyValues canUpdate={canUpdate} />
      <SeoDefaults canUpdate={canUpdate} />

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4">
        {/* List */}
        <div className={cardCls}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-surface-900 dark:text-surface-100">Pages</h3>
            {canUpdate && (
              <button type="button" onClick={() => setForm({ ...BLANK })} className="inline-flex items-center gap-1 text-xs text-primary-600 hover:underline">
                <HiOutlinePlus className="w-4 h-4" /> New
              </button>
            )}
          </div>
          {loading ? <p className="text-sm text-surface-500">Loading…</p> : (
            <ul className="space-y-1">
              {list.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => open(p.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition ${form?.id === p.id ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300' : 'hover:bg-surface-100 dark:hover:bg-surface-800 text-surface-800 dark:text-surface-200'}`}
                  >
                    <span className="block font-medium">{p.title_en}</span>
                    <span className="block text-[11px] text-surface-500">/policies/{p.slug}{p.is_published ? '' : ' · draft'}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Editor */}
        <div className={cardCls}>
          {!form ? (
            <p className="text-sm text-surface-500">Select a page to edit, or create a new one.</p>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Field label="Title (English)"><input className={inputCls} disabled={!canUpdate} value={form.titleEn} onChange={set('titleEn')} /></Field>
                <Field label="Title (Arabic)"><input className={inputCls} dir="rtl" disabled={!canUpdate} value={form.titleAr} onChange={set('titleAr')} /></Field>
                <Field label="Slug (URL)">
                  <input className={inputCls} disabled={!canUpdate || form.isSystem} placeholder="e.g. gift-cards" value={form.slug} onChange={set('slug')} />
                  {form.isSystem && <span className="text-[11px] text-surface-500">Built-in page: URL is fixed.</span>}
                </Field>
                <Field label="Sort order"><input className={inputCls} type="number" min="0" disabled={!canUpdate} value={form.sortOrder} onChange={set('sortOrder')} /></Field>
                <Field label="Short summary (English)"><input className={inputCls} disabled={!canUpdate} value={form.summaryEn} onChange={set('summaryEn')} /></Field>
                <Field label="Short summary (Arabic)"><input className={inputCls} dir="rtl" disabled={!canUpdate} value={form.summaryAr} onChange={set('summaryAr')} /></Field>
                <Field label="SEO title (optional, defaults to the page title)"><input className={inputCls} maxLength={200} disabled={!canUpdate} value={form.metaTitle} onChange={set('metaTitle')} /></Field>
                <Field label="SEO keywords (comma separated)"><input className={inputCls} maxLength={300} disabled={!canUpdate} value={form.metaKeywords} onChange={set('metaKeywords')} /></Field>
              </div>

              <div className="flex flex-wrap items-center gap-4 text-sm text-surface-700 dark:text-surface-300">
                <label className="inline-flex items-center gap-2"><input type="checkbox" disabled={!canUpdate} checked={form.isPublished} onChange={set('isPublished')} /> Published</label>
                <label className="inline-flex items-center gap-2"><input type="checkbox" disabled={!canUpdate} checked={form.showInFooter} onChange={set('showInFooter')} /> Show in footer</label>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2">
                  {['en', 'ar'].map((l) => (
                    <button key={l} type="button" onClick={() => setLang(l)}
                      className={`px-3 py-1 rounded-lg text-xs border ${lang === l ? 'bg-primary-600 text-white border-primary-600' : 'border-surface-300 dark:border-surface-700 text-surface-600 dark:text-surface-300'}`}>
                      {l === 'en' ? 'English content' : 'Arabic content'}
                    </button>
                  ))}
                </div>
                <textarea
                  className={`${inputCls} font-mono leading-relaxed`}
                  rows={22}
                  dir={lang === 'ar' ? 'rtl' : 'ltr'}
                  disabled={!canUpdate}
                  value={lang === 'en' ? form.contentEn : form.contentAr}
                  onChange={set(lang === 'en' ? 'contentEn' : 'contentAr')}
                />
                <p className="text-[11px] text-surface-500 mt-1">
                  Formatting: <code>## Heading</code> · <code>- bullet</code> · <code>1. numbered</code> · <code>**bold**</code> · <code>[label](/url)</code> · blank line = new paragraph.
                </p>
                {canUpdate && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {TOKENS.map(([tok, name]) => (
                      <button key={tok} type="button" title={name} onClick={() => insertToken(tok)}
                        className="px-2 py-1 rounded-md text-[11px] border border-surface-300 dark:border-surface-700 text-surface-600 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-800">
                        {tok}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {canUpdate && (
                    <button type="button" onClick={save} disabled={saving} className="btn-primary inline-flex items-center gap-2 text-sm">
                      <HiOutlineSave className="w-4 h-4" /> {saving ? 'Saving…' : 'Save page'}
                    </button>
                  )}
                  {form.id && (
                    <a href={`${STOREFRONT_ORIGIN}/policies/${form.slug}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-primary-600 hover:underline">
                      <HiOutlineExternalLink className="w-4 h-4" /> View on site
                    </a>
                  )}
                </div>
                {canUpdate && form.id && !form.isSystem && (
                  <button type="button" onClick={remove} className="inline-flex items-center gap-1 text-sm text-red-600 hover:underline">
                    <HiOutlineTrash className="w-4 h-4" /> Delete
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
