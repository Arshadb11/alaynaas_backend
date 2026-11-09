import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../services/api';
import { toast } from '../components/ui/Toast';
import { useCountry } from '../context/CountryContext';
import { usePermission } from '../hooks/usePermission';
import PermissionGate from '../components/ui/PermissionGate';
import Pagination from '../components/ui/Pagination';
import OrderDetailModal from '../components/orders/OrderDetailModal';
import CreateOrderModal from '../components/orders/CreateOrderModal';
import OrderInvoiceModal from '../components/orders/OrderInvoiceModal';
import CountryFlag, { CountryBadge } from '../components/ui/CountryFlag';
import {
  HiOutlineShoppingBag,
  HiOutlineSearch,
  HiOutlineRefresh,
  HiOutlinePlus,
  HiOutlineEye,
  HiOutlinePrinter,
  HiOutlineFilter,
  HiOutlineX,
  HiOutlineGlobeAlt,
  HiOutlineTruck,
  HiOutlineCreditCard,
  HiOutlineCheckCircle,
  HiOutlineClock,
  HiOutlineGift,
  HiOutlineCash,
  HiOutlineChevronRight,
  HiOutlineChevronDown,
  HiOutlineCheck,
  HiOutlineCalendar,
  HiOutlineUser,
  HiOutlinePhone,
  HiOutlineMail,
  HiOutlineTrash,
} from 'react-icons/hi';
import { useTrashSelection } from '../hooks/useTrashSelection';
import {
  TrashViewTabs,
  TrashBanner,
  TrashCountdown,
  BulkActionBar,
  ConfirmDialog,
  TRASH_RETENTION_DAYS,
} from '../components/ui/TrashControls';

import {
  ORDER_STATUS_CONFIG,
  PAYMENT_STATUS_CONFIG,
  PAYMENT_METHOD_CONFIG,
  ORDER_STATUS_OPTIONS,
  PAYMENT_STATUS_OPTIONS,
  PAYMENT_METHOD_OPTIONS,
  getOrderStatusConfig,
  getPaymentStatusConfig,
  getPaymentMethodLabel,
} from '../config/orderConfig';
import OrderStatusBadge from '../components/orders/OrderStatusBadge';
import PaymentStatusBadge from '../components/orders/PaymentStatusBadge';

export default function Orders() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { countries, selectedCountry } = useCountry();
  const canCreate = usePermission('orders.create');
  const canDelete = usePermission('orders.delete');
  const [showTrash, setShowTrash] = useState(false); // Active | Trash view
  const [confirm, setConfirm] = useState(null); // { action: 'trash' | 'purge', ids: number[] }

  // State
  const [orders, setOrders] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1 });

  // Filters
  const [activeCountryId, setActiveCountryId] = useState(null); // null = use selectedCountry or all
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [statusFilter, setStatusFilter] = useState('');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('');
  const [datePreset, setDatePreset] = useState('all');

  // Single-line Filter Popups (expansion on click)
  const [openDropdown, setOpenDropdown] = useState(null); // 'market' | 'status' | 'payment' | null
  const filterBarRef = useRef(null);

  // Close popup dropdowns on outside click or Esc key
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (filterBarRef.current && !filterBarRef.current.contains(e.target)) {
        setOpenDropdown(null);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setOpenDropdown(null);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Inspector & Modal states (Phase 4 & Phase 5)
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [invoiceOrderId, setInvoiceOrderId] = useState(null);

  // Deep-link query handler (e.g. redirected from Dashboard or links)
  useEffect(() => {
    const isNew = searchParams.get('action') === 'new' || searchParams.get('create') === 'true';
    const orderId = searchParams.get('orderId') || searchParams.get('id');

    if (isNew) {
      setShowCreateModal(true);
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('action');
      newParams.delete('create');
      setSearchParams(newParams, { replace: true });
    } else if (orderId) {
      setSelectedOrderId(parseInt(orderId, 10));
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('orderId');
      newParams.delete('id');
      setSearchParams(newParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // Synchronize country from global context when changed
  useEffect(() => {
    if (selectedCountry && activeCountryId === null) {
      setActiveCountryId(selectedCountry.id);
    }
  }, [selectedCountry]);

  // Compute date range from preset
  const dateRange = useMemo(() => {
    const today = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const format = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    if (datePreset === 'today') {
      const d = format(today);
      return { from: d, to: d };
    }
    if (datePreset === 'last_7_days') {
      const prior = new Date(today);
      prior.setDate(today.getDate() - 7);
      return { from: format(prior), to: format(today) };
    }
    if (datePreset === 'last_30_days') {
      const prior = new Date(today);
      prior.setDate(today.getDate() - 30);
      return { from: format(prior), to: format(today) };
    }
    return { from: '', to: '' };
  }, [datePreset]);

  // Fetch orders from API
  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        page,
        limit,
        search: search.trim() || undefined,
        status: statusFilter || undefined,
        payment_status: paymentStatusFilter || undefined,
        payment_method: paymentMethodFilter || undefined,
        country_id: activeCountryId || undefined,
        date_from: dateRange.from || undefined,
        date_to: dateRange.to || undefined,
        trashed: showTrash || undefined,
      };

      const res = await api.get('/orders', { params });
      setOrders(res.data.data || []);
      setPagination(res.data.pagination || { total: 0, totalPages: 1 });
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to fetch orders');
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, statusFilter, paymentStatusFilter, paymentMethodFilter, activeCountryId, dateRange, showTrash]);

  // Fetch commerce statistics
  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const params = {
        country_id: activeCountryId || undefined,
        date_from: dateRange.from || undefined,
        date_to: dateRange.to || undefined,
      };
      const res = await api.get('/orders/stats', { params });
      setStats(res.data.data);
    } catch {
      setStats(null);
    } finally {
      setStatsLoading(false);
    }
  }, [activeCountryId, dateRange]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Bulk selection + Trash actions (shared with the Products page)
  const trash = useTrashSelection({
    basePath: '/orders',
    items: orders,
    onDone: fetchOrders,
    countParams: { country_id: activeCountryId || undefined },
  });

  // Format currency with decimals
  const formatCurrency = (amount, currencyCode, decimals = 2) => {
    const num = parseFloat(amount || 0);
    return `${num.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })} ${currencyCode || ''}`;
  };

  // Format date readable
  const formatDate = (isoStr) => {
    if (!isoStr) return 'N/A';
    const d = new Date(isoStr);
    return d.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Get active country meta
  const currentCountry = countries.find((c) => c.id === activeCountryId) || selectedCountry || {};

  /** Row-level buttons: Trash (active view) or Restore / Delete permanently (Trash view). */
  const renderTrashActions = (ord) => {
    const cls = 'p-1.5 rounded-lg transition-colors';
    if (!showTrash) {
      return (
        <button
          type="button"
          onClick={() => setConfirm({ action: 'trash', ids: [ord.id] })}
          className={`${cls} text-surface-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30`}
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
          onClick={() => trash.run('restore', [ord.id])}
          className={`${cls} text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30`}
          title="Restore"
        >
          <HiOutlineRefresh className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => setConfirm({ action: 'purge', ids: [ord.id] })}
          className={`${cls} text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30`}
          title="Delete permanently"
        >
          <HiOutlineX className="w-4 h-4" />
        </button>
      </>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <HiOutlineShoppingBag className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-surface-900 dark:text-white font-display tracking-tight">
                Orders & Fulfillment
              </h1>
              <p className="text-xs text-surface-500 dark:text-surface-400 mt-0.5">
                Multi-country order dispatch, payment reconciliation, and luxury VIP concierge fulfillment.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {canDelete && (
            <TrashViewTabs
              showTrash={showTrash}
              trashCount={trash.trashCount}
              onChange={(v) => {
                setShowTrash(v);
                setPage(1);
              }}
            />
          )}
          <button
            type="button"
            onClick={() => {
              fetchOrders();
              fetchStats();
            }}
            disabled={loading}
            className="btn-secondary text-xs py-2 px-3 flex items-center gap-1.5"
            title="Refresh Orders"
          >
            <HiOutlineRefresh className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <PermissionGate permission="orders.create">
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="btn-primary text-xs py-2 px-3.5 flex items-center gap-1.5 shadow-sm"
            >
              <HiOutlinePlus className="w-4 h-4" />
              <span>Create Order</span>
            </button>
          </PermissionGate>
        </div>
      </div>

      {/* ── Executive Commerce Stats Ribbon ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* Total Revenue */}
        <div className="glass-card p-4 rounded-xl border border-surface-200/80 dark:border-surface-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-surface-500 dark:text-surface-400">
              Net Revenue
            </span>
            <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
              <HiOutlineCash className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xl font-bold text-surface-900 dark:text-white font-display mt-2">
            {statsLoading ? (
              <span className="opacity-40">...</span>
            ) : (
              formatCurrency(stats?.total_revenue, currentCountry.currency_code, currentCountry.decimal_places || 2)
            )}
          </p>
          <span className="text-[10px] text-surface-400 mt-1 block truncate">
            {parseFloat(stats?.total_refunded || 0) > 0
              ? `Net of ${formatCurrency(stats.total_refunded, currentCountry.currency_code, currentCountry.decimal_places || 2)} refunded`
              : (currentCountry.name || 'All Assigned Markets')}
          </span>
        </div>

        {/* Total Orders */}
        <div className="glass-card p-4 rounded-xl border border-surface-200/80 dark:border-surface-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-surface-500 dark:text-surface-400">
              Total Orders
            </span>
            <div className="p-1.5 rounded-lg bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400">
              <HiOutlineShoppingBag className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xl font-bold text-surface-900 dark:text-white font-display mt-2">
            {statsLoading ? <span className="opacity-40">...</span> : stats?.total_orders || 0}
          </p>
          <span className="text-[10px] text-surface-400 mt-1 block">Across active filter scope</span>
        </div>

        {/* Pending Fulfillment */}
        <div className="glass-card p-4 rounded-xl border border-surface-200/80 dark:border-surface-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-surface-500 dark:text-surface-400">
              Pending Packing
            </span>
            <div className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400">
              <HiOutlineClock className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xl font-bold text-surface-900 dark:text-white font-display mt-2">
            {statsLoading ? <span className="opacity-40">...</span> : stats?.pending_fulfillment || 0}
          </p>
          <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium mt-1 block">
            Processing / Confirmed
          </span>
        </div>

        {/* Delivered Orders */}
        <div className="glass-card p-4 rounded-xl border border-surface-200/80 dark:border-surface-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-surface-500 dark:text-surface-400">
              Delivered
            </span>
            <div className="p-1.5 rounded-lg bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400">
              <HiOutlineTruck className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xl font-bold text-surface-900 dark:text-white font-display mt-2">
            {statsLoading ? <span className="opacity-40">...</span> : stats?.delivered_count || 0}
          </p>
          <span className="text-[10px] text-surface-400 mt-1 block">Completed fulfillment</span>
        </div>

        {/* Average Order Value (AOV) */}
        <div className="glass-card p-4 rounded-xl border border-surface-200/80 dark:border-surface-800 shadow-sm col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-surface-500 dark:text-surface-400">
              Avg Order Value
            </span>
            <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">
              <HiOutlineCheckCircle className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xl font-bold text-surface-900 dark:text-white font-display mt-2">
            {statsLoading ? (
              <span className="opacity-40">...</span>
            ) : (
              formatCurrency(stats?.aov, currentCountry.currency_code, currentCountry.decimal_places || 2)
            )}
          </p>
          <span className="text-[10px] text-surface-400 mt-1 block">Net customer basket</span>
        </div>
      </div>

      {/* ── Executive Search & Advanced Interactive Filters Bar (Single-Line Popups) ── */}
      <div
        ref={filterBarRef}
        className="glass-card p-2 sm:p-2.5 rounded-2xl border border-surface-200/80 dark:border-surface-800 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-2 shadow-sm relative z-20"
      >
        {/* Search input (Expands horizontally on desktop) */}
        <div className="relative flex-1 min-w-[200px] group">
          <HiOutlineSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400 group-focus-within:text-purple-600 dark:group-focus-within:text-purple-400 transition-colors pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search Order #, Customer, Email, Phone, or Tracking #..."
            className="w-full pl-10 pr-8 py-2 text-xs rounded-xl bg-surface-50/80 dark:bg-surface-800/70 border border-surface-200/80 dark:border-surface-700/80 text-surface-900 dark:text-white placeholder-surface-400 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all"
          />
          {search && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setPage(1);
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full text-surface-400 hover:text-surface-600 dark:hover:text-surface-200 transition-colors"
              title="Clear search"
            >
              <HiOutlineX className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Secondary Filter Buttons (Expandable Popovers) */}
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-1.5 shrink-0">
          {/* 1. Market / Country Filter Trigger */}
          {countries && countries.length > 0 && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setOpenDropdown((prev) => (prev === 'market' ? null : 'market'))}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all border shrink-0 ${
                  activeCountryId
                    ? 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800 shadow-xs'
                    : 'bg-surface-50/80 dark:bg-surface-800/70 text-surface-700 dark:text-surface-300 border-surface-200/80 dark:border-surface-700/80 hover:bg-surface-100 dark:hover:bg-surface-700'
                }`}
                title="Filter by Market"
              >
                {activeCountryId ? (
                  <CountryFlag
                    code={countries.find((c) => c.id === activeCountryId)?.code}
                    size="xs"
                  />
                ) : (
                  <HiOutlineGlobeAlt className="w-4 h-4 text-purple-500 shrink-0" />
                )}
                <span className="truncate max-w-[110px]">
                  {activeCountryId
                    ? countries.find((c) => c.id === activeCountryId)?.name || 'Market'
                    : 'All Markets'}
                </span>
                <HiOutlineChevronDown
                  className={`w-3.5 h-3.5 transition-transform duration-200 text-surface-400 ${
                    openDropdown === 'market' ? 'rotate-180 text-purple-600' : ''
                  }`}
                />
              </button>

              {/* Market Popover Menu */}
              {openDropdown === 'market' && (
                <div className="absolute right-0 sm:left-0 sm:right-auto top-full mt-2 w-56 bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-2xl shadow-xl z-40 p-1.5 animate-fade-in backdrop-blur-xl">
                  <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-surface-400 border-b border-surface-100 dark:border-surface-800/80 mb-1">
                    Select Regional Market
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveCountryId('');
                      setPage(1);
                      setOpenDropdown(null);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                      !activeCountryId
                        ? 'bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 font-semibold'
                        : 'text-surface-700 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-800'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <HiOutlineGlobeAlt className="w-4 h-4 text-purple-500" />
                      <span>All Markets (Global)</span>
                    </div>
                    {!activeCountryId && <HiOutlineCheck className="w-4 h-4 text-purple-600 shrink-0" />}
                  </button>

                  <div className="my-1 border-t border-surface-100 dark:border-surface-800" />

                  <div className="max-h-60 overflow-y-auto space-y-0.5">
                    {countries.map((c) => {
                      const isSelected = activeCountryId === c.id;
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            setActiveCountryId(c.id);
                            setPage(1);
                            setOpenDropdown(null);
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                            isSelected
                              ? 'bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 font-semibold'
                              : 'text-surface-700 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-800'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <CountryFlag code={c.code} name={c.name} size="xs" />
                            <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-surface-100 dark:bg-surface-800 text-surface-700 dark:text-surface-300 border border-surface-200 dark:border-surface-700 shrink-0">
                              {c.code}
                            </span>
                            <span className="truncate">{c.name}</span>
                          </div>
                          {isSelected && <HiOutlineCheck className="w-4 h-4 text-purple-600 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 2. Fulfillment Status Filter Trigger */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setOpenDropdown((prev) => (prev === 'status' ? null : 'status'))}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all border shrink-0 ${
                statusFilter
                  ? 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800 shadow-xs'
                  : 'bg-surface-50/80 dark:bg-surface-800/70 text-surface-700 dark:text-surface-300 border-surface-200/80 dark:border-surface-700/80 hover:bg-surface-100 dark:hover:bg-surface-700'
              }`}
              title="Filter by Status"
            >
              {statusFilter ? (
                <>
                  <span
                    className={`status-dot w-2 h-2 rounded-full shrink-0 ${
                      getOrderStatusConfig(statusFilter).dot
                    }`}
                  />
                  <span className="truncate max-w-[110px]">
                    {getOrderStatusConfig(statusFilter).label}
                  </span>
                </>
              ) : (
                <>
                  <HiOutlineFilter className="w-4 h-4 text-surface-400 shrink-0" />
                  <span>All Statuses</span>
                </>
              )}
              <HiOutlineChevronDown
                className={`w-3.5 h-3.5 transition-transform duration-200 text-surface-400 ${
                  openDropdown === 'status' ? 'rotate-180 text-purple-600' : ''
                }`}
              />
            </button>

            {/* Status Popover Menu */}
            {openDropdown === 'status' && (
              <div className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-2xl shadow-xl z-40 p-1.5 animate-fade-in backdrop-blur-xl">
                <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-surface-400 border-b border-surface-100 dark:border-surface-800/80 mb-1">
                  Filter by Order Status
                </div>
                <div className="max-h-72 overflow-y-auto space-y-0.5">
                  {[
                    { id: '', label: 'All Orders' },
                    ...ORDER_STATUS_OPTIONS.map((opt) => ({ id: opt.value, label: opt.label })),
                  ].map((st) => {
                    const isSelected = statusFilter === st.id;
                    const count = st.id && stats?.by_status ? stats.by_status[st.id] || 0 : stats?.total_orders || null;
                    const dotClass = st.id ? getOrderStatusConfig(st.id).dot : 'bg-surface-400';

                    return (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() => {
                          setStatusFilter(st.id);
                          setPage(1);
                          setOpenDropdown(null);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                          isSelected
                            ? 'bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 font-semibold'
                            : 'text-surface-700 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-800'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`status-dot w-2 h-2 rounded-full shrink-0 ${dotClass}`} />
                          <span className="truncate">{st.label}</span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {count !== null && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-mono bg-surface-100 dark:bg-surface-800 text-surface-500">
                              {count}
                            </span>
                          )}
                          {isSelected && <HiOutlineCheck className="w-3.5 h-3.5 text-purple-600" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* 3. Payment Filter Trigger (Status & Method) */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setOpenDropdown((prev) => (prev === 'payment' ? null : 'payment'))}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all border shrink-0 ${
                paymentStatusFilter || paymentMethodFilter
                  ? 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800 shadow-xs'
                  : 'bg-surface-50/80 dark:bg-surface-800/70 text-surface-700 dark:text-surface-300 border-surface-200/80 dark:border-surface-700/80 hover:bg-surface-100 dark:hover:bg-surface-700'
              }`}
              title="Filter by Payment"
            >
              <HiOutlineCreditCard className="w-4 h-4 text-surface-400 shrink-0" />
              <span className="truncate max-w-[110px]">
                {paymentStatusFilter
                  ? getPaymentStatusConfig(paymentStatusFilter).label
                  : paymentMethodFilter
                    ? getPaymentMethodLabel(paymentMethodFilter)
                    : 'Payment'}
              </span>
              {(paymentStatusFilter || paymentMethodFilter) && (
                <span className="w-1.5 h-1.5 rounded-full bg-purple-600 shrink-0" />
              )}
              <HiOutlineChevronDown
                className={`w-3.5 h-3.5 transition-transform duration-200 text-surface-400 ${
                  openDropdown === 'payment' ? 'rotate-180 text-purple-600' : ''
                }`}
              />
            </button>

            {/* Payment Popover Menu */}
            {openDropdown === 'payment' && (
              <div className="absolute right-0 top-full mt-2 w-72 bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-2xl shadow-xl z-40 p-3 space-y-3 animate-fade-in backdrop-blur-xl">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-surface-400 mb-1.5">
                    Payment Status
                  </div>
                  <div className="grid grid-cols-2 gap-1 text-xs">
                    {[
                      { id: '', label: 'All Statuses' },
                      ...PAYMENT_STATUS_OPTIONS.map((opt) => ({ id: opt.value, label: opt.label })),
                    ].map((pst) => (
                      <button
                        key={pst.id}
                        type="button"
                        onClick={() => {
                          setPaymentStatusFilter(pst.id);
                          setPage(1);
                        }}
                        className={`px-2 py-1.5 rounded-lg text-left truncate transition-colors text-[11px] ${
                          paymentStatusFilter === pst.id
                            ? 'bg-purple-600 text-white font-semibold'
                            : 'bg-surface-50 dark:bg-surface-800 text-surface-700 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-700'
                        }`}
                      >
                        {pst.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="border-t border-surface-100 dark:border-surface-800 pt-2.5">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-surface-400 mb-1.5">
                    Payment Method
                  </div>
                  <select
                    value={paymentMethodFilter}
                    onChange={(e) => {
                      setPaymentMethodFilter(e.target.value);
                      setPage(1);
                    }}
                    className="w-full px-2.5 py-1.5 text-xs rounded-xl bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-surface-800 dark:text-surface-200 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                  >
                    <option value="">All Payment Methods</option>
                    {PAYMENT_METHOD_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-surface-100 dark:border-surface-800 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentStatusFilter('');
                      setPaymentMethodFilter('');
                      setPage(1);
                    }}
                    className="text-[11px] text-surface-400 hover:text-surface-600 dark:hover:text-surface-200"
                  >
                    Clear Payment
                  </button>
                  <button
                    type="button"
                    onClick={() => setOpenDropdown(null)}
                    className="px-2.5 py-1 rounded-lg bg-surface-900 text-white dark:bg-white dark:text-surface-900 text-[11px] font-semibold"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 4. Date Range Segmented Pill */}
          <div className="flex items-center gap-0.5 p-1 bg-surface-100 dark:bg-surface-800/90 rounded-xl border border-surface-200/50 dark:border-surface-700/50 text-xs shrink-0">
            {[
              { id: 'all', label: 'All' },
              { id: 'today', label: 'Today' },
              { id: 'last_7_days', label: '7D' },
              { id: 'last_30_days', label: '30D' },
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setDatePreset(p.id);
                  setPage(1);
                }}
                className={`px-2 py-1 rounded-lg text-[11px] font-medium transition-all ${
                  datePreset === p.id
                    ? 'bg-white dark:bg-surface-700 text-surface-900 dark:text-white shadow-xs font-semibold'
                    : 'text-surface-500 hover:text-surface-700 dark:hover:text-surface-300'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* 5. Clear All Filters Reset Button */}
          {(search || statusFilter || activeCountryId || paymentStatusFilter || paymentMethodFilter || datePreset !== 'all') && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setStatusFilter('');
                setActiveCountryId('');
                setPaymentStatusFilter('');
                setPaymentMethodFilter('');
                setDatePreset('all');
                setPage(1);
              }}
              className="text-xs text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 px-2 py-1 font-medium transition-colors whitespace-nowrap"
              title="Reset all active filters"
            >
              Reset
            </button>
          )}
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
            ? `${confirm?.ids.length} order(s) and their payment records will be deleted forever. This cannot be undone.`
            : `${confirm?.ids.length} order(s) will be moved to Trash and deleted automatically after ${TRASH_RETENTION_DAYS} days. Stock reserved by unshipped orders is returned to inventory. Orders with recorded payments are included, so double-check before continuing.`
        }
        confirmLabel={confirm?.action === 'purge' ? 'Delete permanently' : 'Move to Trash'}
        onCancel={() => setConfirm(null)}
        onConfirm={async () => {
          await trash.run(confirm.action, confirm.ids);
          setConfirm(null);
          fetchStats();
        }}
      />

      {/* ── Enterprise Orders Data Table (Desktop & Tablet) ── */}
      <div className="glass-card rounded-2xl border border-surface-200/80 dark:border-surface-800 overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-12 text-center">
            <HiOutlineRefresh className="w-8 h-8 text-purple-500 animate-spin mx-auto mb-3" />
            <p className="text-sm font-medium text-surface-600 dark:text-surface-300">
              Loading orders catalog...
            </p>
          </div>
        ) : orders.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 rounded-2xl bg-surface-100 dark:bg-surface-800 flex items-center justify-center mx-auto mb-3 text-surface-400">
              <HiOutlineShoppingBag className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-semibold text-surface-900 dark:text-white">
              No orders found
            </h3>
            <p className="text-xs text-surface-400 mt-1 max-w-sm mx-auto">
              There are no customer or manual orders matching your active filters. Try adjusting search criteria or selecting another country market.
            </p>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="overflow-x-auto hidden md:block">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-surface-200/80 dark:border-surface-800 bg-surface-50/70 dark:bg-surface-800/40 text-[11px] font-bold uppercase tracking-wider text-surface-500">
                    {canDelete && (
                      <th className="py-3 pl-4 pr-0 w-8">
                        <input
                          type="checkbox"
                          checked={trash.allSelected}
                          onChange={trash.toggleAll}
                          className="w-4 h-4 rounded accent-purple-600 cursor-pointer"
                          aria-label="Select all"
                        />
                      </th>
                    )}
                    <th className="py-3 px-4">Order & Date</th>
                    <th className="py-3 px-4">Customer</th>
                    <th className="py-3 px-4">Market</th>
                    <th className="py-3 px-4">Items</th>
                    <th className="py-3 px-4">Payment</th>
                    <th className="py-3 px-4">Fulfillment Status</th>
                    <th className="py-3 px-4 text-right">Total</th>
                    <th className="py-3 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-100 dark:divide-surface-800/60 text-xs">
                  {orders.map((ord) => {
                    return (
                      <tr
                        key={ord.id}
                        onClick={() => setSelectedOrderId(ord.id)}
                        className="hover:bg-surface-50/70 dark:hover:bg-surface-800/40 transition-colors cursor-pointer group"
                      >
                        {/* Order Number & Date */}
                        {canDelete && (
                          <td className="py-3.5 pl-4 pr-0 w-8" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={trash.selected.has(ord.id)}
                              onChange={() => trash.toggle(ord.id)}
                              className="w-4 h-4 rounded accent-purple-600 cursor-pointer"
                              aria-label={`Select ${ord.order_number}`}
                            />
                          </td>
                        )}
                        <td className="py-3.5 px-4 font-mono">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-surface-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                              {ord.order_number}
                            </span>
                            {Boolean(ord.is_gift) && (
                              <span
                                className="p-0.5 rounded bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800"
                                title={`Gift Order${ord.gift_engraving_text ? `: "${ord.gift_engraving_text}"` : ''}`}
                              >
                                <HiOutlineGift className="w-3.5 h-3.5" />
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-surface-400 font-sans block mt-0.5">
                            {formatDate(ord.created_at)}
                          </span>
                        </td>

                        {/* Customer Info */}
                        <td className="py-3.5 px-4">
                          <p className="font-semibold text-surface-900 dark:text-white truncate max-w-[180px]">
                            {ord.customer_name}
                          </p>
                          <span className="text-[11px] text-surface-400 block truncate max-w-[180px]">
                            {ord.customer_phone || ord.customer_email}
                          </span>
                        </td>

                        {/* Market / Country */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <CountryBadge code={ord.country_code} label={ord.country_code} size="xs" />
                        </td>

                        {/* Items */}
                        <td className="py-3.5 px-4 max-w-[200px]">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-surface-900 dark:text-white">
                              {ord.items_count} {ord.items_count === 1 ? 'item' : 'items'}
                            </span>
                          </div>
                          {ord.items_preview && (
                            <p className="text-[11px] text-surface-400 truncate mt-0.5">
                              {ord.items_preview}
                            </p>
                          )}
                        </td>

                        {/* Payment */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <PaymentStatusBadge status={ord.payment_status} size="xs" />
                          <span className="text-[11px] text-surface-400 block mt-0.5">
                            {getPaymentMethodLabel(ord.payment_method)}
                          </span>
                        </td>

                        {/* Fulfillment Status */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {showTrash && <div className="mb-1"><TrashCountdown deletedAt={ord.deleted_at} /></div>}
                          <OrderStatusBadge status={ord.status} />
                          {ord.tracking_number && (
                            <span className="text-[10px] font-mono text-surface-400 block mt-0.5">
                              {ord.shipping_carrier || 'Courier'}: {ord.tracking_number}
                            </span>
                          )}
                        </td>

                        {/* Total Amount */}
                        <td className="py-3.5 px-4 text-right whitespace-nowrap font-mono font-bold text-surface-900 dark:text-white">
                          {formatCurrency(ord.total_amount, ord.currency_code, ord.decimal_places || 2)}
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedOrderId(ord.id);
                                toast.info(`Viewing details for ${ord.order_number}`);
                              }}
                              className="p-1.5 rounded-lg text-surface-400 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/30 transition-colors"
                              title="Inspect Order Details"
                            >
                              <HiOutlineEye className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setInvoiceOrderId(ord.id)}
                              className="p-1.5 rounded-lg text-surface-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 transition-colors"
                              title="Print Commercial Invoice"
                            >
                              <HiOutlinePrinter className="w-4 h-4" />
                            </button>
                            <PermissionGate permission="orders.delete">{renderTrashActions(ord)}</PermissionGate>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards Stack View */}
            <div className="md:hidden divide-y divide-surface-100 dark:divide-surface-800">
              {orders.map((ord) => {
                return (
                  <div
                    key={ord.id}
                    onClick={() => setSelectedOrderId(ord.id)}
                    className="p-4 space-y-3 hover:bg-surface-50 dark:hover:bg-surface-800/40 transition-colors cursor-pointer"
                  >
                    <div className="flex items-start justify-between gap-2">
                      {canDelete && (
                        <input
                          type="checkbox"
                          checked={trash.selected.has(ord.id)}
                          onClick={(e) => e.stopPropagation()}
                          onChange={() => trash.toggle(ord.id)}
                          className="w-4 h-4 mt-0.5 rounded accent-purple-600 cursor-pointer shrink-0"
                          aria-label={`Select ${ord.order_number}`}
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        {showTrash && <TrashCountdown deletedAt={ord.deleted_at} />}
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-sm text-surface-900 dark:text-white">
                            {ord.order_number}
                          </span>
                          {Boolean(ord.is_gift) && (
                            <span className="p-0.5 rounded bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200">
                              <HiOutlineGift className="w-3.5 h-3.5" />
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-surface-400 block mt-0.5">
                          {formatDate(ord.created_at)}
                        </span>
                      </div>

                      <span className="font-mono font-bold text-sm text-surface-900 dark:text-white">
                        {formatCurrency(ord.total_amount, ord.currency_code, ord.decimal_places || 2)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1 border-t border-surface-100 dark:border-surface-800/60">
                      <div>
                        <span className="font-semibold text-surface-800 dark:text-surface-200 block">
                          {ord.customer_name}
                        </span>
                        <span className="text-[11px] text-surface-400 flex items-center gap-1.5 mt-0.5">
                          <span>{ord.items_count} items</span>
                          <span>·</span>
                          <span className="inline-flex items-center gap-1">
                            <CountryFlag code={ord.country_code} size="xs" />
                            <span className="font-mono font-medium">{ord.country_code}</span>
                          </span>
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <PaymentStatusBadge status={ord.payment_status} size="xs" />
                        <OrderStatusBadge status={ord.status} size="xs" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* ── Table Footer & Pagination ── */}
        {!loading && orders.length > 0 && (
          <div className="p-4 border-t border-surface-200/80 dark:border-surface-800 bg-surface-50/50 dark:bg-surface-800/30">
            <Pagination
              page={page}
              totalPages={pagination.totalPages}
              totalItems={pagination.total}
              itemsPerPage={limit}
              onPageChange={(newPage) => setPage(newPage)}
              onItemsPerPageChange={(newLimit) => {
                setLimit(newLimit);
                setPage(1);
              }}
              itemsPerPageOptions={[10, 20, 50]}
              label="orders"
            />
          </div>
        )}
      </div>

      {/* ── Order Detail Inspector & Ledger Modal (Phase 4) ── */}
      {selectedOrderId && (
        <OrderDetailModal
          orderId={selectedOrderId}
          onClose={() => setSelectedOrderId(null)}
          onOrderUpdated={() => {
            fetchOrders();
            fetchStats();
          }}
        />
      )}

      {/* ── Concierge Order Creation Modal (Phase 5) ── */}
      <CreateOrderModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onOrderCreated={(newOrder) => {
          fetchOrders();
          fetchStats();
          if (newOrder?.id) setSelectedOrderId(newOrder.id);
        }}
      />

      {/* ── Commercial Tax Invoice Modal (Phase 5) ── */}
      <OrderInvoiceModal
        orderId={invoiceOrderId}
        isOpen={Boolean(invoiceOrderId)}
        onClose={() => setInvoiceOrderId(null)}
      />
    </div>
  );
}
