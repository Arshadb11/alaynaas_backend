import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../../services/api';
import { toast } from '../ui/Toast';
import { usePermission } from '../../hooks/usePermission';
import { HiOutlineSave, HiOutlinePlus, HiOutlineTrash, HiOutlineExternalLink, HiOutlineUpload } from 'react-icons/hi';

/**
 * JOURNAL MANAGER (Storefront sub-module)
 * Articles shown at /journal and /journal/<slug>. Content uses lightweight markdown:
 * "## Heading", "- bullet", "**bold**", "[label](/url)", blank line = new paragraph.
 */

const STOREFRONT_ORIGIN = import.meta.env.VITE_STOREFRONT_URL || 'http://localhost:3001';
const API_ORIGIN = import.meta.env.VITE_API_ORIGIN || 'http://localhost:3000';

const BLANK = {
  id: null, slug: '', titleEn: '', titleAr: '', excerptEn: '', excerptAr: '', categoryEn: '', categoryAr: '',
  contentEn: '', contentAr: '', coverImage: '', isPublished: true, isFeatured: false,
  publishedAt: new Date().toISOString().slice(0, 10),
};

const inputCls = 'w-full px-3 py-2 rounded-lg text-sm border border-surface-300 dark:border-surface-700 bg-white dark:bg-surface-900 text-surface-900 dark:text-surface-100 disabled:opacity-60';
const labelCls = 'block text-[11px] uppercase tracking-wider text-surface-500 mb-1';
const cardCls = 'rounded-xl border border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900 p-4';

const previewSrc = (img) => {
  if (!img) return '';
  if (/^https?:\/\//i.test(img)) return img;
  if (img.startsWith('/images/')) return `${STOREFRONT_ORIGIN}${img}`;
  return `${API_ORIGIN}${img.startsWith('/') ? '' : '/'}${img}`;
};

function Field({ label, children, className = '' }) {
  return (
    <label className={`block ${className}`}>
      <span className={labelCls}>{label}</span>
      {children}
    </label>
  );
}

const fromRow = (r) => ({
  id: r.id, slug: r.slug, titleEn: r.title_en || '', titleAr: r.title_ar || '',
  excerptEn: r.excerpt_en || '', excerptAr: r.excerpt_ar || '',
  categoryEn: r.category_en || '', categoryAr: r.category_ar || '',
  contentEn: r.content_en || '', contentAr: r.content_ar || '', coverImage: r.cover_image || '',
  isPublished: !!r.is_published, isFeatured: !!r.is_featured,
  publishedAt: r.published_at ? new Date(r.published_at).toISOString().slice(0, 10) : '',
});

export default function JournalManager() {
  const canUpdate = usePermission('settings.update');
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState(null);
  const [lang, setLang] = useState('en');
  const fileRef = useRef(null);

  const loadList = useCallback(async () => {
    try {
      const { data } = await api.get('/journal');
      setList(data.data || []);
    } catch {
      toast.error('Failed to load journal');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { loadList(); }, [loadList]);

  const open = async (id) => {
    try {
      const { data } = await api.get(`/journal/${id}`);
      setForm(fromRow(data.data));
    } catch {
      toast.error('Failed to open entry');
    }
  };

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) return toast.warning('Image is larger than 10 MB. Please use a smaller file.');
    const fd = new FormData();
    fd.append('file', file);
    fd.append('key', 'journal_cover');
    try {
      setUploading(true);
      const { data } = await api.post('/settings/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      if (data.data?.url) {
        setForm((f) => ({ ...f, coverImage: data.data.url }));
        toast.success('Cover uploaded. Remember to save the entry');
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to upload image');
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (!form.titleEn.trim()) return toast.error('English title is required');
    if (!form.id && !form.slug.trim()) return toast.error('Slug is required');
    if (!form.contentEn.trim()) return toast.error('English content is required');
    const body = { ...form };
    delete body.id;
    try {
      setSaving(true);
      const { data } = form.id ? await api.put(`/journal/${form.id}`, body) : await api.post('/journal', body);
      setForm(fromRow(data.data));
      toast.success('Entry saved');
      loadList();
    } catch (e) {
      const d = e.response?.data;
      toast.error(d?.details?.map((x) => x.message).join(', ') || d?.error || d?.message || 'Failed to save entry');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!form?.id) return;
    if (!window.confirm(`Delete "${form.titleEn}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/journal/${form.id}`);
      toast.success('Entry deleted');
      setForm(null);
      loadList();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to delete entry');
    }
  };

  const words = (form?.contentEn || '').trim().split(/\s+/).filter(Boolean).length;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
      <div className={cardCls}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-surface-900 dark:text-surface-100">Journal entries</h3>
          {canUpdate && (
            <button type="button" onClick={() => setForm({ ...BLANK })} className="inline-flex items-center gap-1 text-xs text-primary-600 hover:underline">
              <HiOutlinePlus className="w-4 h-4" /> New
            </button>
          )}
        </div>
        {loading ? <p className="text-sm text-surface-500">Loading…</p> : (
          <ul className="space-y-1 max-h-[640px] overflow-y-auto">
            {list.map((p) => (
              <li key={p.id}>
                <button type="button" onClick={() => open(p.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition ${form?.id === p.id ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300' : 'hover:bg-surface-100 dark:hover:bg-surface-800 text-surface-800 dark:text-surface-200'}`}>
                  <span className="block font-medium">{p.title_en}</span>
                  <span className="block text-[11px] text-surface-500">
                    {p.is_featured ? '★ Featured · ' : ''}{p.is_published ? new Date(p.published_at).toLocaleDateString() : 'Draft'}
                  </span>
                </button>
              </li>
            ))}
            {!list.length && <li className="text-sm text-surface-500">No entries yet.</li>}
          </ul>
        )}
      </div>

      <div className={cardCls}>
        {!form ? (
          <p className="text-sm text-surface-500">Select an entry to edit, or create a new one.</p>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Title (English)"><input className={inputCls} disabled={!canUpdate} value={form.titleEn} onChange={set('titleEn')} /></Field>
              <Field label="Title (Arabic)"><input className={inputCls} dir="rtl" disabled={!canUpdate} value={form.titleAr} onChange={set('titleAr')} /></Field>
              <Field label="Slug (URL)"><input className={inputCls} disabled={!canUpdate} placeholder="e.g. how-we-source-oud" value={form.slug} onChange={set('slug')} /></Field>
              <Field label="Publish date"><input className={inputCls} type="date" disabled={!canUpdate} value={form.publishedAt} onChange={set('publishedAt')} /></Field>
              <Field label="Category (English)"><input className={inputCls} disabled={!canUpdate} placeholder="The making" value={form.categoryEn} onChange={set('categoryEn')} /></Field>
              <Field label="Category (Arabic)"><input className={inputCls} dir="rtl" disabled={!canUpdate} value={form.categoryAr} onChange={set('categoryAr')} /></Field>
              <Field label="Short summary (English), also the meta description"><textarea className={inputCls} rows={2} maxLength={500} disabled={!canUpdate} value={form.excerptEn} onChange={set('excerptEn')} /></Field>
              <Field label="Short summary (Arabic)"><textarea className={inputCls} dir="rtl" rows={2} maxLength={500} disabled={!canUpdate} value={form.excerptAr} onChange={set('excerptAr')} /></Field>
            </div>

            <div className="flex items-center gap-4">
              <div className="w-40 h-28 rounded-lg border border-surface-300 dark:border-surface-700 bg-surface-100 dark:bg-surface-800 overflow-hidden flex items-center justify-center text-xs text-surface-500">
                {form.coverImage ? <img src={previewSrc(form.coverImage)} alt="" className="w-full h-full object-cover" /> : 'No cover'}
              </div>
              {canUpdate && (
                <div className="space-y-2">
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
                  <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="inline-flex items-center gap-2 text-sm px-3 py-2 rounded-lg border border-surface-300 dark:border-surface-700 hover:bg-surface-100 dark:hover:bg-surface-800">
                    <HiOutlineUpload className="w-4 h-4" /> {uploading ? 'Uploading…' : 'Upload cover image'}
                  </button>
                  <p className="text-[11px] text-surface-500">Landscape photo, at least 1600 px wide.</p>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-4 text-sm text-surface-700 dark:text-surface-300">
              <label className="inline-flex items-center gap-2"><input type="checkbox" disabled={!canUpdate} checked={form.isPublished} onChange={set('isPublished')} /> Published</label>
              <label className="inline-flex items-center gap-2"><input type="checkbox" disabled={!canUpdate} checked={form.isFeatured} onChange={set('isFeatured')} /> Featured on top (only one at a time)</label>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-2">
                {['en', 'ar'].map((l) => (
                  <button key={l} type="button" onClick={() => setLang(l)}
                    className={`px-3 py-1 rounded-lg text-xs border ${lang === l ? 'bg-primary-600 text-white border-primary-600' : 'border-surface-300 dark:border-surface-700 text-surface-600 dark:text-surface-300'}`}>
                    {l === 'en' ? 'English article' : 'Arabic article'}
                  </button>
                ))}
                <span className="text-[11px] text-surface-500 ml-auto">{words} words (English). Aim for 3 or more paragraphs.</span>
              </div>
              <textarea className={`${inputCls} leading-relaxed`} rows={20} dir={lang === 'ar' ? 'rtl' : 'ltr'} disabled={!canUpdate}
                value={lang === 'en' ? form.contentEn : form.contentAr} onChange={set(lang === 'en' ? 'contentEn' : 'contentAr')} />
              <p className="text-[11px] text-surface-500 mt-1">
                Formatting: <code>## Heading</code> · <code>- bullet</code> · <code>**bold**</code> · <code>[label](/url)</code> · blank line = new paragraph. If the Arabic article is empty, visitors see the English one.
              </p>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {canUpdate && (
                  <button type="button" onClick={save} disabled={saving} className="btn-primary inline-flex items-center gap-2 text-sm">
                    <HiOutlineSave className="w-4 h-4" /> {saving ? 'Saving…' : 'Save entry'}
                  </button>
                )}
                {form.id && (
                  <a href={`${STOREFRONT_ORIGIN}/journal/${form.slug}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-primary-600 hover:underline">
                    <HiOutlineExternalLink className="w-4 h-4" /> View on site
                  </a>
                )}
              </div>
              {canUpdate && form.id && (
                <button type="button" onClick={remove} className="inline-flex items-center gap-1 text-sm text-red-600 hover:underline">
                  <HiOutlineTrash className="w-4 h-4" /> Delete
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
