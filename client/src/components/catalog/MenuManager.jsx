import { useState, useEffect, useMemo, useRef } from 'react';
import api from '../../services/api';
import { assetUrl } from '../../config/env';
import { toast } from '../ui/Toast';
import {
  HiOutlinePlus, HiOutlinePencil, HiOutlineTrash, HiOutlineX,
  HiOutlineArrowUp, HiOutlineArrowDown, HiOutlineEye, HiOutlineEyeOff,
  HiOutlineViewGridAdd, HiOutlinePhotograph,
} from 'react-icons/hi';

const MAX_DEPTH = 3;
const LEVEL_NAMES = ['Menu link', 'Column / dropdown link', 'Sub-link'];
const EMPTY = {
  label: '', labelAr: '', linkType: 'category', categoryId: '', url: '',
  openNewTab: false, isMega: false, imageUrl: '', badge: '', isActive: true, parentId: 0,
};

const inputCls = 'w-full px-3 py-2 rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-900 text-surface-900 dark:text-white focus:ring-2 focus:ring-primary-500 text-sm';
const labelCls = 'block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1';

/**
 * Storefront navigation editor (Catalog → Menu).
 * Level 1 = top bar links (optionally a mega menu), level 2 = mega columns / dropdown links,
 * level 3 = links inside a column. Links can point to a category, a custom URL or nothing.
 */
export default function MenuManager({ canManage }) {
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // item id | null
  const [form, setForm] = useState(EMPTY);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  const load = async () => {
    try {
      const [m, c] = await Promise.all([api.get('/catalog/menu'), api.get('/catalog/categories?flat=true')]);
      setItems(m.data?.data || []);
      setCategories(c.data?.data || []);
    } catch {
      toast.error('Failed to load menu');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  // children grouped by parent, already ordered by the API
  const byParent = useMemo(() => {
    const map = new Map();
    items.forEach((i) => {
      if (!map.has(i.parent_id)) map.set(i.parent_id, []);
      map.get(i.parent_id).push(i);
    });
    return map;
  }, [items]);

  const catName = (id) => categories.find((c) => c.id === id)?.name;
  // Category options shown with their parent for clarity ("Perfumes › Oriental Fragrance")
  const categoryOptions = useMemo(() => {
    const byId = new Map(categories.map((c) => [c.id, c]));
    return categories
      .map((c) => ({ id: c.id, label: c.parent_id && byId.get(c.parent_id) ? `${byId.get(c.parent_id).name} › ${c.name}` : c.name, inactive: !c.is_active }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [categories]);

  const levelOf = (parentId) => {
    let level = 1;
    let cur = items.find((i) => i.id === parentId);
    while (cur) { level += 1; cur = items.find((i) => i.id === cur.parent_id); }
    return level;
  };

  const openCreate = (parentId = 0) => {
    setForm({ ...EMPTY, parentId, linkType: parentId ? 'category' : 'custom' });
    setEditing(null);
    setOpen(true);
  };

  const openEdit = (it) => {
    setForm({
      label: it.label, labelAr: it.label_ar || '', linkType: it.link_type,
      categoryId: it.category_id || '', url: it.url || '', openNewTab: !!it.open_new_tab,
      isMega: !!it.is_mega, imageUrl: it.image_url || '', badge: it.badge || '',
      isActive: !!it.is_active, parentId: it.parent_id,
    });
    setEditing(it.id);
    setOpen(true);
  };

  const payloadOf = (f) => ({
    parentId: f.parentId,
    label: f.label.trim(),
    labelAr: f.labelAr.trim(),
    linkType: f.linkType,
    categoryId: f.linkType === 'category' ? Number(f.categoryId) || null : null,
    url: f.linkType === 'custom' ? f.url.trim() : '',
    openNewTab: f.openNewTab,
    isMega: f.parentId ? false : f.isMega,
    imageUrl: f.imageUrl.trim(),
    badge: f.badge.trim(),
    isActive: f.isActive,
  });

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) await api.put(`/catalog/menu/${editing}`, payloadOf(form));
      else await api.post('/catalog/menu', payloadOf(form));
      toast.success(editing ? 'Menu item updated' : 'Menu item added');
      setOpen(false);
      await load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save menu item');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (it) => {
    try {
      await api.put(`/catalog/menu/${it.id}`, {
        parentId: it.parent_id, label: it.label, labelAr: it.label_ar || '', linkType: it.link_type,
        categoryId: it.category_id, url: it.url || '', openNewTab: !!it.open_new_tab, isMega: !!it.is_mega,
        imageUrl: it.image_url || '', badge: it.badge || '', isActive: !it.is_active,
      });
      await load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update');
    }
  };

  const remove = async (it) => {
    const kids = byParent.get(it.id)?.length;
    if (!window.confirm(`Delete "${it.label}"${kids ? ` and its ${kids} child item(s)` : ''}?`)) return;
    try {
      await api.delete(`/catalog/menu/${it.id}`);
      toast.success('Menu item deleted');
      await load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete');
    }
  };

  const move = async (it, dir) => {
    const siblings = byParent.get(it.parent_id) || [];
    const idx = siblings.findIndex((s) => s.id === it.id);
    const swap = idx + dir;
    if (swap < 0 || swap >= siblings.length) return;
    const ids = siblings.map((s) => s.id);
    [ids[idx], ids[swap]] = [ids[swap], ids[idx]];
    try {
      await api.post('/catalog/menu/reorder', { parentId: it.parent_id, ids });
      await load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to reorder');
    }
  };

  const upload = async (file) => {
    if (!file) return;
    const fd = new FormData();
    fd.append('dir', 'Products');
    fd.append('files', file);
    setUploading(true);
    try {
      const { data } = await api.post('/files/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      const url = data.files?.[0]?.url;
      if (url) setForm((p) => ({ ...p, imageUrl: url }));
    } catch (err) {
      toast.error(err.response?.data?.error || 'Image upload failed');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const renderRow = (it, level) => {
    const kids = byParent.get(it.id) || [];
    const siblings = byParent.get(it.parent_id) || [];
    const idx = siblings.findIndex((s) => s.id === it.id);
    const target = it.link_type === 'category'
      ? `Category: ${it.category_name || catName(it.category_id) || '(deleted)'}`
      : it.link_type === 'custom' ? (it.url || 'No link') : 'Heading only (no link)';
    return (
      <div key={it.id}>
        <div className={`flex items-center gap-2 px-3 py-2.5 border-b border-surface-100 dark:border-surface-700 ${it.is_active ? '' : 'opacity-50'}`}
          style={{ paddingInlineStart: `${12 + (level - 1) * 28}px` }}>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-sm text-surface-900 dark:text-white truncate">{it.label}</span>
              {it.label_ar && <span className="text-xs text-surface-400" dir="rtl">{it.label_ar}</span>}
              {!!it.is_mega && <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 font-semibold">MEGA MENU</span>}
              {it.badge && <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-amber-100 text-amber-700 font-semibold">{it.badge}</span>}
              {it.image_url && <HiOutlinePhotograph className="w-3.5 h-3.5 text-surface-400" title="Has image" />}
            </div>
            <p className="text-xs text-surface-500 dark:text-surface-400 truncate font-mono">{target}</p>
          </div>
          {canManage && (
            <div className="flex items-center gap-0.5 shrink-0">
              <button title="Move up" disabled={idx === 0} onClick={() => move(it, -1)} className="p-1.5 text-surface-400 hover:text-primary-600 disabled:opacity-25 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-700"><HiOutlineArrowUp className="w-4 h-4" /></button>
              <button title="Move down" disabled={idx === siblings.length - 1} onClick={() => move(it, 1)} className="p-1.5 text-surface-400 hover:text-primary-600 disabled:opacity-25 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-700"><HiOutlineArrowDown className="w-4 h-4" /></button>
              <button title={it.is_active ? 'Hide' : 'Show'} onClick={() => toggleActive(it)} className="p-1.5 text-surface-400 hover:text-primary-600 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-700">
                {it.is_active ? <HiOutlineEye className="w-4 h-4" /> : <HiOutlineEyeOff className="w-4 h-4" />}
              </button>
              {level < MAX_DEPTH && (
                <button title={`Add ${LEVEL_NAMES[level].toLowerCase()}`} onClick={() => openCreate(it.id)} className="p-1.5 text-surface-400 hover:text-emerald-600 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-700"><HiOutlinePlus className="w-4 h-4" /></button>
              )}
              <button title="Edit" onClick={() => openEdit(it)} className="p-1.5 text-surface-400 hover:text-primary-600 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-700"><HiOutlinePencil className="w-4 h-4" /></button>
              <button title="Delete" onClick={() => remove(it)} className="p-1.5 text-surface-400 hover:text-red-600 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-700"><HiOutlineTrash className="w-4 h-4" /></button>
            </div>
          )}
        </div>
        {kids.map((k) => renderRow(k, level + 1))}
      </div>
    );
  };

  if (loading) {
    return <div className="flex justify-center py-16"><div className="w-7 h-7 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>;
  }

  const formLevel = levelOf(form.parentId);

  return (
    <div className="bg-white dark:bg-surface-800 rounded-xl border border-surface-200 dark:border-surface-700 overflow-hidden">
      <div className="px-4 py-3 border-b border-surface-200 dark:border-surface-700 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-surface-500 dark:text-surface-400 max-w-xl">
          This is the storefront header menu. Tick <b>Mega menu</b> on a top-level link to show its
          columns (level 2) and links (level 3) in a large panel; otherwise children show as a simple dropdown.
          Changes appear on the storefront within about a minute.
        </p>
        {canManage && (
          <button onClick={() => openCreate(0)} className="btn btn-primary flex items-center gap-2 text-sm">
            <HiOutlinePlus className="w-4 h-4" /> Add menu link
          </button>
        )}
      </div>

      {(byParent.get(0) || []).map((it) => renderRow(it, 1))}

      {items.length === 0 && (
        <div className="text-center py-12 text-surface-500 dark:text-surface-400">
          <HiOutlineViewGridAdd className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No menu items yet. The storefront falls back to its default menu.</p>
        </div>
      )}

      {open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-3 sm:p-4">
          <div className="bg-white dark:bg-surface-800 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-surface-200 dark:border-surface-700">
              <h2 className="text-base sm:text-lg font-semibold text-surface-900 dark:text-white">
                {editing ? 'Edit' : 'Add'} {LEVEL_NAMES[Math.min(formLevel, 3) - 1].toLowerCase()}
              </h2>
              <button onClick={() => setOpen(false)} className="text-surface-400 hover:text-surface-600"><HiOutlineX className="w-5 h-5" /></button>
            </div>
            <form onSubmit={save} className="p-4 sm:p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Label (EN)</label>
                  <input required maxLength={100} className={inputCls} value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
                </div>
                <div>
                  <label className={labelCls}>Label (AR)</label>
                  <input dir="rtl" maxLength={100} className={inputCls} value={form.labelAr} onChange={(e) => setForm({ ...form, labelAr: e.target.value })} />
                </div>
              </div>

              <div>
                <label className={labelCls}>Links to</label>
                <select className={inputCls} value={form.linkType} onChange={(e) => setForm({ ...form, linkType: e.target.value })}>
                  <option value="category">A catalog category</option>
                  <option value="custom">A page / custom URL</option>
                  <option value="none">Nothing (heading only)</option>
                </select>
              </div>

              {form.linkType === 'category' && (
                <div>
                  <label className={labelCls}>Category</label>
                  <select required className={inputCls} value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
                    <option value="">Select a category…</option>
                    {categoryOptions.map((c) => <option key={c.id} value={c.id}>{c.label}{c.inactive ? ' (inactive)' : ''}</option>)}
                  </select>
                </div>
              )}

              {form.linkType === 'custom' && (
                <div>
                  <label className={labelCls}>URL</label>
                  <input className={inputCls} placeholder="/story  or  https://example.com" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />
                  <p className="text-xs text-surface-400 mt-1">Internal pages start with <code>/</code>. Only / and http(s):// links are accepted.</p>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Badge (optional)</label>
                  <input maxLength={30} className={inputCls} placeholder="New, Sale…" value={form.badge} onChange={(e) => setForm({ ...form, badge: e.target.value })} />
                </div>
                <div>
                  <label className={labelCls}>Image (optional)</label>
                  <div className="flex items-center gap-2">
                    {form.imageUrl && <img src={assetUrl(form.imageUrl)} alt="" className="w-9 h-9 rounded object-cover border border-surface-200" />}
                    <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
                    <button type="button" disabled={uploading} onClick={() => fileRef.current?.click()} className="btn btn-secondary text-xs">{uploading ? 'Uploading…' : form.imageUrl ? 'Replace' : 'Upload'}</button>
                    {form.imageUrl && <button type="button" onClick={() => setForm({ ...form, imageUrl: '' })} className="text-xs text-red-500">Remove</button>}
                  </div>
                  <p className="text-xs text-surface-400 mt-1">Shown on mega-menu columns.</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-surface-700 dark:text-surface-300">
                {!form.parentId && (
                  <label className="flex items-center gap-2"><input type="checkbox" checked={form.isMega} onChange={(e) => setForm({ ...form, isMega: e.target.checked })} /> Mega menu</label>
                )}
                <label className="flex items-center gap-2"><input type="checkbox" checked={form.openNewTab} onChange={(e) => setForm({ ...form, openNewTab: e.target.checked })} /> Open in new tab</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} /> Visible</label>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setOpen(false)} className="btn btn-secondary text-sm">Cancel</button>
                <button type="submit" disabled={saving} className="btn btn-primary text-sm">{saving ? 'Saving…' : 'Save'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
