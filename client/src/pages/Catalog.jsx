import { useState, useEffect } from 'react';
import MenuManager from '../components/catalog/MenuManager';
import api from '../services/api';
import { toast } from '../components/ui/Toast';
import { usePermission } from '../hooks/usePermission';
import {
  HiOutlinePlus, HiOutlinePencil, HiOutlineTrash,
  HiOutlineFolder, HiOutlineFolderOpen, HiOutlineX,
  HiOutlineChevronRight, HiOutlineChevronDown,
  HiOutlineTag,
} from 'react-icons/hi';

const EMPTY_CAT = { name: '', nameAr: '', slug: '', description: '', parentId: 0, sortOrder: 0, isActive: true };
const EMPTY_BRAND = { name: '', slug: '', logoUrl: '', isActive: true };

export default function Catalog() {
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(null); // 'category' | 'brand' | null
  const [editing, setEditing] = useState(null);
  const [catForm, setCatForm] = useState(EMPTY_CAT);
  const [brandForm, setBrandForm] = useState(EMPTY_BRAND);
  const [expanded, setExpanded] = useState(new Set());

  const canReadCats = usePermission('categories.read') || usePermission('categories.manage');
  const canManageCats = usePermission('categories.manage');
  const canReadBrands = usePermission('brands.read') || usePermission('brands.manage');
  const canManageBrands = usePermission('brands.manage');

  const [tab, setTab] = useState(() => (canReadCats ? 'categories' : canReadBrands ? 'brands' : 'categories'));

  useEffect(() => {
    if (!canReadCats && canReadBrands && tab === 'categories') {
      setTab('brands');
    } else if (!canReadBrands && canReadCats && tab === 'brands') {
      setTab('categories');
    }
  }, [canReadCats, canReadBrands, tab]);

  const fetchCategories = async () => {
    if (!canReadCats) return;
    try {
      const res = await api.get('/catalog/categories');
      setCategories(res.data?.data || []);
    } catch (err) {
      console.error('Failed to load categories', err);
      toast.error('Failed to load categories');
    }
  };

  const fetchBrands = async () => {
    if (!canReadBrands) return;
    try {
      const res = await api.get('/catalog/brands');
      setBrands(res.data?.data || []);
    } catch (err) {
      console.error('Failed to load brands', err);
      toast.error('Failed to load brands');
    }
  };

  const fetchAll = async () => {
    setLoading(true);
    const promises = [];

    if (canReadCats) {
      promises.push(
        api.get('/catalog/categories')
          .then((res) => setCategories(res.data?.data || []))
          .catch((err) => {
            console.error('Failed to load categories', err);
            toast.error('Failed to load categories');
          })
      );
    } else {
      setCategories([]);
    }

    if (canReadBrands) {
      promises.push(
        api.get('/catalog/brands')
          .then((res) => setBrands(res.data?.data || []))
          .catch((err) => {
            console.error('Failed to load brands', err);
            toast.error('Failed to load brands');
          })
      );
    } else {
      setBrands([]);
    }

    try {
      await Promise.all(promises);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, [canReadCats, canReadBrands]);

  const toggleExpand = (id) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // ─── Category CRUD ──────────────────────────────
  const openCreateCat = (parentId = 0) => {
    setCatForm({ ...EMPTY_CAT, parentId: parseInt(parentId, 10) || 0 });
    setEditing(null);
    setShowModal('category');
  };

  const openEditCat = (cat) => {
    setCatForm({
      name: cat.name,
      nameAr: cat.name_ar || '',
      slug: cat.slug,
      description: cat.description || '',
      parentId: parseInt(cat.parent_id, 10) || 0,
      sortOrder: cat.sort_order ?? 0,
      isActive: Boolean(cat.is_active),
    });
    setEditing(cat.id);
    setShowModal('category');
  };

  const saveCat = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...catForm,
        parentId: parseInt(catForm.parentId, 10) || 0,
        sortOrder: parseInt(catForm.sortOrder, 10) || 0,
        isActive: Boolean(catForm.isActive),
      };
      if (editing) {
        await api.put(`/catalog/categories/${editing}`, payload);
        toast.success('Category updated');
      } else {
        await api.post('/catalog/categories', payload);
        toast.success('Category created');
      }
      setShowModal(null);
      fetchCategories();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save category');
    }
  };

  const deleteCat = async (id) => {
    if (!confirm('Delete this category? Children will become top-level.')) return;
    try {
      await api.delete(`/catalog/categories/${id}`);
      toast.success('Category deleted');
      fetchCategories();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete');
    }
  };

  // ─── Brand CRUD ──────────────────────────────────
  const openCreateBrand = () => {
    setBrandForm(EMPTY_BRAND);
    setEditing(null);
    setShowModal('brand');
  };

  const openEditBrand = (brand) => {
    setBrandForm({
      name: brand.name,
      slug: brand.slug,
      logoUrl: brand.logo_url || '',
      isActive: Boolean(brand.is_active),
    });
    setEditing(brand.id);
    setShowModal('brand');
  };

  const saveBrand = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...brandForm,
        isActive: Boolean(brandForm.isActive),
      };
      if (editing) {
        await api.put(`/catalog/brands/${editing}`, payload);
        toast.success('Brand updated');
      } else {
        await api.post('/catalog/brands', payload);
        toast.success('Brand created');
      }
      setShowModal(null);
      fetchBrands();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save brand');
    }
  };

  const deleteBrand = async (id) => {
    if (!confirm('Delete this brand?')) return;
    try {
      await api.delete(`/catalog/brands/${id}`);
      toast.success('Brand deleted');
      fetchBrands();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete');
    }
  };

  // Auto-generate slug from name
  const slugify = (text) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  // Flatten categories into hierarchical options for parent selector
  const getParentCategoryOptions = (cats, currentId, depth = 0) => {
    let options = [];
    for (const cat of cats) {
      if (currentId && cat.id === currentId) continue;
      options.push({
        id: cat.id,
        name: cat.name,
        nameAr: cat.name_ar,
        depth,
      });
      if (cat.children && cat.children.length > 0) {
        options = options.concat(getParentCategoryOptions(cat.children, currentId, depth + 1));
      }
    }
    return options;
  };

  const parentCategoryOptions = getParentCategoryOptions(categories, editing);

  // ─── Category tree renderer ──────────────────────
  const renderCategory = (cat, depth = 0) => {
    const hasChildren = cat.children && cat.children.length > 0;
    const isExpanded = expanded.has(cat.id);

    return (
      <div key={cat.id}>
        <div
          className={`flex items-center gap-3 px-3 sm:px-4 py-2 hover:bg-surface-50 dark:hover:bg-surface-700/50 transition-colors ${depth > 0 ? 'border-l-2 border-primary-200 dark:border-primary-800 ml-2.5 sm:ml-6' : ''
            }`}
        >
          {/* Expand toggle */}
          <button
            onClick={() => hasChildren && toggleExpand(cat.id)}
            className={`w-5 h-5 flex items-center justify-center text-surface-400 ${hasChildren ? 'cursor-pointer' : 'opacity-0'}`}
          >
            {hasChildren && (isExpanded ? <HiOutlineChevronDown className="w-4 h-4" /> : <HiOutlineChevronRight className="w-4 h-4" />)}
          </button>

          {/* Icon */}
          {hasChildren && isExpanded
            ? <HiOutlineFolderOpen className="w-5 h-5 text-primary-500 flex-shrink-0" />
            : <HiOutlineFolder className="w-5 h-5 text-surface-400 flex-shrink-0" />
          }

          {/* Name */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-surface-900 dark:text-white truncate">{cat.name}</span>
              {/* {cat.name_ar && <span className="text-xs text-surface-500 dark:text-surface-400 dir-rtl">{cat.name_ar}</span>} */}
            </div>
            <span className="text-xs text-surface-400 font-mono">/{cat.slug}</span>
          </div>

          {/* Status */}
          <span className={`px-2 py-0.5 text-xs rounded-full ${cat.is_active ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
            : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
            }`}>
            {cat.is_active ? 'Active' : 'Inactive'}
          </span>

          {/* Actions */}
          {canManageCats && (
            <div className="flex items-center gap-1">
              <button onClick={() => openCreateCat(cat.id)} className="p-1.5 text-surface-400 hover:text-primary-600 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-700" title="Add sub-category">
                <HiOutlinePlus className="w-4 h-4" />
              </button>
              <button onClick={() => openEditCat(cat)} className="p-1.5 text-surface-400 hover:text-primary-600 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-700" title="Edit">
                <HiOutlinePencil className="w-4 h-4" />
              </button>
              <button onClick={() => deleteCat(cat.id)} className="p-1.5 text-surface-400 hover:text-red-600 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-700" title="Delete">
                <HiOutlineTrash className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Children */}
        {hasChildren && isExpanded && (
          <div>{cat.children.map((child) => renderCategory(child, depth + 1))}</div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-surface-900 dark:text-white">Catalog</h1>
        <p className="text-surface-500 dark:text-surface-400 mt-1">
          Manage categories, subcategories, and brands
        </p>
      </div>

      {/* Tab bar */}
      {(canReadCats || canReadBrands) && (
        <div className="flex gap-1 bg-surface-100 dark:bg-surface-800 p-1 rounded-xl w-fit">
          {canReadCats && (<button
            onClick={() => setTab('categories')}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'categories'
              ? 'bg-white dark:bg-surface-700 text-surface-900 dark:text-white shadow-sm'
              : 'text-surface-500 dark:text-surface-400 hover:text-surface-700'
              }`}
          >
            <HiOutlineFolder className="w-4 h-4 inline-block mr-1.5 -mt-0.5" />
            Categories ({categories.reduce((c, cat) => c + 1 + (cat.children?.length || 0), 0)})
          </button>)}
          {canReadBrands && (<button
            onClick={() => setTab('brands')}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'brands'
              ? 'bg-white dark:bg-surface-700 text-surface-900 dark:text-white shadow-sm'
              : 'text-surface-500 dark:text-surface-400 hover:text-surface-700'
              }`}
          >
            <HiOutlineTag className="w-4 h-4 inline-block mr-1.5 -mt-0.5" />
            Brands ({brands.length})
          </button>)}
          {canReadCats && (<button
            onClick={() => setTab('menu')}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'menu'
              ? 'bg-white dark:bg-surface-700 text-surface-900 dark:text-white shadow-sm'
              : 'text-surface-500 dark:text-surface-400 hover:text-surface-700'
              }`}
          >
            Menu
          </button>)}
        </div>
      )}

      {/* ─── Menu Tab (storefront navigation / mega menu) ─── */}
      {tab === 'menu' && canReadCats && <MenuManager canManage={canManageCats} />}

      {/* ─── Categories Tab ──────────────────────────── */}
      {tab === 'categories' && canReadCats && (
        <div className="bg-white dark:bg-surface-800 rounded-xl border border-surface-200 dark:border-surface-700 overflow-hidden">
          {canManageCats && (
            <div className="px-4 py-3 border-b border-surface-200 dark:border-surface-700 flex justify-end">
              <button onClick={() => openCreateCat(0)} className="btn btn-primary flex items-center gap-2 text-sm">
                <HiOutlinePlus className="w-4 h-4" /> Add Category
              </button>
            </div>
          )}

          <div className="divide-y divide-surface-100 dark:divide-surface-700">
            {categories.map((cat) => renderCategory(cat))}
          </div>

          {categories.length === 0 && (
            <div className="text-center py-12 text-surface-500 dark:text-surface-400">
              <HiOutlineFolder className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No categories yet.</p>
            </div>
          )}
        </div>
      )}

      {/* ─── Brands Tab ──────────────────────────────── */}
      {tab === 'brands' && canReadBrands && (
        <div className="bg-white dark:bg-surface-800 rounded-xl border border-surface-200 dark:border-surface-700 overflow-hidden">
          {canManageBrands && (
            <div className="px-4 py-3 border-b border-surface-200 dark:border-surface-700 flex justify-end">
              <button onClick={() => openCreateBrand()} className="btn btn-primary flex items-center gap-2 text-sm">
                <HiOutlinePlus className="w-4 h-4" /> Add Brand
              </button>
            </div>
          )}

          <table className="w-full">
            <thead>
              <tr className="text-left text-xs font-semibold text-surface-500 dark:text-surface-300 uppercase tracking-wider border-b border-surface-200 dark:border-surface-700">
                <th className="px-4 py-3">Brand</th>
                <th className="px-4 py-3">Slug</th>
                <th className="px-4 py-3">Status</th>
                {canManageBrands && <th className="px-4 py-3 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100 dark:divide-surface-700">
              {brands.map((b) => (
                <tr key={b.id} className="hover:bg-surface-50 dark:hover:bg-surface-700/50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {b.logo_url ? (
                        <img src={b.logo_url} alt={b.name} className="w-8 h-8 object-contain rounded" />
                      ) : (
                        <div className="w-8 h-8 rounded bg-surface-100 dark:bg-surface-700 flex items-center justify-center text-surface-400">
                          <HiOutlineTag className="w-4 h-4" />
                        </div>
                      )}
                      <span className="font-medium text-surface-900 dark:text-white">{b.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-surface-500 dark:text-surface-400 font-mono">/{b.slug}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 text-xs rounded-full ${b.is_active ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                      : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                      }`}>
                      {b.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  {canManageBrands && (
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => openEditBrand(b)} className="p-1.5 text-surface-400 hover:text-primary-600 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-700">
                          <HiOutlinePencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => deleteBrand(b.id)} className="p-1.5 text-surface-400 hover:text-red-600 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-700">
                          <HiOutlineTrash className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>

          {brands.length === 0 && (
            <div className="text-center py-12 text-surface-500 dark:text-surface-400">
              <HiOutlineTag className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No brands yet.</p>
            </div>
          )}
        </div>
      )}

      {!canReadCats && !canReadBrands && (
        <div className="glass-card p-12 text-center text-surface-500 dark:text-surface-400">
          <p>You do not have permission to view categories or brands.</p>
        </div>
      )}

      {/* ─── Category Modal ──────────────────────────── */}
      {showModal === 'category' && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-3 sm:p-4">
          <div className="bg-white dark:bg-surface-800 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-surface-200 dark:border-surface-700">
              <h2 className="text-base sm:text-lg font-semibold text-surface-900 dark:text-white truncate">
                {editing ? 'Edit Category' : catForm.parentId > 0 ? 'Add Sub-category' : 'Add Category'}
              </h2>
              <button onClick={() => setShowModal(null)} className="text-surface-400 hover:text-surface-600 shrink-0">
                <HiOutlineX className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={saveCat} className="p-4 sm:p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Name (EN)</label>
                  <input
                    type="text" value={catForm.name}
                    onChange={(e) => {
                      const name = e.target.value;
                      setCatForm((prev) => ({ ...prev, name, slug: editing ? prev.slug : slugify(name) }));
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-900 text-surface-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Name (AR)</label>
                  <input
                    type="text" value={catForm.nameAr} dir="rtl"
                    onChange={(e) => setCatForm((prev) => ({ ...prev, nameAr: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-900 text-surface-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
                  Parent Category
                </label>
                <select
                  value={catForm.parentId ?? 0}
                  onChange={(e) => setCatForm((prev) => ({ ...prev, parentId: parseInt(e.target.value, 10) || 0 }))}
                  className="w-full px-3 py-2 rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-900 text-surface-900 dark:text-white focus:ring-2 focus:ring-primary-500 text-sm"
                >
                  <option value={0}>None (Top-Level Category)</option>
                  {parentCategoryOptions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.depth > 0 ? `${'— '.repeat(c.depth)}` : ''}{c.name} {c.nameAr ? `(${c.nameAr})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Slug</label>
                <input
                  type="text" value={catForm.slug}
                  onChange={(e) => setCatForm((prev) => ({ ...prev, slug: slugify(e.target.value) }))}
                  className="w-full px-3 py-2 rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-900 text-surface-900 dark:text-white focus:ring-2 focus:ring-primary-500 font-mono text-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Description</label>
                <textarea
                  value={catForm.description} rows={2}
                  onChange={(e) => setCatForm((prev) => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-900 text-surface-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Sort Order</label>
                  <input
                    type="number" value={catForm.sortOrder}
                    onChange={(e) => setCatForm((prev) => ({ ...prev, sortOrder: parseInt(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-900 text-surface-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 pb-2">
                    <input
                      type="checkbox" checked={Boolean(catForm.isActive)}
                      onChange={(e) => setCatForm((prev) => ({ ...prev, isActive: e.target.checked }))}
                      className="w-4 h-4 text-primary-600 rounded border-surface-300"
                    />
                    <span className="text-sm text-surface-700 dark:text-surface-300">Active</span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-surface-200 dark:border-surface-700">
                <button type="button" onClick={() => setShowModal(null)}
                  className="px-4 py-2 rounded-lg border border-surface-300 dark:border-surface-600 text-surface-700 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-700">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary px-6 py-2">
                  {editing ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Brand Modal ─────────────────────────────── */}
      {showModal === 'brand' && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-3 sm:p-4">
          <div className="bg-white dark:bg-surface-800 rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-surface-200 dark:border-surface-700">
              <h2 className="text-base sm:text-lg font-semibold text-surface-900 dark:text-white truncate">
                {editing ? 'Edit Brand' : 'Add Brand'}
              </h2>
              <button onClick={() => setShowModal(null)} className="text-surface-400 hover:text-surface-600 shrink-0">
                <HiOutlineX className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={saveBrand} className="p-4 sm:p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Brand Name</label>
                <input
                  type="text" value={brandForm.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    setBrandForm((prev) => ({ ...prev, name, slug: editing ? prev.slug : slugify(name) }));
                  }}
                  className="w-full px-3 py-2 rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-900 text-surface-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Slug</label>
                <input
                  type="text" value={brandForm.slug}
                  onChange={(e) => setBrandForm((prev) => ({ ...prev, slug: slugify(e.target.value) }))}
                  className="w-full px-3 py-2 rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-900 text-surface-900 dark:text-white focus:ring-2 focus:ring-primary-500 font-mono text-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Logo URL</label>
                <input
                  type="text" value={brandForm.logoUrl}
                  onChange={(e) => setBrandForm((prev) => ({ ...prev, logoUrl: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-900 text-surface-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                  placeholder="/LOGO/Full-Logo.svg"
                />
              </div>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox" checked={Boolean(brandForm.isActive)}
                  onChange={(e) => setBrandForm((prev) => ({ ...prev, isActive: e.target.checked }))}
                  className="w-4 h-4 text-primary-600 rounded border-surface-300"
                />
                <span className="text-sm text-surface-700 dark:text-surface-300">Active</span>
              </label>

              <div className="flex justify-end gap-3 pt-4 border-t border-surface-200 dark:border-surface-700">
                <button type="button" onClick={() => setShowModal(null)}
                  className="px-4 py-2 rounded-lg border border-surface-300 dark:border-surface-600 text-surface-700 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-700">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary px-6 py-2">
                  {editing ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
