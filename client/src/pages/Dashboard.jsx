import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCountry } from '../context/CountryContext';
import { usePermission } from '../hooks/usePermission';
import api from '../services/api';
import formatCurrency from '../utils/formatCurrency';
import CountryFlag from '../components/ui/CountryFlag';
import OrderStatusBadge from '../components/orders/OrderStatusBadge';
import PaymentStatusBadge from '../components/orders/PaymentStatusBadge';
import OrderDetailModal from '../components/orders/OrderDetailModal';
import {
  HiOutlineUsers,
  HiOutlineShieldCheck,
  HiOutlineClipboardList,
  HiOutlineCube,
  HiOutlineShoppingBag,
  HiOutlineCash,
  HiOutlineTruck,
  HiOutlineCheckCircle,
  HiOutlineClock,
  HiOutlineExclamation,
  HiOutlineRefresh,
  HiOutlinePlus,
  HiOutlineArrowRight,
  HiOutlineFolder,
  HiOutlineEye,
  HiOutlineTrendingUp,
  HiOutlinePencil,
} from 'react-icons/hi';

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { selectedCountry, countries } = useCountry();

  // Permissions
  const canSeeOrders = usePermission('orders.read');
  const canCreateOrder = usePermission('orders.create');
  const canSeeProducts = usePermission('products.read');
  const canCreateProduct = usePermission('products.create');
  const canSeeUsers = usePermission('users.read');
  const canSeeAudit = usePermission('audit.read');
  const canSeeFiles = usePermission('files.read');

  // State
  const [stats, setStats] = useState({
    users: null,
    products: null,
    auditLogs: null,
    orderStats: null,
  });
  const [recentOrders, setRecentOrders] = useState([]);
  const [lowStockProducts, setLowStockProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inspectingOrderId, setInspectingOrderId] = useState(null);

  const activeCountry = selectedCountry || (countries && countries[0]) || {
    id: 1,
    name: 'United Arab Emirates',
    code: 'AE',
    currency_code: 'AED',
    decimal_places: 2,
  };

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    const countryId = activeCountry?.id;
    const promises = [];

    // 1. Order stats
    if (canSeeOrders) {
      promises.push(
        api
          .get('/orders/stats', { params: { country_id: countryId } })
          .then((res) => ({ key: 'orderStats', data: res.data?.data || null }))
          .catch(() => ({ key: 'orderStats', data: null }))
      );

      // 2. Recent orders stream
      promises.push(
        api
          .get('/orders', { params: { limit: 5, country_id: countryId } })
          .then((res) => ({ key: 'recentOrders', data: res.data?.data || [] }))
          .catch(() => ({ key: 'recentOrders', data: [] }))
      );
    }

    // 3. Products count
    if (canSeeProducts) {
      promises.push(
        api
          .get('/products', { params: { limit: 1 } })
          .then((res) => ({ key: 'products', count: res.data?.pagination?.total ?? 0 }))
          .catch(() => ({ key: 'products', count: 0 }))
      );

      // 4. Low stock products radar
      if (countryId) {
        promises.push(
          api
            .get('/products', { params: { low_stock: true, country_id: countryId, limit: 5 } })
            // Now: properly maps res.data.products
            .then((res) => ({ key: 'lowStockProducts', data: res.data?.products || res.data?.data || [] }))
            .catch(() => ({ key: 'lowStockProducts', data: [] }))
        );
      }
    }

    // 5. Total users
    if (canSeeUsers) {
      promises.push(
        api
          .get('/users', { params: { limit: 1 } })
          .then((res) => ({
            key: 'users',
            count: res.data?.pagination?.total ?? res.data?.data?.length ?? 0,
          }))
          .catch(() => ({ key: 'users', count: 0 }))
      );
    }

    // 6. Audit logs
    if (canSeeAudit) {
      promises.push(
        api
          .get('/logs/audit', { params: { limit: 1 } })
          .then((res) => ({ key: 'auditLogs', count: res.data?.pagination?.total ?? 0 }))
          .catch(() => ({ key: 'auditLogs', count: 0 }))
      );
    }

    const results = await Promise.allSettled(promises);
    const newStats = {};
    let fetchedOrders = [];
    let fetchedLowStock = [];

    results.forEach((res) => {
      if (res.status === 'fulfilled' && res.value) {
        const { key, data, count } = res.value;
        if (key === 'recentOrders') fetchedOrders = data;
        else if (key === 'lowStockProducts') fetchedLowStock = data;
        else if (key === 'orderStats') newStats.orderStats = data;
        else if (count !== undefined) newStats[key] = count;
      }
    });

    setStats((prev) => ({ ...prev, ...newStats }));
    setRecentOrders(fetchedOrders);
    setLowStockProducts(fetchedLowStock);
    setLoading(false);
  }, [canSeeOrders, canSeeProducts, canSeeUsers, canSeeAudit, activeCountry?.id]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const orderStats = stats.orderStats;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Top Bar: Welcome & Operational Actions ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-surface-900 dark:text-white font-display tracking-tight">
            Commerce Command Center
          </h1>
          <div className="flex items-center gap-2 mt-1 text-xs sm:text-sm text-surface-500 dark:text-surface-400">
            <span>Welcome back, <strong className="text-surface-800 dark:text-surface-200">{user?.fullName}</strong></span>
            <span>·</span>
            <span className="inline-flex items-center gap-1.5 font-medium text-surface-700 dark:text-surface-300">
              <CountryFlag code={activeCountry.code} name={activeCountry.name} size="xs" />
              <span>{activeCountry.name}</span>
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center flex-wrap gap-2">
          <button
            onClick={fetchDashboardData}
            disabled={loading}
            className="p-2 sm:px-3 sm:py-2 rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-surface-700 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-700 text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-2xs"
            title="Refresh dashboard data"
          >
            <HiOutlineRefresh className={`w-4 h-4 text-surface-500 ${loading ? 'animate-spin text-purple-600' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          {canCreateProduct && (
            <Link
              to="/products"
              className="p-2 sm:px-3 sm:py-2 rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-surface-700 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-700 text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-2xs"
            >
              <HiOutlineCube className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Catalog</span>
            </Link>
          )}

          {canSeeFiles && (
            <Link
              to="/files"
              className="p-2 sm:px-3 sm:py-2 rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-surface-700 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-700 text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-2xs"
            >
              <HiOutlineFolder className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>Media</span>
            </Link>
          )}

          {canCreateOrder && (
            <button
              onClick={() => navigate('/orders?action=new')}
              className="btn-primary text-xs py-2 px-3.5 flex items-center gap-1.5 shadow-sm"
            >
              <HiOutlinePlus className="w-4 h-4" />
              <span>Create Order</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Executive Commerce Financial Ribbon ── */}
      {canSeeOrders ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {/* Net Realized Revenue */}
          <div className="glass-card p-4 rounded-xl border border-surface-200/80 dark:border-surface-800 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-surface-500 dark:text-surface-400">
                Net Revenue
              </span>
              <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
                <HiOutlineCash className="w-4 h-4" />
              </div>
            </div>
            <p className="text-xl sm:text-2xl font-bold text-surface-900 dark:text-white font-display mt-2">
              {loading && !orderStats ? (
                <span className="opacity-40">...</span>
              ) : (
                formatCurrency(orderStats?.total_revenue, activeCountry.currency_code, activeCountry.decimal_places || 2)
              )}
            </p>
            <span className="text-[10px] text-surface-400 mt-1 block truncate">
              {parseFloat(orderStats?.total_refunded || 0) > 0
                ? `Net of ${formatCurrency(orderStats.total_refunded, activeCountry.currency_code, activeCountry.decimal_places || 2)} refunded`
                : activeCountry.name}
            </span>
          </div>

          {/* Average Order Value (AOV) */}
          <div className="glass-card p-4 rounded-xl border border-surface-200/80 dark:border-surface-800 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-surface-500 dark:text-surface-400">
                Avg. Order Value
              </span>
              <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">
                <HiOutlineTrendingUp className="w-4 h-4" />
              </div>
            </div>
            <p className="text-xl sm:text-2xl font-bold text-surface-900 dark:text-white font-display mt-2">
              {loading && !orderStats ? (
                <span className="opacity-40">...</span>
              ) : (
                formatCurrency(orderStats?.aov, activeCountry.currency_code, activeCountry.decimal_places || 2)
              )}
            </p>
            <span className="text-[10px] text-surface-400 mt-1 block">Active basket benchmark</span>
          </div>

          {/* Total Orders */}
          <div className="glass-card p-4 rounded-xl border border-surface-200/80 dark:border-surface-800 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-surface-500 dark:text-surface-400">
                Total Orders
              </span>
              <div className="p-1.5 rounded-lg bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400">
                <HiOutlineShoppingBag className="w-4 h-4" />
              </div>
            </div>
            <p className="text-xl sm:text-2xl font-bold text-surface-900 dark:text-white font-display mt-2">
              {loading && !orderStats ? <span className="opacity-40">...</span> : orderStats?.total_orders || 0}
            </p>
            <span className="text-[10px] text-surface-400 mt-1 block">All registered orders</span>
          </div>

          {/* Pending Packing / Dispatch */}
          <div className="glass-card p-4 rounded-xl border border-surface-200/80 dark:border-surface-800 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-surface-500 dark:text-surface-400">
                Pending Packing
              </span>
              <div className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400">
                <HiOutlineClock className="w-4 h-4" />
              </div>
            </div>
            <p className="text-xl sm:text-2xl font-bold text-amber-600 dark:text-amber-400 font-display mt-2">
              {loading && !orderStats ? <span className="opacity-40">...</span> : orderStats?.pending_fulfillment || 0}
            </p>
            <span className="text-[10px] text-surface-400 mt-1 block">Processing & packed queue</span>
          </div>

          {/* Delivered Volume */}
          <div className="glass-card p-4 rounded-xl border border-surface-200/80 dark:border-surface-800 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-surface-500 dark:text-surface-400">
                Delivered
              </span>
              <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
                <HiOutlineTruck className="w-4 h-4" />
              </div>
            </div>
            <p className="text-xl sm:text-2xl font-bold text-blue-600 dark:text-blue-400 font-display mt-2">
              {loading && !orderStats ? <span className="opacity-40">...</span> : orderStats?.delivered_count || 0}
            </p>
            <span className="text-[10px] text-surface-400 mt-1 block">Successfully completed</span>
          </div>
        </div>
      ) : (
        /* Alternate Non-Order Role Stats Strip */
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="glass-card p-4 rounded-xl border border-surface-200 dark:border-surface-800">
            <span className="text-xs font-semibold text-surface-400 uppercase tracking-wider">Perfume Catalog</span>
            <p className="text-2xl font-bold text-surface-900 dark:text-white mt-1">{stats.products ?? '—'}</p>
          </div>
          <div className="glass-card p-4 rounded-xl border border-surface-200 dark:border-surface-800">
            <span className="text-xs font-semibold text-surface-400 uppercase tracking-wider">System Users</span>
            <p className="text-2xl font-bold text-surface-900 dark:text-white mt-1">{stats.users ?? '—'}</p>
          </div>
          <div className="glass-card p-4 rounded-xl border border-surface-200 dark:border-surface-800">
            <span className="text-xs font-semibold text-surface-400 uppercase tracking-wider">Security Events</span>
            <p className="text-2xl font-bold text-surface-900 dark:text-white mt-1">{stats.auditLogs ?? '—'}</p>
          </div>
          <div className="glass-card p-4 rounded-xl border border-surface-200 dark:border-surface-800">
            <span className="text-xs font-semibold text-surface-400 uppercase tracking-wider">Permissions Active</span>
            <p className="text-2xl font-bold text-purple-600 dark:text-purple-400 mt-1">{user?.permissions?.length || 0}</p>
          </div>
        </div>
      )}

      {/* ── Main Operations Grid: Recent Orders (Left) vs. Inventory Radar (Right) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* 1. Left: Live Recent Orders Feed (7 Cols) */}
        <div className="lg:col-span-7 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <HiOutlineShoppingBag className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              <h2 className="text-base font-bold text-surface-900 dark:text-white font-display">
                Recent Orders
              </h2>
            </div>
            {canSeeOrders && (
              <Link
                to="/orders"
                className="text-xs font-semibold text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 flex items-center gap-1 group"
              >
                <span>View All Orders</span>
                <HiOutlineArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
              </Link>
            )}
          </div>

          <div className="glass-card rounded-2xl border border-surface-200/80 dark:border-surface-800/80 overflow-hidden shadow-sm">
            {loading && recentOrders.length === 0 ? (
              <div className="py-16 text-center text-xs text-surface-400">
                <HiOutlineRefresh className="w-6 h-6 mx-auto mb-2 animate-spin text-purple-500 opacity-60" />
                Loading latest transactions...
              </div>
            ) : recentOrders.length === 0 ? (
              <div className="py-12 text-center text-surface-400 space-y-2">
                <HiOutlineShoppingBag className="w-10 h-10 mx-auto text-surface-300 dark:text-surface-700 stroke-1" />
                <p className="text-sm font-semibold text-surface-700 dark:text-surface-300">No recent orders in this market</p>
                <p className="text-xs text-surface-400 max-w-sm mx-auto">
                  Orders placed through e-commerce checkout or created manually will stream in live.
                </p>
                {canCreateOrder && (
                  <button
                    onClick={() => navigate('/orders?action=new')}
                    className="btn-secondary text-xs px-3 py-1.5 mt-2"
                  >
                    Create First Order
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface-50/80 dark:bg-surface-850 text-surface-400 font-bold uppercase tracking-wider text-[10px] border-b border-surface-200/70 dark:border-surface-800">
                    <tr>
                      <th className="py-3 px-4">Order Dossier</th>
                      <th className="py-3 px-4">Customer</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Amount</th>
                      <th className="py-3 px-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-100 dark:divide-surface-800/60 font-sans">
                    {recentOrders.map((ord) => (
                      <tr
                        key={ord.id}
                        className="hover:bg-surface-50/70 dark:hover:bg-surface-800/50 transition-colors group cursor-pointer"
                        onClick={() => setInspectingOrderId(ord.id)}
                      >
                        {/* Order Number & Flag */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <CountryFlag code={ord.country_code} size="xs" />
                            <span className="font-mono font-bold text-surface-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                              {ord.order_number}
                            </span>
                          </div>
                          <span className="text-[10px] text-surface-400 block mt-0.5">
                            {new Date(ord.created_at).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </td>

                        {/* Customer */}
                        <td className="py-3 px-4 max-w-[150px]">
                          <p className="font-semibold text-surface-800 dark:text-surface-200 truncate">
                            {ord.customer_name}
                          </p>
                          <span className="text-[10px] text-surface-400 block truncate">
                            {ord.items_count} {ord.items_count === 1 ? 'item' : 'items'}
                          </span>
                        </td>

                        {/* Badges */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="flex flex-col gap-1 items-start">
                            <OrderStatusBadge status={ord.status} size="xs" />
                            <PaymentStatusBadge status={ord.payment_status} size="xs" />
                          </div>
                        </td>

                        {/* Financial Amount */}
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <span className="font-mono font-bold text-surface-900 dark:text-white block">
                            {formatCurrency(ord.total_amount, ord.currency_code, ord.decimal_places || 2)}
                          </span>
                          <span className="text-[10px] text-surface-400 capitalize">
                            {ord.payment_method?.replace('_', ' ')}
                          </span>
                        </td>

                        {/* Inspect Action */}
                        <td className="py-3 px-3 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => setInspectingOrderId(ord.id)}
                            className="p-1.5 rounded-lg text-surface-400 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/40 transition-colors"
                            title="Inspect Order"
                          >
                            <HiOutlineEye className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* 2. Right: Logistics & Inventory Radar (5 Cols) */}
        <div className="lg:col-span-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <HiOutlineExclamation className="w-5 h-5 text-amber-500" />
              <h2 className="text-base font-bold text-surface-900 dark:text-white font-display">
                Warehouse Low Stock Radar
              </h2>
            </div>
            {canSeeProducts && (
              <Link
                to="/products"
                className="text-xs font-semibold text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 flex items-center gap-1 group"
              >
                <span>Manage Stock</span>
                <HiOutlineArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
              </Link>
            )}
          </div>

          <div className="glass-card rounded-2xl border border-surface-200/80 dark:border-surface-800/80 overflow-hidden shadow-sm flex flex-col justify-between">
            {loading && lowStockProducts.length === 0 ? (
              <div className="py-16 text-center text-xs text-surface-400">
                <HiOutlineRefresh className="w-6 h-6 mx-auto mb-2 animate-spin text-purple-500 opacity-60" />
                Checking regional inventory thresholds...
              </div>
            ) : lowStockProducts.length === 0 ? (
              <div className="py-12 text-center text-surface-500 space-y-2">
                <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
                  <HiOutlineCheckCircle className="w-6 h-6" />
                </div>
                <p className="text-xs font-semibold text-surface-800 dark:text-surface-200">
                  Inventory Healthy in {activeCountry.name}
                </p>
                <p className="text-[11px] text-surface-400 max-w-xs mx-auto">
                  All active fragrances are safely above their replenishment thresholds.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface-50/80 dark:bg-surface-850 text-surface-400 font-bold uppercase tracking-wider text-[10px] border-b border-surface-200/70 dark:border-surface-800">
                    <tr>
                      <th className="py-3 px-4">Fragrance</th>
                      <th className="py-3 px-4 text-center">Stock</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-100 dark:divide-surface-800/60 font-sans">
                    {lowStockProducts.map((prod) => {
                      const stock = parseInt(prod.country_stock_quantity || 0, 10);
                      const threshold = parseInt(prod.country_low_stock_threshold || 5, 10);
                      const isOut = stock <= 0;

                      return (
                        <tr
                          key={prod.id}
                          className="hover:bg-surface-50/70 dark:hover:bg-surface-800/50 transition-colors group cursor-pointer"
                          onClick={() => navigate(`/products?edit=${prod.id}`)}
                        >
                          {/* Fragrance Packshot + Title + SKU */}
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3 min-w-0">
                              {prod.primary_image_url ? (
                                <img
                                  src={prod.primary_image_url}
                                  alt={prod.name}
                                  className="w-9 h-9 object-cover rounded-lg border border-surface-200 dark:border-surface-700 shrink-0"
                                />
                              ) : (
                                <div className="w-9 h-9 rounded-lg bg-surface-100 dark:bg-surface-800 flex items-center justify-center shrink-0 text-surface-400">
                                  <HiOutlineCube className="w-4 h-4" />
                                </div>
                              )}
                              <div className="min-w-0">
                                <span className="font-bold text-surface-900 dark:text-white truncate block group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                                  {prod.name}
                                </span>
                                <span className="text-[10px] text-surface-400 font-mono block truncate">
                                  SKU: {prod.sku || 'N/A'} · {prod.size_name || 'Standard'}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Stock Quantity */}
                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            <span className="font-mono font-bold text-surface-900 dark:text-white block">
                              {stock}
                            </span>
                            <span className="text-[9px] text-surface-400 block font-mono">
                              Min: {threshold}
                            </span>
                          </td>

                          {/* Status Pill */}
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                isOut
                                  ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                                  : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  isOut ? 'bg-rose-500 animate-pulse' : 'bg-amber-500'
                                }`}
                              />
                              {isOut ? 'Out of Stock' : `${stock} Left`}
                            </span>
                          </td>

                          {/* Action Button */}
                          <td
                            className="py-3 px-3 text-center whitespace-nowrap"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={() => navigate(`/products?edit=${prod.id}`)}
                              className="p-1.5 rounded-lg text-surface-400 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/40 transition-colors"
                              title="Edit Fragrance & Inventory"
                            >
                              <HiOutlinePencil className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Quick Warehouse Notice */}
            <div className="px-4 py-2.5 bg-surface-50/50 dark:bg-surface-850/50 border-t border-surface-200/70 dark:border-surface-800 flex items-center justify-between text-[11px] text-surface-400">
              <span>Warehouse: <strong className="text-surface-700 dark:text-surface-200 font-medium">{activeCountry.name}</strong></span>
              <Link to="/products" className="text-purple-600 dark:text-purple-400 font-medium hover:underline flex items-center gap-1 group">
                <span>Reorder & Restock</span>
                <HiOutlineArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* ── System Governance & User Access ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Account & Role Metadata */}
        <div className="glass-card p-4 sm:p-5 rounded-2xl border border-surface-200/80 dark:border-surface-800">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-surface-400">
              Active Session & Role
            </h3>
            <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border border-purple-200/60 dark:border-purple-800/60">
              {user?.role}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-surface-400 block">Operator Email</span>
              <span className="font-semibold text-surface-800 dark:text-surface-200 truncate block mt-0.5">
                {user?.email}
              </span>
            </div>
            <div>
              <span className="text-surface-400 block">Assigned Market</span>
              <span className="font-semibold text-surface-800 dark:text-surface-200 flex items-center gap-1.5 mt-0.5">
                <CountryFlag code={activeCountry.code} size="xs" />
                <span>{activeCountry.name}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Security & Audit Summary */}
        <div className="glass-card p-4 sm:p-5 rounded-2xl border border-surface-200/80 dark:border-surface-800">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-surface-400">
              Governance & Security
            </h3>
            {canSeeAudit && (
              <Link to="/audit-logs" className="text-xs font-semibold text-purple-600 dark:text-purple-400 hover:underline">
                View Audit Trail
              </Link>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-surface-400 block">Audit Trail Events</span>
              <span className="font-mono font-bold text-surface-800 dark:text-surface-200 text-sm block mt-0.5">
                {stats.auditLogs !== null ? stats.auditLogs.toLocaleString() : '—'}
              </span>
            </div>
            <div>
              <span className="text-surface-400 block">Granted Permissions</span>
              <span className="font-mono font-bold text-purple-600 dark:text-purple-400 text-sm block mt-0.5">
                {user?.permissions?.length || 0} Actions Authorized
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Order Detail Modal Inspector ── */}
      {inspectingOrderId && (
        <OrderDetailModal
          orderId={inspectingOrderId}
          onClose={() => setInspectingOrderId(null)}
          onOrderUpdated={fetchDashboardData}
        />
      )}


    </div>
  );
}
