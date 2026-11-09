import { useState, useEffect, useCallback, Fragment } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../services/api';
import { toast } from '../components/ui/Toast';
import { useCountry } from '../context/CountryContext';
import { usePermission } from '../hooks/usePermission';
import PermissionGate from '../components/ui/PermissionGate';
import ProductEditor from '../components/products/ProductEditor';
import Pagination from '../components/ui/Pagination';
import {
  HiOutlinePlus,
  HiOutlinePencil,
  HiOutlineDuplicate,
  HiOutlineTrash,
  HiOutlineSearch,
  HiOutlineFilter,
  HiOutlineViewGrid,
  HiOutlineViewList,
  HiOutlineSparkles,
  HiOutlineGlobeAlt,
  HiOutlineTag,
  HiOutlineX,
  HiOutlineChevronDown,
  HiStar,
  HiOutlineGift,
  HiOutlineRefresh,
} from 'react-icons/hi';

import { CountryBadge } from '../components/ui/CountryFlag';
import { useTrashSelection } from '../hooks/useTrashSelection';
import {
  TrashViewTabs,
  TrashBanner,
  TrashCountdown,
  BulkActionBar,
  ConfirmDialog,
  TRASH_RETENTION_DAYS,
} from '../components/ui/TrashControls';

export default function Products() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { selectedCountry, countries } = useCountry();
  const [products, setProducts] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 12, total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [categoryId, setCategoryId] = useState('');
  const [sizeId, setSizeId] = useState('');
  const [olfactoryFamilyId, setOlfactoryFamilyId] = useState('');
  const [status, setStatus] = useState('');
  const [gender, setGender] = useState('');
  const [isAvailableFilter, setIsAvailableFilter] = useState('');
  const [togglingId, setTogglingId] = useState(null);
  const [viewMode, setViewMode] = useState('table'); // 'grid' | 'table'
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [expandedRowId, setExpandedRowId] = useState(null);
  const [showTrash, setShowTrash] = useState(false); // Active | Trash view
  const [confirm, setConfirm] = useState(null); // { action: 'trash' | 'purge', ids: number[] }

  const toggleRowExpand = (id) => {
    setExpandedRowId((prev) => (prev === id ? null : id));
  };

  // Lookups
  const [metadata, setMetadata] = useState({ categories: [], sizes: [], olfactoryFamilies: [] });

  const activeFilterCount = [
    categoryId,
    sizeId,
    olfactoryFamilyId,
    status,
    isAvailableFilter,
  ].filter(Boolean).length;

  const handleResetFilters = () => {
    setCategoryId('');
    setSizeId('');
    setOlfactoryFamilyId('');
    setStatus('');
    setIsAvailableFilter('');
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  // Editor Modal
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingProductId, setEditingProductId] = useState(null);
  // When set (and editingProductId is null) the editor opens as a new product pre-filled from this one
  const [cloneFromId, setCloneFromId] = useState(null);

  const canCreate = usePermission('products.create');
  const canUpdate = usePermission('products.update') || usePermission('products.update_content');
  const canFullUpdate = usePermission('products.update');
  const canDelete = usePermission('products.delete');
  const canViewPricing = canFullUpdate;

  const fetchMetadata = async () => {
    try {
      const { data } = await api.get('/products/metadata');
      setMetadata(data.data);
    } catch {
      // non-blocking
    }
  };

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        page: pagination.page,
        limit: pagination.limit,
        countryId: selectedCountry?.id,
        search: search || undefined,
        categoryId: categoryId || undefined,
        sizeId: sizeId || undefined,
        olfactoryFamilyId: olfactoryFamilyId || undefined,
        status: status || undefined,
        gender: gender || undefined,
        isAvailable: isAvailableFilter || undefined,
        trashed: showTrash || undefined,
      };

      const { data } = await api.get('/products', { params });
      setProducts(data.products || []);
      setPagination(data.pagination || { page: 1, limit: 12, total: 0, pages: 1 });
    } catch (err) {
      toast.error('Failed to load products');
    } finally {
      setLoading(false);
    }
  }, [
    pagination.page,
    pagination.limit,
    selectedCountry?.id,
    search,
    categoryId,
    sizeId,
    olfactoryFamilyId,
    status,
    gender,
    isAvailableFilter,
    showTrash,
  ]);

  useEffect(() => {
    fetchMetadata();
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // Bulk selection + Trash actions (shared with the Orders page)
  const trash = useTrashSelection({ basePath: '/products', items: products, onDone: fetchProducts });

  // Handle incoming edit or new query param (e.g. from Dashboard or deep-links)
  useEffect(() => {
    const editId = searchParams.get('edit');
    if (editId) {
      setEditingProductId(parseInt(editId, 10));
      setEditorOpen(true);
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('edit');
      setSearchParams(newParams, { replace: true });
    } else if (searchParams.get('action') === 'new') {
      setEditingProductId(null);
      setEditorOpen(true);
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('action');
      setSearchParams(newParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const handleOpenClone = (id) => {
    setEditingProductId(null);
    setCloneFromId(id);
    setEditorOpen(true);
  };

  const handleOpenCreate = () => {
    setEditingProductId(null);
    setCloneFromId(null);
    setEditorOpen(true);
  };

  const handleOpenEdit = (id) => {
    setCloneFromId(null);
    setEditingProductId(id);
    setEditorOpen(true);
  };

  const handleToggleAvailability = async (prod) => {
    if (!selectedCountry?.id) {
      toast.error('Please select an active country');
      return;
    }
    if (!canFullUpdate) {
      toast.error('You do not have permission to update availability');
      return;
    }

    const currentAvailable = prod.is_available !== false;
    const newAvailable = !currentAvailable;
    setTogglingId(prod.id);

    // Optimistic update
    setProducts((prev) =>
      prev.map((p) => (p.id === prod.id ? { ...p, is_available: newAvailable } : p))
    );

    try {
      await api.put(`/products/${prod.id}/pricing`, {
        pricing: [
          {
            country_id: selectedCountry.id,
            is_available: newAvailable,
          },
        ],
      });
      toast.success(
        `Marked as ${newAvailable ? 'Available' : 'Unavailable'} in ${selectedCountry.name || selectedCountry.code}`
      );
    } catch (err) {
      // Revert on error
      setProducts((prev) =>
        prev.map((p) => (p.id === prod.id ? { ...p, is_available: currentAvailable } : p))
      );
      toast.error(err.response?.data?.error || 'Failed to update availability');
    } finally {
      setTogglingId(null);
    }
  };

  /** Row-level buttons: Trash (active view) or Restore / Delete permanently (Trash view). */
  const renderTrashActions = (prod) => {
    const stop = (fn) => (e) => {
      e.stopPropagation();
      fn();
    };
    const cls = 'btn-ghost p-1.5 rounded-lg active:scale-95';
    if (!showTrash) {
      return (
        <button
          type="button"
          onClick={stop(() => setConfirm({ action: 'trash', ids: [prod.id] }))}
          className={`${cls} text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30`}
          title="Move to Trash"
        >
          <HiOutlineTrash className="w-4 h-4" />
        </button>
      );
    }
    return (
      <>
        <button
          type="button"
          onClick={stop(() => trash.run('restore', [prod.id]))}
          className={`${cls} text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30`}
          title="Restore"
        >
          <HiOutlineRefresh className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={stop(() => setConfirm({ action: 'purge', ids: [prod.id] }))}
          className={`${cls} text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30`}
          title="Delete permanently"
        >
          <HiOutlineX className="w-4 h-4" />
        </button>
      </>
    );
  };

  const formatPrice = (price, decimals = 2, symbol = '') => {
    if (price === undefined || price === null) return '—';
    const num = parseFloat(price);
    const formatted = num.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
    return `${formatted} ${symbol || ''}`.trim();
  };

  // Sort and indent categories hierarchically for the filter dropdown
  const hierarchicalCategories = (() => {
    const cats = metadata.categories || [];
    const catMap = new Map(cats.map((c) => [c.id, { ...c, children: [] }]));
    const roots = [];

    for (const c of cats) {
      const item = catMap.get(c.id);
      if (c.parent_id === 0 || !catMap.has(c.parent_id)) {
        roots.push(item);
      } else {
        catMap.get(c.parent_id).children.push(item);
      }
    }

    const flat = [];
    const traverse = (list, depth = 0) => {
      for (const item of list) {
        flat.push({ ...item, depth });
        if (item.children && item.children.length > 0) {
          traverse(item.children, depth + 1);
        }
      }
    };
    traverse(roots, 0);
    return flat;
  })();

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-surface-900 dark:text-white font-display">
              Fragrance Products
            </h1>
            <span className="badge-primary text-xs">
              {pagination.total} {pagination.total === 1 ? 'Perfume' : 'Perfumes'}
            </span>
          </div>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
            Manage luxury perfumes, olfactory notes, dynamic specifications, and per-country prices
          </p>
        </div>

        <div className="flex items-center gap-3 justify-end flex-wrap">
          {canDelete && (
            <TrashViewTabs
              showTrash={showTrash}
              trashCount={trash.trashCount}
              onChange={(v) => {
                setShowTrash(v);
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}
            />
          )}
          {/* Active Country Tag */}
          {selectedCountry && (
            <CountryBadge
              code={selectedCountry.code}
              label={`${selectedCountry.name} (${selectedCountry.currency_code})`}
              size="xs"
              className="px-3 py-1.5 rounded-xl bg-white dark:bg-surface-800 text-xs shadow-xs"
            />
          )}

          <PermissionGate permission="products.create">
            <button onClick={handleOpenCreate} className="btn-primary flex items-center gap-2">
              <HiOutlinePlus className="w-4 h-4" /> Add Perfume
            </button>
          </PermissionGate>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="glass-card p-2 sm:p-4 bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 transition-all duration-300 shadow-sm">
        {/* Top Single-Line Bar */}
        <div className="flex items-center gap-1.5 sm:gap-3">
          {/* Search Input */}
          <div className="relative flex-1 group">
            <HiOutlineSearch className="absolute left-3 sm:left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 sm:w-4 sm:h-4 text-surface-400 group-focus-within:text-purple-600 dark:group-focus-within:text-purple-400 transition-colors" />
            <input
              type="text"
              placeholder="Search perfume, SKU, slug..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 sm:pl-10 pr-7 sm:pr-8 py-1.5 sm:py-2 text-xs rounded-xl bg-surface-50 dark:bg-surface-800/70 border border-surface-200 dark:border-surface-700/80 text-surface-900 dark:text-white placeholder-surface-400 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2 sm:right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full text-surface-400 hover:text-surface-600 dark:hover:text-surface-200 transition-colors"
                title="Clear search"
              >
                <HiOutlineX className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Mobile Filter Toggle Button (Single Line on Mobile) */}
          <button
            type="button"
            onClick={() => setShowMobileFilters((prev) => !prev)}
            className={`sm:hidden relative flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all active:scale-95 shrink-0 ${
              activeFilterCount > 0
                ? 'bg-purple-600 text-white shadow-sm ring-2 ring-purple-500/25'
                : showMobileFilters
                  ? 'bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-300 border border-purple-200 dark:border-purple-800/80'
                  : 'bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-300 border border-surface-200/60 dark:border-surface-700/60 hover:bg-surface-200 dark:hover:bg-surface-700'
            }`}
            title="Toggle Filters"
          >
            <HiOutlineFilter className={`w-3.5 h-3.5 transition-transform duration-200 ${showMobileFilters ? 'rotate-180 text-current' : ''}`} />
            <span className="text-[11px]">Filter</span>
            {activeFilterCount > 0 && (
              <span className={`inline-flex items-center justify-center min-w-4 h-4 px-1 rounded-full text-[9px] font-bold ${
                activeFilterCount > 0 ? 'bg-white text-purple-600 dark:bg-surface-900 dark:text-purple-400' : 'bg-purple-600 text-white'
              }`}>
                {activeFilterCount}
              </span>
            )}
          </button>

          {/* View Toggle on Mobile (Single Compact Animated Button) */}
          <button
            type="button"
            onClick={() => setViewMode((prev) => (prev === 'grid' ? 'table' : 'grid'))}
            className="sm:hidden p-1.5 rounded-xl bg-surface-100 dark:bg-surface-800 border border-surface-200/60 dark:border-surface-700/60 text-surface-600 dark:text-surface-300 active:scale-95 transition-all shrink-0 hover:text-purple-600 dark:hover:text-purple-400"
            title={viewMode === 'grid' ? 'Switch to Table View' : 'Switch to Grid View'}
          >
            {viewMode === 'grid' ? (
              <HiOutlineViewList className="w-4 h-4 text-purple-600 dark:text-purple-400 transition-all duration-200" />
            ) : (
              <HiOutlineViewGrid className="w-4 h-4 text-purple-600 dark:text-purple-400 transition-all duration-200" />
            )}
          </button>

          {/* View Toggle on Desktop (Dual pill) */}
          <div className="hidden sm:flex bg-surface-100 dark:bg-surface-800 p-1 rounded-xl shrink-0">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-lg transition-all ${
                viewMode === 'grid'
                  ? 'bg-white dark:bg-surface-700 text-purple-600 dark:text-purple-400 shadow-sm'
                  : 'text-surface-400 hover:text-surface-600 dark:text-surface-400 dark:hover:text-surface-200'
              }`}
              title="Grid View"
            >
              <HiOutlineViewGrid className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`p-2 rounded-lg transition-all ${
                viewMode === 'table'
                  ? 'bg-white dark:bg-surface-700 text-purple-600 dark:text-purple-400 shadow-sm'
                  : 'text-surface-400 hover:text-surface-600 dark:text-surface-400 dark:hover:text-surface-200'
              }`}
              title="Table View"
            >
              <HiOutlineViewList className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Mobile Quick Active Filter Chips (When collapsed and has active filters) */}
        {activeFilterCount > 0 && !showMobileFilters && (
          <div className="flex sm:hidden items-center gap-1.5 pt-1.5 overflow-x-auto no-scrollbar animate-fade-in text-[10px]">
            <span className="text-surface-400 font-medium shrink-0">Active:</span>
            {categoryId && (
              <button
                type="button"
                onClick={() => setCategoryId('')}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 shrink-0 font-medium"
              >
                <span>{metadata.categories.find((c) => String(c.id) === String(categoryId))?.name || 'Category'}</span>
                <HiOutlineX className="w-3 h-3" />
              </button>
            )}
            {sizeId && (
              <button
                type="button"
                onClick={() => setSizeId('')}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 shrink-0 font-medium"
              >
                <span>{metadata.sizes.find((s) => String(s.id) === String(sizeId))?.name || 'Size'}</span>
                <HiOutlineX className="w-3 h-3" />
              </button>
            )}
            {olfactoryFamilyId && (
              <button
                type="button"
                onClick={() => setOlfactoryFamilyId('')}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 shrink-0 font-medium"
              >
                <span>{metadata.olfactoryFamilies.find((f) => String(f.id) === String(olfactoryFamilyId))?.name || 'Family'}</span>
                <HiOutlineX className="w-3 h-3" />
              </button>
            )}
            {status && (
              <button
                type="button"
                onClick={() => {
                  setStatus('');
                  setPagination((prev) => ({ ...prev, page: 1 }));
                }}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 shrink-0 font-medium capitalize"
              >
                <span>{status}</span>
                <HiOutlineX className="w-3 h-3" />
              </button>
            )}
            {isAvailableFilter && (
              <button
                type="button"
                onClick={() => {
                  setIsAvailableFilter('');
                  setPagination((prev) => ({ ...prev, page: 1 }));
                }}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 shrink-0 font-medium"
              >
                <span>{isAvailableFilter === 'true' ? 'Available' : 'Unavailable'}</span>
                <HiOutlineX className="w-3 h-3" />
              </button>
            )}
            <button
              type="button"
              onClick={handleResetFilters}
              className="text-purple-600 dark:text-purple-400 font-semibold underline shrink-0 pl-0.5"
            >
              Reset
            </button>
          </div>
        )}

        {/* Expandable Filter Section (Smooth animation on mobile, always visible on sm+) */}
        <div
          className={`overflow-hidden transition-all duration-300 ease-in-out ${
            showMobileFilters
              ? 'max-h-[500px] opacity-100 pt-2.5 sm:pt-3 border-t border-surface-100 dark:border-surface-800/80 mt-2 sm:mt-0'
              : 'max-h-0 opacity-0 sm:max-h-none sm:opacity-100 sm:pt-3 sm:border-t-0'
          }`}
        >
          {/* Mobile Drawer Header */}
          <div className="flex sm:hidden items-center justify-between pb-2 mb-1">
            <span className="text-[11px] font-semibold text-surface-700 dark:text-surface-300">
              Filter Options {activeFilterCount > 0 ? `(${activeFilterCount} active)` : ''}
            </span>
            <div className="flex items-center gap-2">
              {activeFilterCount > 0 && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="text-[11px] text-purple-600 dark:text-purple-400 font-semibold hover:underline"
                >
                  Reset all
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowMobileFilters(false)}
                className="text-[11px] font-medium text-surface-400 hover:text-surface-600 dark:hover:text-surface-200 flex items-center gap-0.5"
              >
                <span>Done</span>
              </button>
            </div>
          </div>

          {/* Filter Dropdowns Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3">
            {/* Category Filter */}
            <div>
              <label className="sm:hidden block text-[10px] font-medium text-surface-500 dark:text-surface-400 mb-1">
                Category
              </label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="input-field text-xs py-1.5 sm:py-2 w-full"
              >
                <option value="">All Categories</option>
                {hierarchicalCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.depth > 0 ? `${'— '.repeat(c.depth)}` : ''}{c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Size Filter */}
            <div>
              <label className="sm:hidden block text-[10px] font-medium text-surface-500 dark:text-surface-400 mb-1">
                Bottle Size
              </label>
              <select
                value={sizeId}
                onChange={(e) => setSizeId(e.target.value)}
                className="input-field text-xs py-1.5 sm:py-2 w-full"
              >
                <option value="">All Sizes</option>
                {metadata.sizes.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.unit})
                  </option>
                ))}
              </select>
            </div>

            {/* Olfactory Family Filter */}
            <div>
              <label className="sm:hidden block text-[10px] font-medium text-surface-500 dark:text-surface-400 mb-1">
                Fragrance Family
              </label>
              <select
                value={olfactoryFamilyId}
                onChange={(e) => setOlfactoryFamilyId(e.target.value)}
                className="input-field text-xs py-1.5 sm:py-2 w-full"
              >
                <option value="">All Families</option>
                {metadata.olfactoryFamilies.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            {canFullUpdate && (
              <div>
                <label className="sm:hidden block text-[10px] font-medium text-surface-500 dark:text-surface-400 mb-1">
                  Status
                </label>
                <select
                  value={status}
                  onChange={(e) => {
                    setStatus(e.target.value);
                    setPagination((prev) => ({ ...prev, page: 1 }));
                  }}
                  className="input-field text-xs py-1.5 sm:py-2 capitalize w-full"
                >
                  <option value="">All Status</option>
                  <option value="active">Active</option>
                  <option value="draft">Draft</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
            )}

            {/* Availability Filter */}
            <div className={!canFullUpdate ? 'col-span-2 sm:col-span-1' : ''}>
              <label className="sm:hidden block text-[10px] font-medium text-surface-500 dark:text-surface-400 mb-1">
                Market
              </label>
              <select
                value={isAvailableFilter}
                onChange={(e) => {
                  setIsAvailableFilter(e.target.value);
                  setPagination((prev) => ({ ...prev, page: 1 }));
                }}
                className="input-field text-xs py-1.5 sm:py-2 w-full"
              >
                <option value="">All Markets</option>
                <option value="true">Available ({selectedCountry?.code || 'Local'})</option>
                <option value="false">Unavailable ({selectedCountry?.code || 'Local'})</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {showTrash && <TrashBanner />}

      <BulkActionBar
        count={trash.selected.size}
        showTrash={showTrash}
        busy={trash.busy}
        onClear={trash.clear}
        onTrash={() => setConfirm({ action: 'trash', ids: [...trash.selected] })}
        onRestore={() => trash.run('restore')}
        onPurge={() => setConfirm({ action: 'purge', ids: [...trash.selected] })}
      />

      <ConfirmDialog
        open={!!confirm}
        busy={trash.busy}
        title={confirm?.action === 'purge' ? 'Delete permanently?' : 'Move to Trash?'}
        message={
          confirm?.action === 'purge'
            ? `${confirm?.ids.length} product(s) will be deleted forever. This cannot be undone.`
            : `${confirm?.ids.length} product(s) will be hidden from the store and deleted automatically after ${TRASH_RETENTION_DAYS} days. You can restore them from Trash until then.`
        }
        confirmLabel={confirm?.action === 'purge' ? 'Delete permanently' : 'Move to Trash'}
        onCancel={() => setConfirm(null)}
        onConfirm={async () => {
          await trash.run(confirm.action, confirm.ids);
          setConfirm(null);
        }}
      />

      {/* Content Area */}
      {loading ? (
        <div className="py-24 text-center text-surface-400">Loading fragrance catalog...</div>
      ) : products.length === 0 ? (
        <div className="glass-card p-12 text-center space-y-3 bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800">
          <div className="w-12 h-12 rounded-full bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center mx-auto">
            <HiOutlineSparkles className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-surface-900 dark:text-white">No products found</h3>
          <p className="text-xs text-surface-500 max-w-sm mx-auto">
            Try adjusting your search criteria or add a new perfume product to the store.
          </p>
          <PermissionGate permission="products.create">
            <button onClick={handleOpenCreate} className="btn-primary text-xs mx-auto">
              Create First Product
            </button>
          </PermissionGate>
        </div>
      ) : viewMode === 'grid' ? (
        /* ── GRID VIEW ──────────────────────────────────────────────────────── */
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {products.map((prod) => {
            const countryDecimals = prod.decimal_places ?? selectedCountry?.decimal_places ?? 2;
            const currencySymbol = prod.currency_symbol || selectedCountry?.currency_symbol || 'AED';
            const countryStock = prod.country_stock_quantity !== undefined && prod.country_stock_quantity !== null
              ? prod.country_stock_quantity
              : prod.stock_quantity;
            const countryThreshold = prod.country_low_stock_threshold ?? 5;
            const isOutOfStock = countryStock <= 0;
            const isLowStock = countryStock > 0 && countryStock <= countryThreshold;

            return (
              <div
                key={prod.id}
                className="glass-card bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-2xl overflow-hidden hover:shadow-xl transition-all duration-300 flex flex-col group"
              >
                {/* Image container */}
                <div className="relative h-48 bg-surface-100 dark:bg-surface-800/60 overflow-hidden">
                  {canDelete && (
                    <input
                      type="checkbox"
                      checked={trash.selected.has(prod.id)}
                      onChange={() => trash.toggle(prod.id)}
                      className="absolute bottom-2.5 left-2.5 z-10 w-4 h-4 rounded accent-purple-600 cursor-pointer"
                      aria-label={`Select ${prod.name}`}
                    />
                  )}
                  {prod.primary_image_url ? (
                    <img
                      src={prod.primary_image_url}
                      alt={prod.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-surface-400">
                      <HiOutlineSparkles className="w-8 h-8 opacity-40 mb-1" />
                      <span className="text-[11px]">No Image</span>
                    </div>
                  )}

                  {/* Badges on image */}
                  <div className="absolute top-2.5 left-2.5 flex flex-col gap-1.5 items-start">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {canFullUpdate && (
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${prod.status === 'active'
                            ? 'bg-emerald-500 text-white shadow-sm'
                            : prod.status === 'draft'
                              ? 'bg-amber-500 text-white shadow-sm'
                              : 'bg-surface-500 text-white'
                            }`}
                        >
                          {prod.status}
                        </span>
                      )}
                      {prod.is_featured ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-600 text-white shadow-sm flex items-center gap-1">
                          <HiStar className="w-3 h-3 text-amber-300" /> Featured
                        </span>
                      ) : null}
                      {prod.is_bundle ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-600 text-white shadow-sm flex items-center gap-1">
                          <HiOutlineGift className="w-3 h-3" /> Gift Set {prod.bundle_items_count ? `(${prod.bundle_items_count})` : ''}
                        </span>
                      ) : null}
                    </div>

                    {/* Country availability badge / quick toggle */}
                    <button
                      type="button"
                      disabled={!canFullUpdate || togglingId === prod.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleAvailability(prod);
                      }}
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm flex items-center gap-1.5 transition-all ${prod.is_available
                        ? 'bg-emerald-950/85 backdrop-blur-md text-emerald-300 border border-emerald-500/40'
                        : 'bg-rose-950/90 backdrop-blur-md text-rose-200 border border-rose-500/50'
                        } ${canFullUpdate ? 'cursor-pointer hover:scale-105 active:scale-95' : 'cursor-default'}`}
                      title={canFullUpdate ? `Click to toggle availability in ${selectedCountry?.name || selectedCountry?.code || 'this country'}` : undefined}
                    >
                      {togglingId === prod.id ? (
                        <span className="w-2.5 h-2.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${prod.is_available ? 'bg-emerald-400' : 'bg-rose-400'
                            }`}
                        />
                      )}
                      <span>
                        {prod.is_available ? `${selectedCountry?.code || 'Market'}: Active` : `Unavailable (${selectedCountry?.code || 'Market'})`}
                      </span>
                    </button>
                  </div>

                  {/* Country stock & size badge on image */}
                  <div className="absolute top-2.5 right-2.5 flex flex-col gap-1 items-end">
                    {canFullUpdate && (
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm ${isOutOfStock
                          ? 'bg-red-600 text-white'
                          : isLowStock
                            ? 'bg-amber-500 text-white'
                            : 'bg-emerald-600 text-white'
                          }`}
                      >
                        {isOutOfStock ? 'Out of Stock' : isLowStock ? `Low (${countryStock})` : `${countryStock} in ${selectedCountry?.code || 'Stock'}`}
                      </span>
                    )}
                    {prod.size_name && (
                      <div className="px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-md text-white text-[10px] font-mono">
                        {prod.size_name}
                      </div>
                    )}
                  </div>
                </div>

                {/* Details */}
                <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                  <div>
                    <div className="flex items-center justify-between text-[11px] text-surface-400 mb-1">
                      <span className="truncate max-w-[200px]" title={prod.subcategory_name && prod.subcategory_name !== prod.category_name ? `${prod.category_name} › ${prod.subcategory_name}` : (prod.subcategory_name || prod.category_name)}>
                        {prod.subcategory_name && prod.subcategory_name !== prod.category_name
                          ? `${prod.category_name} › ${prod.subcategory_name}`
                          : prod.category_name || prod.subcategory_name || 'Fragrance'}
                      </span>
                      <span className="font-mono text-purple-600 dark:text-purple-400 shrink-0">{prod.sku}</span>
                    </div>
                    <h3 className="font-bold text-sm text-surface-900 dark:text-white line-clamp-1 group-hover:text-purple-600 transition-colors">
                      {prod.name}
                    </h3>
                    {prod.name_ar && (
                      <p className="text-xs text-surface-500 dark:text-surface-400 line-clamp-1 font-arabic" dir="rtl">
                        {prod.name_ar}
                      </p>
                    )}

                    {/* Spec tags preview */}
                    <div className="mt-2.5 flex flex-wrap gap-1">
                      {prod.specifications?.fragrance_type && (
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200/50 dark:border-purple-800/40">
                          {prod.specifications.fragrance_type}
                        </span>
                      )}
                      {(prod.olfactory_families_names || prod.olfactory_family_name) && (
                        <span
                          className="text-[10px] px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200/50 dark:border-amber-800/40"
                          title="Fragrance Accords"
                        >
                          {prod.olfactory_families_names || prod.olfactory_family_name}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Footer & Pricing / Inventory */}
                  <div className="pt-3 border-t border-surface-100 dark:border-surface-800 flex items-center justify-between">
                    {canViewPricing ? (
                      <div>
                        <p className="text-[10px] text-surface-400 uppercase tracking-wider font-semibold">
                          Retail Price
                        </p>
                        <p className="text-sm font-bold text-surface-900 dark:text-white">
                          {formatPrice(prod.price, countryDecimals, currencySymbol)}
                        </p>
                      </div>
                    ) : (
                      <div>
                        <span className="text-[11px] text-surface-400 font-medium">
                          Alaynaa's Parfums
                        </span>
                      </div>
                    )}

                    <div className="flex items-center gap-1">
                      {showTrash && <TrashCountdown deletedAt={prod.deleted_at} />}
                      {canUpdate && !showTrash && (
                        <button
                          onClick={() => handleOpenEdit(prod.id)}
                          className="btn-ghost p-1.5 rounded-lg text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/30"
                          title="Edit product"
                        >
                          <HiOutlinePencil className="w-4 h-4" />
                        </button>
                      )}
                      {canCreate && !showTrash && (
                        <button
                          onClick={() => handleOpenClone(prod.id)}
                          className="btn-ghost p-1.5 rounded-lg text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-950/30"
                          title="Duplicate product"
                        >
                          <HiOutlineDuplicate className="w-4 h-4" />
                        </button>
                      )}

                      <PermissionGate permission="products.delete">
                        {renderTrashActions(prod)}
                      </PermissionGate>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ── TABLE VIEW ──────────────────────────────────────────────────────── */
        <div className="glass-card overflow-hidden bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-surface-200 dark:border-surface-700 text-left text-[11px] font-semibold uppercase tracking-wider text-surface-500 dark:text-surface-300 bg-surface-50 dark:bg-surface-800/50">
                  {canDelete && (
                    <th className="py-2.5 pl-3 sm:pl-4 pr-0 w-8">
                      <input
                        type="checkbox"
                        checked={trash.allSelected}
                        onChange={trash.toggleAll}
                        className="w-4 h-4 rounded accent-purple-600 cursor-pointer"
                        aria-label="Select all"
                      />
                    </th>
                  )}
                  <th className="py-2.5 sm:py-3 px-3 sm:px-4">Perfume</th>
                  <th className="hidden md:table-cell py-3 px-4">Category & Size</th>
                  <th className="hidden md:table-cell py-3 px-4">SKU</th>
                  {canFullUpdate && (
                    <th className="hidden md:table-cell py-3 px-4">Stock ({selectedCountry?.code || 'Local'})</th>
                  )}
                  {canFullUpdate && (
                    <th className="hidden md:table-cell py-3 px-4">Status</th>
                  )}
                  <th className="hidden md:table-cell py-3 px-4">Availability ({selectedCountry?.code || 'Market'})</th>
                  {canViewPricing && (
                    <th className="py-2.5 sm:py-3 px-3 sm:px-4 text-right">Price ({selectedCountry?.currency_code || 'AED'})</th>
                  )}
                  <th className="py-2.5 sm:py-3 px-3 sm:px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100 dark:divide-surface-800 text-xs">
                {products.map((prod) => {
                  const countryDecimals = prod.decimal_places ?? selectedCountry?.decimal_places ?? 2;
                  const currencySymbol = prod.currency_symbol || selectedCountry?.currency_symbol || 'AED';
                  const countryStock = prod.country_stock_quantity !== undefined && prod.country_stock_quantity !== null
                    ? prod.country_stock_quantity
                    : prod.stock_quantity;
                  const countryThreshold = prod.country_low_stock_threshold ?? 5;
                  const isOutOfStock = countryStock <= 0;
                  const isLowStock = countryStock > 0 && countryStock <= countryThreshold;
                  const isExpanded = expandedRowId === prod.id;

                  return (
                    <Fragment key={prod.id}>
                      <tr
                        onClick={() => toggleRowExpand(prod.id)}
                        className={`transition-colors cursor-pointer md:cursor-default ${
                          isExpanded
                            ? 'bg-purple-50/40 dark:bg-purple-950/20'
                            : 'hover:bg-surface-50 dark:hover:bg-surface-800/40'
                        }`}
                      >
                        {/* 0. Bulk-select checkbox */}
                        {canDelete && (
                          <td className="py-2.5 pl-3 sm:pl-4 pr-0 w-8" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={trash.selected.has(prod.id)}
                              onChange={() => trash.toggle(prod.id)}
                              className="w-4 h-4 rounded accent-purple-600 cursor-pointer"
                              aria-label={`Select ${prod.name}`}
                            />
                          </td>
                        )}

                        {/* 1. Perfume (English name trimmed, image, chevron) */}
                        <td className="py-2.5 sm:py-3 px-3 sm:px-4">
                          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                            <HiOutlineChevronDown
                              className={`w-3.5 h-3.5 md:hidden shrink-0 text-surface-400 transition-transform duration-200 ${
                                isExpanded ? 'rotate-180 text-purple-600 dark:text-purple-400' : ''
                              }`}
                            />
                            <img
                              src={prod.primary_image_url || '/LOGO/Square-Logo.svg'}
                              alt={prod.name}
                              className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg object-cover bg-surface-100 shrink-0"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {showTrash && <TrashCountdown deletedAt={prod.deleted_at} />}
                                {showTrash && prod.in_orders ? (
                                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-surface-100 dark:bg-surface-800 text-surface-500 border border-surface-200 dark:border-surface-700" title="Used in past orders, so it is kept hidden instead of being deleted">
                                    Kept – used in order history
                                  </span>
                                ) : null}
                                <p
                                  className="font-semibold sm:font-bold text-surface-900 dark:text-white truncate max-w-[110px] xs:max-w-[150px] sm:max-w-none text-xs sm:text-sm"
                                  title={prod.name}
                                >
                                  {prod.name}
                                </p>
                                {prod.is_bundle ? (
                                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 shrink-0 flex items-center gap-1">
                                    <HiOutlineGift className="w-3 h-3" /> Gift Set {prod.bundle_items_count ? `(${prod.bundle_items_count})` : ''}
                                  </span>
                                ) : null}
                              </div>
                              <p className="text-[11px] text-surface-400 dark:text-surface-400 hidden md:block">
                                {prod.name_ar}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* 2. Category & Size (hidden on mobile) */}
                        <td className="hidden md:table-cell py-3 px-4">
                          <p className="text-surface-800 dark:text-surface-200">
                            {prod.subcategory_name && prod.subcategory_name !== prod.category_name
                              ? `${prod.category_name} › ${prod.subcategory_name}`
                              : prod.category_name || prod.subcategory_name || '—'}
                          </p>
                          <p className="text-[11px] text-surface-400 dark:text-surface-400">{prod.size_name || 'Standard'}</p>
                        </td>

                        {/* 3. SKU (hidden on mobile) */}
                        <td className="hidden md:table-cell py-3 px-4 font-mono text-purple-600 dark:text-purple-400">
                          {prod.sku}
                        </td>

                        {/* 4. Stock (hidden on mobile) */}
                        {canFullUpdate && (
                          <td className="hidden md:table-cell py-3 px-4">
                            <div className="flex flex-col gap-0.5">
                              <div className="flex items-center gap-1.5">
                                <span
                                  className={`font-semibold ${isOutOfStock
                                    ? 'text-red-500'
                                    : isLowStock
                                      ? 'text-amber-500'
                                      : 'text-surface-700 dark:text-surface-300'
                                    }`}
                                >
                                  {countryStock} units
                                </span>
                                <span
                                  className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${isOutOfStock
                                    ? 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-400'
                                    : isLowStock
                                      ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400'
                                      : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400'
                                    }`}
                                >
                                  {isOutOfStock ? 'Out' : isLowStock ? 'Low' : 'In Stock'}
                                </span>
                              </div>
                              <span className="text-[10px] text-surface-400 dark:text-surface-400">
                                GCC Total: {prod.stock_quantity}
                              </span>
                            </div>
                          </td>
                        )}

                        {/* 5. Status (hidden on mobile) */}
                        {canFullUpdate && (
                          <td className="hidden md:table-cell py-3 px-4">
                            <span
                              className={`badge text-[10px] font-bold uppercase ${prod.status === 'active'
                                ? 'badge-success'
                                : prod.status === 'draft'
                                  ? 'badge-warning'
                                  : 'badge-danger'
                                }`}
                            >
                              {prod.status}
                            </span>
                          </td>
                        )}

                        {/* 6. Availability (hidden on mobile) */}
                        <td className="hidden md:table-cell py-3 px-4">
                          <button
                            type="button"
                            disabled={!canFullUpdate || togglingId === prod.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleAvailability(prod);
                            }}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all ${prod.is_available
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/60'
                              : 'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800/60'
                              } ${canFullUpdate
                                ? 'cursor-pointer hover:shadow-sm hover:scale-[1.02] active:scale-[0.98]'
                                : 'cursor-default opacity-90'
                              }`}
                            title={
                              canFullUpdate
                                ? `Click to mark ${prod.is_available ? 'unavailable' : 'available'} in ${selectedCountry?.name || selectedCountry?.code || 'this country'}`
                                : undefined
                            }
                          >
                            {togglingId === prod.id ? (
                              <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${prod.is_available
                                  ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.7)]'
                                  : 'bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.7)]'
                                  }`}
                              />
                            )}
                            <span>{prod.is_available ? 'Available' : 'Unavailable'}</span>
                          </button>
                        </td>

                        {/* 7. Price (visible on mobile & desktop) */}
                        {canViewPricing && (
                          <td className="py-2.5 sm:py-3 px-3 sm:px-4 text-right font-bold text-surface-900 dark:text-white whitespace-nowrap text-xs sm:text-sm">
                            {formatPrice(prod.price, countryDecimals, currencySymbol)}
                          </td>
                        )}

                        {/* 8. Actions (visible on mobile & desktop) */}
                        <td className="py-2.5 sm:py-3 px-3 sm:px-4 text-right">
                          <div className="flex items-center gap-1 justify-end">
                            {canUpdate && !showTrash && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenEdit(prod.id);
                                }}
                                className="btn-ghost p-1.5 rounded-lg text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/30 active:scale-95"
                                title="Edit"
                              >
                                <HiOutlinePencil className="w-4 h-4" />
                              </button>
                            )}
                            {canCreate && !showTrash && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenClone(prod.id);
                                }}
                                className="btn-ghost p-1.5 rounded-lg text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-950/30 active:scale-95"
                                title="Duplicate"
                              >
                                <HiOutlineDuplicate className="w-4 h-4" />
                              </button>
                            )}
                            <PermissionGate permission="products.delete">
                              {renderTrashActions(prod)}
                            </PermissionGate>
                          </div>
                        </td>
                      </tr>

                      {/* Mobile Expanded Details Row */}
                      {isExpanded && (
                        <tr className="md:hidden bg-purple-50/25 dark:bg-purple-950/15 border-b border-surface-200/80 dark:border-surface-800">
                          <td colSpan={canViewPricing ? 4 : 3} className="py-2.5 px-3">
                            <div className="space-y-2 text-xs animate-fade-in">
                              {/* Arabic Name if present */}
                              {prod.name_ar && (
                                <div className="flex items-center justify-between pb-1.5 border-b border-surface-200/60 dark:border-surface-700/60">
                                  <span className="text-[10px] text-surface-400 font-semibold uppercase">Arabic Name</span>
                                  <span className="text-surface-800 dark:text-surface-200 font-medium" dir="rtl">{prod.name_ar}</span>
                                </div>
                              )}

                              {/* Info Grid */}
                              <div className="grid grid-cols-2 gap-2">
                                {/* Category & Size */}
                                <div className="p-2 rounded-lg bg-white dark:bg-surface-800/80 border border-surface-200/60 dark:border-surface-700/60">
                                  <span className="text-[10px] text-surface-400 uppercase font-semibold block">Category & Size</span>
                                  <p className="font-semibold text-surface-900 dark:text-white mt-0.5 truncate">
                                    {prod.subcategory_name || prod.category_name || 'Standard'}
                                  </p>
                                  <p className="text-[11px] text-surface-500 dark:text-surface-400">
                                    {prod.size_name || 'Standard'}
                                  </p>
                                </div>

                                {/* SKU */}
                                <div className="p-2 rounded-lg bg-white dark:bg-surface-800/80 border border-surface-200/60 dark:border-surface-700/60">
                                  <span className="text-[10px] text-surface-400 uppercase font-semibold block">SKU</span>
                                  <p className="font-mono text-purple-600 dark:text-purple-400 font-bold mt-0.5 truncate">
                                    {prod.sku}
                                  </p>
                                </div>

                                {/* Stock */}
                                {canFullUpdate && (
                                  <div className="p-2 rounded-lg bg-white dark:bg-surface-800/80 border border-surface-200/60 dark:border-surface-700/60">
                                    <span className="text-[10px] text-surface-400 uppercase font-semibold block">
                                      Stock ({selectedCountry?.code || 'Local'})
                                    </span>
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                      <span
                                        className={`font-bold ${
                                          isOutOfStock
                                            ? 'text-red-500'
                                            : isLowStock
                                              ? 'text-amber-500'
                                              : 'text-surface-800 dark:text-surface-200'
                                        }`}
                                      >
                                        {countryStock} units
                                      </span>
                                      <span
                                        className={`text-[9px] font-bold px-1.5 py-0.2 rounded uppercase ${
                                          isOutOfStock
                                            ? 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-400'
                                            : isLowStock
                                              ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400'
                                              : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400'
                                        }`}
                                      >
                                        {isOutOfStock ? 'Out' : isLowStock ? 'Low' : 'In'}
                                      </span>
                                    </div>
                                    <p className="text-[10px] text-surface-400 mt-0.5">
                                      GCC Total: {prod.stock_quantity}
                                    </p>
                                  </div>
                                )}

                                {/* Status */}
                                {canFullUpdate && (
                                  <div className="p-2 rounded-lg bg-white dark:bg-surface-800/80 border border-surface-200/60 dark:border-surface-700/60">
                                    <span className="text-[10px] text-surface-400 uppercase font-semibold block">Status</span>
                                    <div className="mt-1">
                                      <span
                                        className={`badge text-[10px] font-bold uppercase ${
                                          prod.status === 'active'
                                            ? 'badge-success'
                                            : prod.status === 'draft'
                                              ? 'badge-warning'
                                              : 'badge-danger'
                                        }`}
                                      >
                                        {prod.status}
                                      </span>
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* Gift Set Bundle Info */}
                              {prod.is_bundle && (
                                <div className="p-2.5 rounded-lg bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200/60 dark:border-indigo-800/60 flex items-center justify-between">
                                  <span className="text-[11px] font-semibold text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5">
                                    <HiOutlineGift className="w-3.5 h-3.5" /> Gift Set / Discovery Box
                                  </span>
                                  <span className="text-[10px] font-medium text-indigo-600 dark:text-indigo-400">
                                    Contains {prod.bundle_items_count || 0} sub-items
                                  </span>
                                </div>
                              )}

                              {/* Market Availability Action */}
                              <div className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-surface-800/80 border border-surface-200/60 dark:border-surface-700/60">
                                <div>
                                  <span className="text-[10px] text-surface-400 uppercase font-semibold block">
                                    Market Availability
                                  </span>
                                  <span className="text-[11px] text-surface-600 dark:text-surface-300 font-medium">
                                    {selectedCountry?.name || selectedCountry?.code || 'Local'}
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  disabled={!canFullUpdate || togglingId === prod.id}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleToggleAvailability(prod);
                                  }}
                                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all ${
                                    prod.is_available
                                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/60'
                                      : 'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800/60'
                                  } ${
                                    canFullUpdate
                                      ? 'cursor-pointer hover:shadow-sm active:scale-95'
                                      : 'cursor-default opacity-90'
                                  }`}
                                >
                                  {togglingId === prod.id ? (
                                    <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                  ) : (
                                    <span
                                      className={`w-1.5 h-1.5 rounded-full ${
                                        prod.is_available
                                          ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.7)]'
                                          : 'bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.7)]'
                                      }`}
                                    />
                                  )}
                                  <span>{prod.is_available ? 'Available' : 'Unavailable'}</span>
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination */}
      <Pagination
        page={pagination.page}
        totalPages={pagination.pages}
        totalItems={pagination.total}
        itemsPerPage={pagination.limit}
        onPageChange={(p) => setPagination((prev) => ({ ...prev, page: p }))}
        onItemsPerPageChange={(l) => setPagination((prev) => ({ ...prev, limit: l, page: 1 }))}
        itemsPerPageOptions={[8, 12, 24, 48]}
        label="products"
      />

      {/* Product Editor Modal */}
      <ProductEditor
        isOpen={editorOpen}
        productId={editingProductId}
        cloneFromId={cloneFromId}
        onClose={() => setEditorOpen(false)}
        onSaved={fetchProducts}
      />
    </div>
  );
}
